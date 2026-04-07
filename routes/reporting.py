"""
routes/reporting.py

Blueprint para o módulo Reporting.
Rota principal: POST /reporting/event
  — recebe observação do professor
  — chama auto_tag() para sugerir skills
  — persiste EvidenceEvent + evidence_skill_tags
  — retorna evento criado com tags sugeridas
"""

from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError

from extensions import db
from models import Student, SkillNode, EvidenceEvent
from models.evidence_event import evidence_skill_tags
from services.auto_tagger import auto_tag, VALID_SOURCE_TYPES
from services.knowledge_tracing import process_evidence_event

reporting_bp = Blueprint("reporting", __name__)

# Campos obrigatórios e seus tipos esperados
_REQUIRED_FIELDS = {
    "student_id": int,
    "source_type": str,
    "raw_input":   str,
    "polarity":    int,
    "severity":    int,
}


# ─────────────────────────────────────────────────────────────
# POST /reporting/event
# ─────────────────────────────────────────────────────────────

@reporting_bp.route("/reporting/event", methods=["POST"])
def create_event():
    """
    Cria um EvidenceEvent a partir de uma observação do professor.

    Payload JSON esperado:
        {
            "student_id":  1,
            "source_type": "grammar_flag",   // grammar_flag | free_note | test_response
            "raw_input":   "she don't use third person",
            "polarity":    -1,               // -1 = erro | 1 = acerto
            "severity":    2,                // 1, 2 ou 3
            "context":     "Speaking task"   // opcional
        }

    Retorna 201 com o evento criado e as tags sugeridas pelo auto_tag.
    Retorna 400 para payload inválido, student_id inexistente ou source_type inválido.
    Retorna 500 para erros de banco.
    """

    # ── 1. Parse do JSON ──────────────────────────────────────
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    # ── 2. Validação de campos obrigatórios e tipos ───────────
    missing = [f for f in _REQUIRED_FIELDS if f not in data]
    if missing:
        return jsonify({
            "error": f"Campos obrigatórios ausentes: {', '.join(missing)}."
        }), 400

    type_errors = []
    for field, expected_type in _REQUIRED_FIELDS.items():
        value = data.get(field)
        if value is not None and not isinstance(value, expected_type):
            type_errors.append(f"'{field}' deve ser {expected_type.__name__}")
    if type_errors:
        return jsonify({"error": f"Tipo incorreto: {'; '.join(type_errors)}." }), 400

    # ── 3. Validação de valores permitidos ────────────────────
    source_type = data["source_type"]
    if source_type not in VALID_SOURCE_TYPES:
        return jsonify({
            "error": f"source_type inválido: '{source_type}'. "
                     f"Valores aceitos: {', '.join(sorted(VALID_SOURCE_TYPES))}."
        }), 400

    polarity = data["polarity"]
    if polarity not in (-1, 1):
        return jsonify({"error": "polarity deve ser -1 (erro) ou 1 (acerto)."}), 400

    severity = data["severity"]
    if severity not in (1, 2, 3):
        return jsonify({"error": "severity deve ser 1, 2 ou 3."}), 400

    raw_input = data["raw_input"].strip()
    if not raw_input:
        return jsonify({"error": "raw_input não pode ser vazio."}), 400

    # ── 4. Verifica se o aluno existe ─────────────────────────
    student = db.session.get(Student, data["student_id"])
    if student is None:
        return jsonify({
            "error": f"Student com id {data['student_id']} não encontrado."
        }), 400

    # ── 5. Auto-tag: obtém skills candidatos ──────────────────
    try:
        tag_candidates = auto_tag(raw_input, source_type)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Confiança média das tags sugeridas (None se não houver tags)
    machine_confidence = None
    if tag_candidates:
        machine_confidence = round(
            sum(t["confidence_score"] for t in tag_candidates) / len(tag_candidates),
            4,
        )

    # ── 6. Persiste no banco ──────────────────────────────────
    try:
        event = EvidenceEvent(
            student_id=data["student_id"],
            source_module="Reporting",
            source_type=source_type,
            raw_input=raw_input,
            context=data.get("context"),
            polarity=polarity,
            severity=severity,
            machine_confidence=machine_confidence,
        )
        db.session.add(event)
        db.session.flush()  # obtém event.id antes de inserir as tags

        # Insere um registro em evidence_skill_tags por skill candidato
        # teacher_override=False: tag veio do auto_tag, não do professor
        if tag_candidates:
            skill_ids_in_db = {
                row[0] for row in db.session.execute(
                    db.select(SkillNode.skill_id).where(
                        SkillNode.skill_id.in_(
                            [t["skill_id"] for t in tag_candidates]
                        )
                    )
                ).all()
            }

            for tag in tag_candidates:
                if tag["skill_id"] not in skill_ids_in_db:
                    continue  # ignora skills que não existem no banco

                db.session.execute(
                    evidence_skill_tags.insert().values(
                        evidence_id=event.id,
                        skill_id=tag["skill_id"],
                        teacher_override=False,
                    )
                )

        db.session.commit()

        # Processa o evento para atualizar mastery dos skills
        updated_states = process_evidence_event(event.id, db.session)

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({
            "error": "Erro ao salvar no banco de dados.",
            "details": str(e),
        }), 500

    # ── 7. Monta resposta enriquecida ─────────────────────────
    response_body = event.to_dict()

    # Adiciona confidence_score de cada tag na resposta
    # (o to_dict() nativo não tem esse campo)
    score_map = {t["skill_id"]: t["confidence_score"] for t in tag_candidates}
    for tag in response_body.get("skill_tags", []):
        tag["confidence_score"] = score_map.get(tag["skill_id"])

    # Adiciona os estados de skills atualizados
    response_body["skill_states_updated"] = [
        {"skill_id": state.skill_id, "mastery_score": state.mastery_score}
        for state in updated_states
    ]

    return jsonify(response_body), 201
