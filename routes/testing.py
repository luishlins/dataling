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

testing_bp = Blueprint("testing", __name__)

# Campos obrigatórios para criação de TestItem
_ITEM_REQUIRED = ("item_type", "target_cefr", "content", "options", "correct_answer", "vocab_targets")

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

    try:
        item = TestItem(
            item_type=data["item_type"].strip(),
            target_cefr=data["target_cefr"].strip().upper(),
            content=data["content"].strip(),
            options=options_str,
            correct_answer=str(data["correct_answer"]).strip(),
            vocab_targets=vocab_targets_str,
            distractor_rationale=data.get("distractor_rationale"),
        )
        db.session.add(item)
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

    try:
        session = TestSession(
            student_id=data["student_id"],
            session_type=data["session_type"].strip(),
            notes=data.get("notes"),
        )
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
            .order_by(TestSession.applied_at.desc())
            .all()
        )
        return jsonify([s.to_dict() for s in sessions]), 200

    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


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
# POST /testing/items/import-csv
# ─────────────────────────────────────────────────────────────

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
