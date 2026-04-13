import json as _json

from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError
from datetime import date, datetime, timezone

from extensions import db
from models import Student
from models.evidence_event import EvidenceEvent
from models.student_skill_state import StudentSkillState
from models.skill_node import SkillNode
from services.level_estimator import compute_level_estimate, compute_all_skill_estimates, compute_evidence_coverage
from services.gap_analyzer import compute_aspect_gaps, compute_next_level_distance, compute_skill_gap

students_bp = Blueprint("students", __name__)


# ──────────────────────────────────────────────
# GET /api/students  →  lista todos os alunos
#
# Query params:
#   include_estimates=true  — enriquece cada aluno com campos calculados:
#     overall_level, confidence, aspect_levels (L/S/R/W), primary_focus,
#     top_issues, next_level_progress, start_date (primeiro EvidenceEvent),
#     weeks_since_start, last_evidence_date
# ──────────────────────────────────────────────
@students_bp.route("/students", methods=["GET"])
def list_students():
    include_estimates = request.args.get("include_estimates", "").lower() == "true"

    try:
        students = Student.query.all()

        if not include_estimates:
            return jsonify([
                {"id": s.id, "name": s.name, "email": getattr(s, "email", None)}
                for s in students
            ]), 200

        result = []
        today = datetime.now(timezone.utc).date()

        for s in students:
            row = {"id": s.id, "name": s.name, "email": getattr(s, "email", None)}

            # ── Level estimate ──────────────────────────────────
            overall_est  = compute_level_estimate(s.id, db.session)
            skill_est    = compute_all_skill_estimates(s.id, db.session)

            row["overall_level"] = overall_est["overall_level"]
            row["confidence"]    = round(overall_est["confidence"], 4)
            row["aspect_levels"] = {
                "L": skill_est["listening"]["overall_level"],
                "S": skill_est["speaking"]["overall_level"],
                "R": skill_est["reading"]["overall_level"],
                "W": skill_est["writing"]["overall_level"],
            }

            # ── Primary focus (aspect with highest gap_total) ───
            aspect_gaps = compute_aspect_gaps(s.id, db.session)
            if aspect_gaps:
                row["primary_focus"] = aspect_gaps[0]["aspect"]   # already sorted desc
            else:
                row["primary_focus"] = None

            # ── Top 2 issues (skill_ids with highest gap) ───────
            skill_gaps = compute_skill_gap(s.id, db.session)
            row["top_issues"] = [g["skill_id"] for g in skill_gaps[:2]]

            # ── Next-level progress ─────────────────────────────
            current_level = overall_est["overall_level"]
            if current_level:
                dist = compute_next_level_distance(s.id, current_level, db.session)
                row["next_level_progress"] = dist.get("progress_to_next", 0.0)
            else:
                row["next_level_progress"] = 0.0

            # ── Evidence dates ──────────────────────────────────
            first_ev = (
                db.session.query(EvidenceEvent)
                .filter_by(student_id=s.id)
                .order_by(EvidenceEvent.timestamp.asc())
                .first()
            )
            last_ev = (
                db.session.query(EvidenceEvent)
                .filter_by(student_id=s.id)
                .order_by(EvidenceEvent.timestamp.desc())
                .first()
            )

            if first_ev:
                first_date = first_ev.timestamp.date() if hasattr(first_ev.timestamp, "date") else first_ev.timestamp
                row["start_date"]       = first_date.isoformat()
                row["weeks_since_start"] = (today - first_date).days // 7
            else:
                row["start_date"]        = None
                row["weeks_since_start"] = 0

            row["last_evidence_date"] = (
                last_ev.timestamp.isoformat() if last_ev else None
            )

            result.append(row)

        return jsonify(result), 200

    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# POST /api/students  →  cria um novo aluno
# ──────────────────────────────────────────────
@students_bp.route("/students", methods=["POST"])
def create_student():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    missing = [field for field in ("name", "start_date") if not data.get(field)]
    if missing:
        return jsonify({"error": f"Campos obrigatórios ausentes: {', '.join(missing)}."}), 400

    try:
        start_date = date.fromisoformat(data["start_date"])
    except ValueError:
        return jsonify({"error": "Formato de start_date inválido. Use YYYY-MM-DD."}), 400

    try:
        student = Student(
            name=data["name"],
            start_date=start_date,
            **{k: v for k, v in data.items() if k not in ("name", "start_date")},
        )
        db.session.add(student)
        db.session.commit()
        return jsonify(student.to_dict()), 201
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao salvar no banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# GET /api/students/<id>  →  busca por id
# ──────────────────────────────────────────────
@students_bp.route("/students/<int:id>", methods=["GET"])
def get_student(id):
    try:
        student = db.session.get(Student, id)
        if student is None:
            return jsonify({"error": f"Aluno com id {id} não encontrado."}), 404
        return jsonify(student.to_dict()), 200
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# PUT /api/students/<id>  →  atualiza campos
# ──────────────────────────────────────────────
@students_bp.route("/students/<int:id>", methods=["PUT"])
def update_student(id):
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    try:
        student = db.session.get(Student, id)
        if student is None:
            return jsonify({"error": f"Aluno com id {id} não encontrado."}), 404

        for field, value in data.items():
            if hasattr(student, field):
                setattr(student, field, value)

        db.session.commit()
        return jsonify(student.to_dict()), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao atualizar no banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# DELETE /api/students/<id>  →  remove aluno
# ──────────────────────────────────────────────
@students_bp.route("/students/<int:id>", methods=["DELETE"])
def delete_student(id):
    try:
        student = db.session.get(Student, id)
        if student is None:
            return jsonify({"error": f"Aluno com id {id} não encontrado."}), 404

        db.session.delete(student)
        db.session.commit()
        return jsonify({"message": f"Aluno com id {id} removido com sucesso."}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao remover do banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# GET /api/students/<name>/skill-states  →  lista skill states do aluno ordenados por mastery_score
# ──────────────────────────────────────────────
@students_bp.route("/students/<name>/skill-states", methods=["GET"])
def get_student_skill_states(name):
    try:
        student = Student.query.filter_by(name=name).first()
        if student is None:
            return jsonify({"error": f"Aluno com nome '{name}' não encontrado."}), 404

        # Query skill states with joined skill info, ordered by mastery_score asc
        skill_states = (
            db.session.query(StudentSkillState)
            .filter(StudentSkillState.student_id == student.id)
            .join(StudentSkillState.skill)
            .order_by(StudentSkillState.mastery_score.asc())
            .all()
        )

        # Build response with skill state data plus skill fields
        result = []
        for state in skill_states:
            state_dict = state.to_dict()
            skill = state.skill
            state_dict.update({
                "skill_id": skill.skill_id,
                "skill_domain": skill.skill_domain,
                "cefr_target": skill.cefr_target,
                "difficulty_weight": skill.difficulty_weight,
                "examples": skill.examples,
            })
            result.append(state_dict)

        return jsonify(result), 200
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# GET /api/students/<id>/level-estimate  →  estimativa de nível CEFR do aluno
# ──────────────────────────────────────────────
@students_bp.route("/students/<int:id>/level-estimate", methods=["GET"])
def get_student_level_estimate(id):
    try:
        student = db.session.get(Student, id)
        if student is None:
            return jsonify({"error": f"Aluno com id {id} não encontrado."}), 404

        # Estimativa geral
        overall = compute_level_estimate(id, db.session)

        # Estimativas por macro-habilidade
        skill_estimates = compute_all_skill_estimates(id, db.session)

        # Cobertura de evidências por macro-habilidade
        coverage = compute_evidence_coverage(id, db.session)

        # Formata resposta
        response = {
            "overall": {
                "level": overall["overall_level"],
                "confidence": overall["confidence"],
                "fit_scores": overall["fit_scores_by_level"]
            },
            "listening": {
                "level": skill_estimates["listening"]["overall_level"],
                "confidence": skill_estimates["listening"]["confidence"]
            },
            "speaking": {
                "level": skill_estimates["speaking"]["overall_level"],
                "confidence": skill_estimates["speaking"]["confidence"]
            },
            "reading": {
                "level": skill_estimates["reading"]["overall_level"],
                "confidence": skill_estimates["reading"]["confidence"]
            },
            "writing": {
                "level": skill_estimates["writing"]["overall_level"],
                "confidence": skill_estimates["writing"]["confidence"]
            },
            "evidence_coverage": coverage,
        }

        return jsonify(response), 200
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# GET /api/students/<id>/gap-analysis  →  análise de gaps do aluno
# ──────────────────────────────────────────────
@students_bp.route("/students/<int:id>/gap-analysis", methods=["GET"])
def get_student_gap_analysis(id):
    try:
        student = db.session.get(Student, id)
        if student is None:
            return jsonify({"error": f"Aluno com id {id} não encontrado."}), 404

        # Obtém o nível atual
        level_est = compute_level_estimate(id, db.session)
        current_level = level_est["overall_level"]

        if current_level is None:
            return jsonify({"error": "Não foi possível determinar o nível atual do aluno. Verifique se há dados suficientes de habilidades."}), 400

        # Computa gaps por aspecto
        aspect_gaps = compute_aspect_gaps(id, db.session)
        # Limita top_skills a 3 por aspecto
        for aspect in aspect_gaps:
            aspect["top_skills"] = aspect["top_skills"][:3]

        # Computa distância para o próximo nível
        next_dist = compute_next_level_distance(id, current_level, db.session)

        # Converte study_targets para linguagem do professor
        study_targets_descriptions = []
        for skill_id in next_dist["study_targets"]:
            skill = db.session.query(SkillNode).filter_by(skill_id=skill_id).first()
            if skill and skill.examples:
                desc = skill.examples
            elif skill:
                desc = f"{skill.skill_domain} em nível {skill.cefr_target}"
            else:
                desc = skill_id
            study_targets_descriptions.append(desc)

        # Top 5 skills com maior gap independente de aspecto
        skill_gaps = compute_skill_gap(id, db.session)
        top_5_to_fix = skill_gaps[:5]

        # Formata resposta
        response = {
            "aspect_gaps": aspect_gaps,
            "next_level_distance": {
                "percentage": next_dist["progress_to_next"],
                "study_targets": study_targets_descriptions
            },
            "top_5_to_fix": top_5_to_fix
        }

        return jsonify(response), 200
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# POST /api/students/<id>/level-override
# ──────────────────────────────────────────────
_VALID_CEFR = {"A1", "A2", "B1", "B2", "C1", "C2"}


@students_bp.route("/students/<int:id>/level-override", methods=["POST"])
def create_level_override(id):
    """
    Registra um override manual de nível CEFR para o aluno.

    Payload JSON:
        { "override_level": "B2", "reason": "aluno demonstrou desempenho acima do esperado" }

    Cria um EvidenceEvent com source_type="LevelOverride", polarity=0.
    Retorna 201 com o evento criado.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    override_level = str(data.get("override_level") or "").strip().upper()
    reason         = str(data.get("reason") or "").strip()

    if not override_level:
        return jsonify({"error": "Campo obrigatório ausente: override_level."}), 400
    if override_level not in _VALID_CEFR:
        return jsonify({
            "error": f"override_level inválido: '{override_level}'. "
                     f"Valores aceitos: {', '.join(sorted(_VALID_CEFR))}."
        }), 400
    if not reason:
        return jsonify({"error": "Campo obrigatório ausente: reason."}), 400

    try:
        student = db.session.get(Student, id)
        if student is None:
            return jsonify({"error": f"Aluno com id {id} não encontrado."}), 404

        event = EvidenceEvent(
            student_id    = id,
            source_module = "Reporting",
            source_type   = "LevelOverride",
            raw_input     = f"Level override to {override_level}",
            context       = _json.dumps({"override_level": override_level, "reason": reason}),
            polarity      = 0,
            severity      = 1,
        )
        db.session.add(event)
        db.session.commit()
        return jsonify(event.to_dict()), 201

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao salvar no banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# GET /api/students/<id>/overrides
# ──────────────────────────────────────────────
@students_bp.route("/students/<int:id>/overrides", methods=["GET"])
def get_level_overrides(id):
    """
    Retorna todos os EvidenceEvents de tipo LevelOverride do aluno,
    ordenados por timestamp desc.
    """
    try:
        student = db.session.get(Student, id)
        if student is None:
            return jsonify({"error": f"Aluno com id {id} não encontrado."}), 404

        overrides = (
            db.session.query(EvidenceEvent)
            .filter_by(student_id=id, source_type="LevelOverride")
            .order_by(EvidenceEvent.timestamp.desc())
            .all()
        )
        return jsonify([e.to_dict() for e in overrides]), 200

    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500
