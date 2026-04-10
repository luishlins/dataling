"""
routes/analytics.py

Blueprint para o módulo Analytics.

Rotas:
  GET /analytics/<student_id>/gaps              — gaps por skill, ordenados por gap desc
  GET /analytics/<student_id>/aspect-gaps       — gaps agrupados por macro-habilidade
  GET /analytics/<student_id>/next-level        — distância ao próximo nível CEFR
"""

from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError

from extensions import db
from models import Student
from services.gap_analyzer import (
    compute_skill_gap,
    compute_aspect_gaps,
    compute_next_level_distance,
)

analytics_bp = Blueprint("analytics", __name__)


def _get_student_or_404(student_id: int):
    student = db.session.get(Student, student_id)
    if student is None:
        return None, (jsonify({"error": f"Student com id {student_id} não encontrado."}), 404)
    return student, None


# ─────────────────────────────────────────────────────────────
# GET /analytics/<student_id>/gaps
# ─────────────────────────────────────────────────────────────

@analytics_bp.route("/analytics/<int:student_id>/gaps", methods=["GET"])
def skill_gaps(student_id):
    """
    Retorna todos os gaps de habilidade do aluno, ordenados por gap decrescente.
    gap = difficulty_weight * (1 - mastery_score)

    Query params opcionais:
      ?domain=grammar      — filtra por skill_domain
      ?cefr=B1             — filtra por cefr_target
      ?limit=10            — limita número de resultados
    """
    student, err = _get_student_or_404(student_id)
    if err:
        return err

    try:
        gaps = compute_skill_gap(student_id, db.session)
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500

    # Filtros opcionais
    domain = request.args.get("domain")
    if domain:
        gaps = [g for g in gaps if g["skill_domain"] == domain]

    cefr = request.args.get("cefr", "").upper()
    if cefr:
        gaps = [g for g in gaps if g["cefr_target"] == cefr]

    limit = request.args.get("limit")
    if limit:
        try:
            gaps = gaps[:int(limit)]
        except ValueError:
            return jsonify({"error": "'limit' deve ser um inteiro."}), 400

    return jsonify({
        "student_id": student_id,
        "total":      len(gaps),
        "gaps":       gaps,
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /analytics/<student_id>/aspect-gaps
# ─────────────────────────────────────────────────────────────

@analytics_bp.route("/analytics/<int:student_id>/aspect-gaps", methods=["GET"])
def aspect_gaps(student_id):
    """
    Retorna gaps agrupados por macro-habilidade:
      listening | speaking | reading | writing

    Ordenados por gap_total decrescente.
    Cada aspecto inclui os top 5 skills com maior gap.
    """
    _, err = _get_student_or_404(student_id)
    if err:
        return err

    try:
        gaps = compute_aspect_gaps(student_id, db.session)
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500

    return jsonify({
        "student_id": student_id,
        "aspects":    gaps,
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /analytics/<student_id>/next-level
# ─────────────────────────────────────────────────────────────

@analytics_bp.route("/analytics/<int:student_id>/next-level", methods=["GET"])
def next_level_distance(student_id):
    """
    Calcula a distância do aluno ao próximo nível CEFR.

    Query param obrigatório:
      ?level=B1    — nível atual do aluno (A1, A2, B1, B2, C1, C2)

    Retorna:
      - progress_to_next  : % de gatekeeper skills dominadas
      - top_clusters      : top 3 domínios com maior gap médio
      - study_targets     : top 5 skill_ids prioritários para estudo
      - gatekeeper_detail : detalhe de cada gatekeeper skill
    """
    _, err = _get_student_or_404(student_id)
    if err:
        return err

    level = request.args.get("level", "").strip()
    if not level:
        # Tenta usar o target_level do perfil do aluno como fallback
        student = db.session.get(Student, student_id)
        level = student.target_level or ""

    if not level:
        return jsonify({
            "error": "Parâmetro 'level' é obrigatório. Ex: ?level=B1",
            "accepted_values": ["A1", "A2", "B1", "B2", "C1", "C2"],
        }), 400

    try:
        result = compute_next_level_distance(student_id, level, db.session)
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500

    if "error" in result:
        return jsonify(result), 400

    return jsonify({"student_id": student_id, **result}), 200