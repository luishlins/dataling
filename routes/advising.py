"""
routes/advising.py

Blueprint para o módulo Advising.

Rotas:
  GET    /advising/<student_id>/profile   — retorna campos de perfil do aluno
  PUT    /advising/<student_id>/profile   — atualiza campos de perfil do aluno
  GET    /advising/<student_id>/vocab     — lista AdvisedVocabItems do aluno
  POST   /advising/<student_id>/vocab     — cria novo AdvisedVocabItem
  DELETE /advising/<student_id>/vocab/<item_id>        — remove um AdvisedVocabItem
  POST   /advising/<student_id>/vocab/import-csv       — importa itens via CSV
"""

import csv
import io

from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError

from extensions import db
from models import Student, AdvisedVocabItem

advising_bp = Blueprint("advising", __name__)

# Campos do perfil que esta rota pode ler/atualizar no modelo Student
_PROFILE_FIELDS = (
    "job_title",
    "typical_tasks",
    "speaking_environments",
    "accent_constraints",
    "target_level",
    "target_date",
    "test_purpose",
)

# Campos aceitos na criação de um AdvisedVocabItem
_VOCAB_REQUIRED = ("term",)
_VOCAB_OPTIONAL = ("domain", "subdomain", "situation", "priority_weight", "is_multiword")

# Coluna obrigatória no CSV
_CSV_REQUIRED_COLS = {"term"}
# Colunas opcionais reconhecidas
_CSV_OPTIONAL_COLS = {"domain", "subdomain", "situation", "priority_weight", "is_multiword"}
# Todas as colunas válidas
_CSV_ALL_COLS = _CSV_REQUIRED_COLS | _CSV_OPTIONAL_COLS


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _get_student_or_404(student_id: int):
    """Retorna o Student ou uma tupla (response, 404) pronta para return."""
    student = db.session.get(Student, student_id)
    if student is None:
        return None, (jsonify({"error": f"Student {student_id} not found"}), 404)
    return student, None


# ─────────────────────────────────────────────────────────────
# GET /advising/<student_id>/profile
# ─────────────────────────────────────────────────────────────

@advising_bp.route("/advising/<int:student_id>/profile", methods=["GET"])
def get_profile(student_id):
    student, err = _get_student_or_404(student_id)
    if err:
        return err

    profile = {field: getattr(student, field) for field in _PROFILE_FIELDS}
    return jsonify({"student_id": student_id, "profile": profile}), 200


# ─────────────────────────────────────────────────────────────
# PUT /advising/<student_id>/profile
# ─────────────────────────────────────────────────────────────

@advising_bp.route("/advising/<int:student_id>/profile", methods=["PUT"])
def update_profile(student_id):
    student, err = _get_student_or_404(student_id)
    if err:
        return err

    if not request.is_json:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    data = request.get_json()

    # Valida que todos os campos são conhecidos
    unknown_fields = set(data.keys()) - set(_PROFILE_FIELDS)
    if unknown_fields:
        return jsonify({
            "error": f"Campo(s) desconhecido(s): {', '.join(sorted(unknown_fields))}.",
            "valid_fields": list(_PROFILE_FIELDS),
        }), 400

    # Atualiza apenas os campos fornecidos
    for field in _PROFILE_FIELDS:
        if field in data:
            setattr(student, field, data[field])

    try:
        db.session.commit()
        profile = {field: getattr(student, field) for field in _PROFILE_FIELDS}
        return jsonify({"student_id": student_id, "profile": profile}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao atualizar o banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# POST /advising/<student_id>/vocab/import-csv
# ─────────────────────────────────────────────────────────────

@advising_bp.route("/advising/<int:student_id>/vocab/import-csv", methods=["POST"])
def import_vocab_csv(student_id):
    """
    Importa AdvisedVocabItems a partir de um arquivo CSV enviado via
    multipart/form-data no campo 'file'.

    Colunas do CSV:
      Obrigatória : term
      Opcionais   : domain, subdomain, situation, priority_weight, is_multiword

    Resposta 200:
      {
        "imported": 12,
        "skipped":  [{"row": 3, "term": "pull request", "reason": "already exists"}],
        "errors":   [{"row": 5, "reason": "missing required column: term"}]
      }

    A importação é best-effort: linhas com erro são registradas em 'errors'
    e o restante é importado normalmente (sem rollback total).
    """
    _, err = _get_student_or_404(student_id)
    if err:
        return err

    # ── 1. Valida presença do arquivo ─────────────────────────
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado. Use o campo 'file' no form-data."}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Nome de arquivo vazio."}), 400

    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "O arquivo deve ter extensão .csv."}), 400

    # ── 2. Lê e decodifica o CSV ──────────────────────────────
    try:
        raw = file.read().decode("utf-8-sig")  # utf-8-sig remove BOM do Excel
    except UnicodeDecodeError:
        return jsonify({"error": "Não foi possível decodificar o arquivo. Use UTF-8."}), 400

    reader = csv.DictReader(io.StringIO(raw))

    # ── 3. Valida que a coluna obrigatória existe no header ───
    if reader.fieldnames is None:
        return jsonify({"error": "O arquivo CSV está vazio ou sem cabeçalho."}), 400

    # Normaliza nomes de colunas (strip + lowercase)
    fieldnames_normalized = {f.strip().lower() for f in reader.fieldnames}
    missing_cols = _CSV_REQUIRED_COLS - fieldnames_normalized
    if missing_cols:
        return jsonify({
            "error": f"Coluna(s) obrigatória(s) ausente(s) no CSV: {', '.join(sorted(missing_cols))}.",
            "found_columns": list(reader.fieldnames),
        }), 400

    # ── 4. Carrega terms já existentes para detecção de duplicatas ──
    existing_terms = {
        row[0].lower()
        for row in db.session.execute(
            db.select(AdvisedVocabItem.term).where(
                AdvisedVocabItem.student_id == student_id
            )
        ).all()
    }

    # ── 5. Processa cada linha ────────────────────────────────
    imported = 0
    skipped  = []
    errors   = []
    items_to_add = []

    for row_num, raw_row in enumerate(reader, start=2):  # start=2: linha 1 é o header
        # Normaliza chaves da linha
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}

        term = row.get("term", "").strip()

        # Valida term presente e não vazio
        if not term:
            errors.append({
                "row": row_num,
                "term": None,
                "reason": "'term' está vazio ou ausente nesta linha.",
            })
            continue

        # Verifica duplicata (case-insensitive)
        if term.lower() in existing_terms:
            skipped.append({
                "row": row_num,
                "term": term,
                "reason": "already exists for this student",
            })
            continue

        # Valida e converte priority_weight
        priority_weight = 1.0
        raw_pw = row.get("priority_weight", "")
        if raw_pw:
            try:
                priority_weight = float(raw_pw)
            except ValueError:
                errors.append({
                    "row": row_num,
                    "term": term,
                    "reason": f"'priority_weight' inválido: '{raw_pw}'. Deve ser um número.",
                })
                continue

        # Converte is_multiword de string para bool
        raw_mw = row.get("is_multiword", "").lower()
        if raw_mw in ("true", "1", "yes"):
            is_multiword = True
        elif raw_mw in ("false", "0", "no", ""):
            is_multiword = False
        else:
            errors.append({
                "row": row_num,
                "term": term,
                "reason": f"'is_multiword' inválido: '{raw_mw}'. Use true/false.",
            })
            continue

        items_to_add.append(AdvisedVocabItem(
            student_id=student_id,
            term=term,
            domain=row.get("domain") or None,
            subdomain=row.get("subdomain") or None,
            situation=row.get("situation") or None,
            priority_weight=priority_weight,
            is_multiword=is_multiword,
        ))

        # Adiciona ao set local para evitar duplicatas dentro do próprio CSV
        existing_terms.add(term.lower())

    # ── 6. Persiste todos os itens válidos de uma vez ─────────
    try:
        if items_to_add:
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
        "skipped":  skipped,
        "errors":   errors,
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /advising/<student_id>/vocab
# ─────────────────────────────────────────────────────────────

@advising_bp.route("/advising/<int:student_id>/vocab", methods=["GET"])
def list_vocab(student_id):
    student, err = _get_student_or_404(student_id)
    if err:
        return err

    try:
        items = db.session.execute(
            db.select(AdvisedVocabItem).where(
                AdvisedVocabItem.student_id == student_id
            ).order_by(AdvisedVocabItem.created_at)
        ).scalars().all()

        return jsonify([item.to_dict() for item in items]), 200
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# POST /advising/<student_id>/vocab
# ─────────────────────────────────────────────────────────────

@advising_bp.route("/advising/<int:student_id>/vocab", methods=["POST"])
def create_vocab_item(student_id):
    student, err = _get_student_or_404(student_id)
    if err:
        return err

    if not request.is_json:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    data = request.get_json()

    # Valida campos obrigatórios
    missing = set(_VOCAB_REQUIRED) - set(data.keys())
    if missing:
        return jsonify({
            "error": f"Campo(s) obrigatório(s) ausente(s): {', '.join(sorted(missing))}.",
            "required_fields": list(_VOCAB_REQUIRED),
        }), 400

    # Valida que todos os campos são conhecidos
    all_allowed = set(_VOCAB_REQUIRED) | set(_VOCAB_OPTIONAL)
    unknown = set(data.keys()) - all_allowed
    if unknown:
        return jsonify({
            "error": f"Campo(s) desconhecido(s): {', '.join(sorted(unknown))}.",
            "allowed_fields": sorted(all_allowed),
        }), 400

    # Validações específicas
    if not isinstance(data["term"], str) or not data["term"].strip():
        return jsonify({"error": "'term' deve ser uma string não vazia."}), 400

    priority_weight = data.get("priority_weight", 1.0)
    if not isinstance(priority_weight, (int, float)) or priority_weight <= 0:
        return jsonify({"error": "'priority_weight' deve ser um número positivo."}), 400

    is_multiword = data.get("is_multiword", False)
    if not isinstance(is_multiword, bool):
        return jsonify({"error": "'is_multiword' deve ser true ou false."}), 400

    # Verifica duplicata
    existing = db.session.execute(
        db.select(AdvisedVocabItem).where(
            AdvisedVocabItem.student_id == student_id,
            AdvisedVocabItem.term.ilike(data["term"].strip())
        )
    ).scalar_one_or_none()

    if existing:
        return jsonify({"error": f"Term '{data['term']}' already exists for this student."}), 409

    item = AdvisedVocabItem(
        student_id=student_id,
        term=data["term"].strip(),
        domain=data.get("domain"),
        subdomain=data.get("subdomain"),
        situation=data.get("situation"),
        priority_weight=priority_weight,
        is_multiword=is_multiword,
    )

    try:
        db.session.add(item)
        db.session.commit()
        return jsonify(item.to_dict()), 201
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao salvar no banco de dados.", "details": str(e)}), 500


# ─────────────────────────────────────────────────────────────
# DELETE /advising/<student_id>/vocab/<item_id>
# ─────────────────────────────────────────────────────────────

@advising_bp.route("/advising/<int:student_id>/vocab/<int:item_id>", methods=["DELETE"])
def delete_vocab_item(student_id, item_id):
    student, err = _get_student_or_404(student_id)
    if err:
        return err

    item = db.session.get(AdvisedVocabItem, item_id)
    if item is None or item.student_id != student_id:
        return jsonify({"error": f"AdvisedVocabItem {item_id} not found for student {student_id}."}), 404

    try:
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": f"AdvisedVocabItem {item_id} deleted."}), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao deletar do banco de dados.", "details": str(e)}), 500
