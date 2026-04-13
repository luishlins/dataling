"""
routes/testing.py

Blueprint para o módulo Testing.

Item bank:
  GET    /testing/items                        — lista itens (filtros: type, cefr)
  POST   /testing/items                        — cria item
  GET    /testing/items/<id>                   — busca item por id
  DELETE /testing/items/<id>                   — remove item

Sessions:
  POST   /testing/sessions                     — cria sessão
  GET    /testing/sessions/<student_id>        — lista sessões do aluno
  POST   /testing/sessions/<session_id>/results — registra resultado de um item
"""

import json

from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError

from extensions import db
from models import Student, TestItem, TestSession
from models.test_session import TestSessionResult
from services.cefr_classifier import classify_text

testing_bp = Blueprint("testing", __name__)

# Campos obrigatórios para criação de TestItem
# target_cefr é opcional: se omitido, é inferido pelo classificador CEFR
_ITEM_REQUIRED = ("item_type", "content", "options", "correct_answer", "vocab_targets")

# Campos obrigatórios para registrar resultado
_RESULT_REQUIRED = ("item_id", "student_answer", "is_correct")


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _serialize_list_field(value) -> str:
    """
    Garante que campos JSON (options, vocab_targets) sejam salvos como string.
    Aceita tanto lista Python quanto string JSON.
    """
    if isinstance(value, list):
        return json.dumps(value)
    if isinstance(value, str):
        # Valida que é JSON válido antes de salvar
        json.loads(value)
        return value
    raise ValueError("Deve ser uma lista ou string JSON válida.")


# ─────────────────────────────────────────────────────────────
# GET /testing/items
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/items", methods=["GET"])
def list_items():
    """
    Lista itens do banco. Filtros opcionais via query string:
      ?type=ReadingMCQ   — filtra por item_type (case-insensitive)
      ?cefr=B1           — filtra por target_cefr (case-insensitive)
    """
    try:
        query = TestItem.query

        item_type = request.args.get("type")
        if item_type:
            query = query.filter(
                TestItem.item_type.ilike(item_type)
            )

        cefr = request.args.get("cefr")
        if cefr:
            query = query.filter(
                TestItem.target_cefr.ilike(cefr)
            )

        items = query.order_by(TestItem.created_at.desc()).all()
        return jsonify([i.to_dict() for i in items]), 200

    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# POST /testing/items
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/items", methods=["POST"])
def create_item():
    """
    Cria um novo TestItem.

    Campos obrigatórios:
      item_type, target_cefr, content, options (lista), correct_answer, vocab_targets (lista)
    Campo opcional:
      distractor_rationale
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    missing = [f for f in _ITEM_REQUIRED if f not in data or data[f] is None]
    if missing:
        return jsonify({
            "error": f"Campos obrigatórios ausentes: {', '.join(missing)}."
        }), 400

    # Valida e normaliza campos JSON
    try:
        options_str      = _serialize_list_field(data["options"])
        vocab_targets_str = _serialize_list_field(data["vocab_targets"])
    except (ValueError, json.JSONDecodeError) as e:
        return jsonify({
            "error": f"'options' e 'vocab_targets' devem ser listas ou strings JSON válidas. Detalhe: {e}"
        }), 400

    # target_cefr fornecido explicitamente ou preenchido pelo classificador
    provided_cefr = (data.get("target_cefr") or "").strip().upper()

    try:
        item = TestItem(
            item_type=data["item_type"].strip(),
            target_cefr=provided_cefr or "PENDING",  # placeholder; substituído abaixo
            content=data["content"].strip(),
            options=options_str,
            correct_answer=str(data["correct_answer"]).strip(),
            vocab_targets=vocab_targets_str,
            distractor_rationale=data.get("distractor_rationale"),
        )
        db.session.add(item)
        db.session.flush()  # obtém id sem fechar a transação

        if not provided_cefr:
            result = classify_text(item.content)
            if result["predicted_level"]:
                item.target_cefr = result["predicted_level"]
            else:
                item.target_cefr = "UNKNOWN"

        db.session.commit()
        return jsonify(item.to_dict()), 201

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao salvar no banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# GET /testing/items/<id>
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/items/<int:item_id>", methods=["GET"])
def get_item(item_id):
    """Retorna um TestItem pelo id."""
    try:
        item = db.session.get(TestItem, item_id)
        if item is None:
            return jsonify({"error": f"Item com id {item_id} não encontrado."}), 404
        return jsonify(item.to_dict()), 200

    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# DELETE /testing/items/<id>
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/items/<int:item_id>", methods=["DELETE"])
def delete_item(item_id):
    """Remove um TestItem. Retorna 404 se não existir."""
    try:
        item = db.session.get(TestItem, item_id)
        if item is None:
            return jsonify({"error": f"Item com id {item_id} não encontrado."}), 404

        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": f"Item {item_id} removido com sucesso."}), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao remover do banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# POST /testing/sessions
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/sessions", methods=["POST"])
def create_session():
    """
    Cria uma nova TestSession.

    Campos obrigatórios: student_id, session_type
    Campo opcional:      notes
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    missing = [f for f in ("student_id", "session_type") if not data.get(f)]
    if missing:
        return jsonify({
            "error": f"Campos obrigatórios ausentes: {', '.join(missing)}."
        }), 400

    # Verifica se o aluno existe
    student = db.session.get(Student, data["student_id"])
    if student is None:
        return jsonify({
            "error": f"Student com id {data['student_id']} não encontrado."
        }), 400

    session_type = data["session_type"].strip()
    if session_type not in {"Proficiency", "Reading", "Listening", "Speaking", "Writing",
                            "ReadingMCQ", "VideoUnderstanding", "PronunciationTask",
                            "FreeSpeaking", "WritingTask", "Dictation"}:
        return jsonify({"error": f"session_type inválido: '{session_type}'."}), 400

    try:
        kwargs = dict(
            student_id=data["student_id"],
            session_type=session_type,
            notes=data.get("notes"),
        )
        if data.get("duration_minutes") is not None:
            kwargs["duration_minutes"] = int(data["duration_minutes"])
        if data.get("session_date"):
            from datetime import datetime
            kwargs["session_date"] = datetime.fromisoformat(data["session_date"])

        session = TestSession(**kwargs)
        db.session.add(session)
        db.session.commit()
        return jsonify(session.to_dict()), 201

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao salvar no banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# GET /testing/sessions/<student_id>
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/sessions/<int:student_id>", methods=["GET"])
def list_sessions(student_id):
    """
    Lista todas as TestSessions de um aluno, ordenadas por applied_at DESC.
    Retorna 404 se o aluno não existir.
    """
    student = db.session.get(Student, student_id)
    if student is None:
        return jsonify({"error": f"Student com id {student_id} não encontrado."}), 404

    try:
        sessions = (
            TestSession.query
            .filter_by(student_id=student_id)
            .order_by(TestSession.session_date.desc())
            .all()
        )
        return jsonify([s.to_dict() for s in sessions]), 200

    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# PATCH /testing/sessions/<session_id>
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/sessions/<int:session_id>", methods=["PATCH"])
def update_session(session_id):
    """
    Atualiza overall_result e/ou duration_minutes ao finalizar uma sessão.

    Campos aceitos (todos opcionais):
      overall_result   — dict com o resumo pós-teste
      duration_minutes — int
      notes            — string
    """
    session = db.session.get(TestSession, session_id)
    if session is None:
        return jsonify({"error": f"Sessão com id {session_id} não encontrada."}), 404

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    if "overall_result" in data:
        if not isinstance(data["overall_result"], dict):
            return jsonify({"error": "'overall_result' deve ser um objeto JSON."}), 400
        session.set_overall_result(data["overall_result"])

    if "duration_minutes" in data:
        try:
            session.duration_minutes = int(data["duration_minutes"])
        except (TypeError, ValueError):
            return jsonify({"error": "'duration_minutes' deve ser um inteiro."}), 400

    if "notes" in data:
        session.notes = data["notes"]

    try:
        db.session.commit()
        return jsonify(session.to_dict()), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao atualizar no banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# POST /testing/sessions/<session_id>/results
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/sessions/<int:session_id>/results", methods=["POST"])
def add_result(session_id):
    """
    Registra o resultado de um item dentro de uma sessão.

    Campos obrigatórios: item_id, student_answer, is_correct
    """
    # Verifica se a sessão existe
    session = db.session.get(TestSession, session_id)
    if session is None:
        return jsonify({"error": f"Sessão com id {session_id} não encontrada."}), 404

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    missing = [f for f in _RESULT_REQUIRED if f not in data or data[f] is None]
    if missing:
        return jsonify({
            "error": f"Campos obrigatórios ausentes: {', '.join(missing)}."
        }), 400

    # Valida is_correct
    if not isinstance(data["is_correct"], bool):
        return jsonify({"error": "'is_correct' deve ser true ou false."}), 400

    # Verifica se o item existe
    item = db.session.get(TestItem, data["item_id"])
    if item is None:
        return jsonify({
            "error": f"TestItem com id {data['item_id']} não encontrado."
        }), 400

    # Evita registrar o mesmo item duas vezes na mesma sessão
    existing = TestSessionResult.query.filter_by(
        session_id=session_id, item_id=data["item_id"]
    ).first()
    if existing:
        return jsonify({
            "error": f"Item {data['item_id']} já foi registrado nesta sessão.",
            "existing_result_id": existing.id,
        }), 409

    try:
        result = TestSessionResult(
            session_id=session_id,
            item_id=data["item_id"],
            student_answer=str(data["student_answer"]).strip(),
            is_correct=data["is_correct"],
        )
        db.session.add(result)
        db.session.commit()
        return jsonify(result.to_dict()), 201

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao salvar no banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# POST /api/testing/classify-text
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/classify-text", methods=["POST"])
def classify_text_route():
    """
    Classifica o nivel CEFR de um texto em ingles.

    Payload: {"text": "<texto>"}
    Resposta 200: {"predicted_level": str|null, "confidence": float, "message": str}
    Resposta 400: {"error": "campo text obrigatorio"}
    """
    data = request.get_json(silent=True) or {}
    text = data.get("text")
    if not text or not isinstance(text, str) or not text.strip():
        return jsonify({"error": "campo text obrigatorio"}), 400

    return jsonify(classify_text(text.strip())), 200


# ─────────────────────────────────────────────────────────────
# POST /testing/items/import-csv
# ─────────────────────────────────────────────────────────────

from services.test_targeter import (
    select_items_for_session,
    compute_item_relevance,
    select_next_item_adaptive,
)


# ─────────────────────────────────────────────────────────────
# GET /testing/suggest-items/<student_id>
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/suggest-items/<int:student_id>", methods=["GET"])
def suggest_items(student_id):
    """
    Retorna itens sugeridos para uma sessão, ordenados por relevância.

    Query params:
      session_type  — tipo de item a filtrar (default: ReadingMCQ)
      n             — número de itens a retornar (default: 5, max: 20)

    Resposta 200:
      [{ ...item_fields, relevance_score: float }, ...]
    """
    student = db.session.get(Student, student_id)
    if student is None:
        return jsonify({"error": f"Student com id {student_id} não encontrado."}), 404

    session_type = request.args.get("session_type", "ReadingMCQ").strip()
    try:
        n = max(1, min(20, int(request.args.get("n", 5))))
    except (TypeError, ValueError):
        n = 5

    try:
        items = select_items_for_session(student_id, session_type, n, db.session)
        result = []
        for item in items:
            score = compute_item_relevance(student_id, item.id, db.session)
            d = item.to_dict()
            d["relevance_score"] = round(score, 4)
            result.append(d)
        return jsonify(result), 200

    except Exception as e:  # noqa: BLE001
        return jsonify({"error": "Erro ao calcular sugestões.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# POST /testing/sessions/<session_id>/next-item
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/sessions/<int:session_id>/next-item", methods=["POST"])
def next_item(session_id):
    """
    Retorna o próximo item para uma sessão CAT, ajustando o nível estimado.

    Payload obrigatório:
      last_answer_correct      — bool
      current_level_estimate   — str (ex: "B1", "B1+")

    Resposta 200:
      {
        "next_item": { ...item_fields, relevance_score: float } | null,
        "current_level_estimate": "B1+"
      }
    """
    session = db.session.get(TestSession, session_id)
    if session is None:
        return jsonify({"error": f"Sessão com id {session_id} não encontrada."}), 404

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    if "last_answer_correct" not in data or not isinstance(data["last_answer_correct"], bool):
        return jsonify({"error": "'last_answer_correct' obrigatório (true ou false)."}), 400

    current_level = (data.get("current_level_estimate") or "B1").strip()

    try:
        item, adjusted_level = select_next_item_adaptive(
            student_id=session.student_id,
            session_id=session_id,
            last_answer_correct=data["last_answer_correct"],
            current_level_estimate=current_level,
            db_session=db.session,
        )

        if item is None:
            return jsonify({"next_item": None, "current_level_estimate": adjusted_level}), 200

        d = item.to_dict()
        d["relevance_score"] = round(compute_item_relevance(session.student_id, item.id, db.session), 4)
        return jsonify({"next_item": d, "current_level_estimate": adjusted_level}), 200

    except Exception as e:  # noqa: BLE001
        return jsonify({"error": "Erro ao selecionar próximo item.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# POST /testing/calibrate-items
# ─────────────────────────────────────────────────────────────

@testing_bp.route("/testing/calibrate-items", methods=["POST"])
def calibrate_items():
    """
    Recalcula metadados de calibração para todos os TestItems que têm respostas.

    Para cada item:
      response_count       = nº total de respostas (TestSessionResult)
      correct_count        = nº de respostas corretas
      empirical_difficulty = 1 − correct_count / response_count

    Resposta 200:
      { "calibrated": N, "skipped": M }
      (skipped = itens sem nenhuma resposta)
    """
    from models.test_session import TestSessionResult as _TSR
    from sqlalchemy import func

    try:
        # Agrega por item_id: total e corretos
        agg = (
            db.session.query(
                _TSR.item_id,
                func.count(_TSR.id).label("total"),
                func.sum(db.cast(_TSR.is_correct, db.Integer)).label("correct"),
            )
            .group_by(_TSR.item_id)
            .all()
        )

        calibrated = 0
        skipped    = 0

        all_items = db.session.query(TestItem).all()
        agg_map = {row.item_id: row for row in agg}

        for item in all_items:
            row = agg_map.get(item.id)
            if row is None or row.total == 0:
                skipped += 1
                continue

            item.response_count = int(row.total)
            item.correct_count  = int(row.correct or 0)
            item.empirical_difficulty = round(
                1.0 - item.correct_count / item.response_count, 4
            )
            calibrated += 1

        db.session.commit()
        return jsonify({"calibrated": calibrated, "skipped": skipped}), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao calibrar itens.", "details": str(e)}), 500


import csv
import io as _io

# Colunas obrigatórias no CSV
_CSV_REQUIRED = {
    "title", "target_cefr", "base_text",
    "question", "option_a", "option_b", "option_c", "option_d",
    "correct_option", "question_cefr", "question_type",
}
_VALID_QUESTION_TYPES = {"grammar", "vocabulary"}
_VALID_CEFR = {"A1", "A2", "B1", "B2", "C1", "C2"}
_VALID_OPTIONS = {"a", "b", "c", "d", "e"}


@testing_bp.route("/testing/items/import-csv", methods=["POST"])
def import_items_csv():
    """
    Importa TestItems do tipo ReadingMCQ a partir de um CSV
    enviado via multipart/form-data no campo 'file'.

    Estrutura do CSV:
      title           — agrupa questões da mesma atividade de leitura
      target_cefr     — nível CEFR da atividade (ex: B1)
      base_text       — texto base (repetido em cada linha da mesma atividade)
      question        — enunciado da questão
      option_a..d     — alternativas obrigatórias
      option_e        — alternativa opcional
      correct_option  — letra da resposta correta (a-e)
      question_cefr   — nível CEFR específico da questão
      question_type   — "grammar" ou "vocabulary"

    Resposta 200:
      { "imported": N, "errors": [...] }
    """

    # ── 1. Valida arquivo ────────────────────────────────────
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado. Use o campo 'file' no form-data."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Nome de arquivo vazio."}), 400
    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "O arquivo deve ter extensão .csv."}), 400

    try:
        raw = file.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return jsonify({"error": "Não foi possível decodificar o arquivo. Use UTF-8."}), 400

    reader = csv.DictReader(_io.StringIO(raw))

    if reader.fieldnames is None:
        return jsonify({"error": "O arquivo CSV está vazio ou sem cabeçalho."}), 400

    # ── 2. Valida colunas obrigatórias no header ─────────────
    found = {f.strip().lower() for f in reader.fieldnames}
    missing_cols = _CSV_REQUIRED - found
    if missing_cols:
        return jsonify({
            "error": f"Coluna(s) obrigatória(s) ausente(s): {', '.join(sorted(missing_cols))}.",
            "found_columns": list(reader.fieldnames),
        }), 400

    # ── 3. Processa linhas ───────────────────────────────────
    items_to_add = []
    errors       = []

    for row_num, raw_row in enumerate(reader, start=2):
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}

        # --- Campos obrigatórios presentes e não vazios ---
        empty = [c for c in _CSV_REQUIRED if not row.get(c)]
        if empty:
            errors.append({
                "row": row_num,
                "reason": f"Campo(s) obrigatório(s) vazio(s): {', '.join(sorted(empty))}.",
            })
            continue

        # --- Valida correct_option ---
        correct = row["correct_option"].lower()
        if correct not in _VALID_OPTIONS:
            errors.append({
                "row": row_num,
                "reason": f"'correct_option' inválido: '{correct}'. Use a, b, c, d ou e.",
            })
            continue

        # --- Valida que a opção correta existe no CSV ---
        option_col = f"option_{correct}"
        if not row.get(option_col):
            errors.append({
                "row": row_num,
                "reason": f"'correct_option' é '{correct}' mas a coluna '{option_col}' está vazia.",
            })
            continue

        # --- Valida question_type ---
        q_type = row["question_type"].lower()
        if q_type not in _VALID_QUESTION_TYPES:
            errors.append({
                "row": row_num,
                "reason": f"'question_type' inválido: '{q_type}'. Use 'grammar' ou 'vocabulary'.",
            })
            continue

        # --- Valida CEFRs ---
        for cefr_col in ("target_cefr", "question_cefr"):
            val = row[cefr_col].upper()
            if val not in _VALID_CEFR:
                errors.append({
                    "row": row_num,
                    "reason": f"'{cefr_col}' inválido: '{val}'. Use A1, A2, B1, B2, C1 ou C2.",
                })
                break
        else:
            # --- Monta options como lista JSON ---
            options = [
                row["option_a"],
                row["option_b"],
                row["option_c"],
                row["option_d"],
            ]
            if row.get("option_e"):
                options.append(row["option_e"])

            # --- content = base_text + separador + question ---
            content = f"{row['base_text']}\n\n---\n\n{row['question']}"

            # --- vocab_targets = title + question_type (usado pelo auto-tagger) ---
            vocab_targets = json.dumps([row["title"], q_type])

            items_to_add.append(TestItem(
                item_type="ReadingMCQ",
                target_cefr=row["target_cefr"].upper(),
                content=content,
                options=json.dumps(options),
                correct_answer=correct.upper(),
                vocab_targets=vocab_targets,
                distractor_rationale=row.get("distractor_rationale") or None,
            ))

    # ── 4. Persiste em batch ─────────────────────────────────
    imported = 0
    if items_to_add:
        try:
            db.session.add_all(items_to_add)
            db.session.commit()
            imported = len(items_to_add)
        except SQLAlchemyError as e:
            db.session.rollback()
            return jsonify({
                "error": "Erro ao salvar no banco de dados.",
                "details": str(e),
            }), 500

    return jsonify({
        "imported": imported,
        "errors":   errors,
    }), 200


# ─────────────────────────────────────────────────────────────
# Checklist routes
# ─────────────────────────────────────────────────────────────

from models.checklist_item import ChecklistItem
from models.checklist_response import ChecklistResponse

# Dimensions with highest relevance for A2-B1 learners
# Used by the /recommended route until adaptive logic is implemented in Phase 3
_A2_B1_PRIORITY_DIMENSIONS = {
    "Fluency",
    "GrammarAccuracy",
    "LexicalRange",
    "PronunciationSound",
    "Coherence",
}


# ── GET /testing/checklist ────────────────────────────────────

@testing_bp.route("/testing/checklist", methods=["GET"])
def list_checklist():
    """
    Lista todos os 72 itens do checklist de fala, agrupados por dimensão.
    Suporta filtro opcional: ?dimension=Fluency
    """
    try:
        query = ChecklistItem.query

        dimension = request.args.get("dimension")
        if dimension:
            query = query.filter(ChecklistItem.dimension == dimension)

        items = query.order_by(ChecklistItem.dimension, ChecklistItem.check_id).all()
        return jsonify([i.to_dict() for i in items]), 200

    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ── GET /testing/checklist/recommended/<student_id> ───────────

@testing_bp.route("/testing/checklist/recommended/<int:student_id>", methods=["GET"])
def recommended_checklist(student_id):
    """
    Retorna subconjunto recomendado do checklist baseado no nível estimado do aluno.

    Fase 2 (atual): retorna todos os itens das dimensões de maior relevância
    para níveis A2-B1, filtrados também por typical_cefr_floor <= nível do aluno.

    Fase 3: lógica adaptativa completa baseada em EvidenceEvents acumulados.
    """
    student = db.session.get(Student, student_id)
    if student is None:
        return jsonify({"error": f"Student com id {student_id} não encontrado."}), 404

    try:
        # Base: dimensões prioritárias para A2-B1
        query = ChecklistItem.query.filter(
            ChecklistItem.dimension.in_(_A2_B1_PRIORITY_DIMENSIONS)
        )

        # Se o aluno tem target_level definido, incluir também itens
        # das outras dimensões cujo floor seja <= ao nível do aluno
        target = student.target_level
        if target:
            cefr_order = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
            student_rank = cefr_order.get(target.upper(), 3)

            # Include all items where typical_cefr_floor is null or <= student level
            from sqlalchemy import or_
            all_items = ChecklistItem.query.filter(
                or_(
                    ChecklistItem.typical_cefr_floor.is_(None),
                    ChecklistItem.typical_cefr_floor.in_([
                        lvl for lvl, rank in cefr_order.items()
                        if rank <= student_rank
                    ])
                )
            ).order_by(ChecklistItem.dimension, ChecklistItem.check_id).all()
        else:
            # No target level — return priority dimensions only
            all_items = query.order_by(
                ChecklistItem.dimension, ChecklistItem.check_id
            ).all()

        return jsonify({
            "student_id":    student_id,
            "target_level":  target,
            "total":         len(all_items),
            "note":          "Phase 2 recommendation — adaptive logic coming in Phase 3.",
            "items":         [i.to_dict() for i in all_items],
        }), 200

    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ── POST /testing/sessions/<session_id>/checklist ────────────

@testing_bp.route("/testing/sessions/<int:session_id>/checklist", methods=["POST"])
def submit_checklist(session_id):
    """
    Recebe lista de respostas yes/no e salva no banco.
    Calcula score por dimensão e score global.

    Payload:
        {
            "responses": [
                {"check_id": "FL_001", "response": true},
                {"check_id": "FL_002", "response": false},
                ...
            ]
        }

    Resposta:
        {
            "session_id": 1,
            "saved": 12,
            "skipped": 2,          # already answered in this session
            "errors": [...],
            "scores": {
                "Fluency": {"yes": 8, "total": 10, "pct": 80.0},
                ...
                "overall": {"yes": 58, "total": 72, "pct": 80.6}
            }
        }
    """
    session = db.session.get(TestSession, session_id)
    if session is None:
        return jsonify({"error": f"Sessão com id {session_id} não encontrada."}), 404

    data = request.get_json(silent=True)
    if not data or "responses" not in data:
        return jsonify({"error": "Payload deve conter campo 'responses' com lista de respostas."}), 400

    responses = data["responses"]
    if not isinstance(responses, list) or not responses:
        return jsonify({"error": "'responses' deve ser uma lista não vazia."}), 400

    # Load valid check_ids into a set for fast lookup
    valid_check_ids = {
        row[0] for row in db.session.execute(
            db.select(ChecklistItem.check_id)
        ).all()
    }

    # Load already-answered check_ids for this session
    existing = {
        row[0] for row in db.session.execute(
            db.select(ChecklistResponse.check_id).where(
                ChecklistResponse.session_id == session_id
            )
        ).all()
    }

    to_add  = []
    skipped = []
    errors  = []

    for i, entry in enumerate(responses):
        if not isinstance(entry, dict):
            errors.append({"index": i, "reason": "Each entry must be an object with check_id and response."})
            continue

        check_id = entry.get("check_id", "").strip()
        response = entry.get("response")

        if not check_id:
            errors.append({"index": i, "reason": "Missing 'check_id'."})
            continue

        if response is None or not isinstance(response, bool):
            errors.append({"index": i, "check_id": check_id, "reason": "'response' must be true or false."})
            continue

        if check_id not in valid_check_ids:
            errors.append({"index": i, "check_id": check_id, "reason": f"check_id '{check_id}' not found in checklist."})
            continue

        if check_id in existing:
            skipped.append(check_id)
            continue

        to_add.append(ChecklistResponse(
            session_id=session_id,
            check_id=check_id,
            response=response,
        ))
        existing.add(check_id)  # prevent duplicates within the same payload

    # Persist
    saved = 0
    if to_add:
        try:
            db.session.add_all(to_add)
            db.session.commit()
            saved = len(to_add)
        except SQLAlchemyError as e:
            db.session.rollback()
            return jsonify({"error": "Erro ao salvar no banco.", "details": str(e)}), 500

    # ── Score calculation ─────────────────────────────────────
    # Load ALL responses for this session (including previously saved ones)
    all_responses = db.session.execute(
        db.select(
            ChecklistResponse.check_id,
            ChecklistResponse.response,
            ChecklistItem.dimension,
            ChecklistItem.weight,
        )
        .join(ChecklistItem, ChecklistItem.check_id == ChecklistResponse.check_id)
        .where(ChecklistResponse.session_id == session_id)
    ).all()

    # Aggregate by dimension
    dim_scores: dict[str, dict] = {}
    total_yes    = 0.0
    total_weight = 0.0

    for _, response, dimension, weight in all_responses:
        if dimension not in dim_scores:
            dim_scores[dimension] = {"yes": 0.0, "total": 0.0}
        dim_scores[dimension]["total"] += weight
        if response:
            dim_scores[dimension]["yes"] += weight
        total_weight += weight
        if response:
            total_yes += weight

    scores = {
        dim: {
            "yes":   round(v["yes"], 2),
            "total": round(v["total"], 2),
            "pct":   round(v["yes"] / v["total"] * 100, 1) if v["total"] else 0.0,
        }
        for dim, v in sorted(dim_scores.items())
    }
    scores["overall"] = {
        "yes":   round(total_yes, 2),
        "total": round(total_weight, 2),
        "pct":   round(total_yes / total_weight * 100, 1) if total_weight else 0.0,
    }

    return jsonify({
        "session_id": session_id,
        "saved":      saved,
        "skipped":    skipped,
        "errors":     errors,
        "scores":     scores,
    }), 200
