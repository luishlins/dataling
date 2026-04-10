from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError
from datetime import date

from extensions import db
from models import Student
from models.student_skill_state import StudentSkillState
from models.skill_node import SkillNode
from services.level_estimator import compute_level_estimate, compute_all_skill_estimates
from services.gap_analyzer import compute_aspect_gaps, compute_next_level_distance, compute_skill_gap

students_bp = Blueprint("students", __name__)


# ──────────────────────────────────────────────
# GET /api/students  →  lista todos os alunos
# ──────────────────────────────────────────────
@students_bp.route("/students", methods=["GET"])
def list_students():
    try:
        students = Student.query.all()
        return jsonify([s.to_dict() for s in students]), 200
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
            }
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
