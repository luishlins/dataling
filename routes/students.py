from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError
from datetime import date

from extensions import db
from models import Student
from models.student_skill_state import StudentSkillState

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
