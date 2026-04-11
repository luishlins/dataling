from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError

from extensions import db
from models import SkillNode

skills_bp = Blueprint("skills", __name__)

VALID_DOMAINS = {
    "grammar", "vocabulary", "phonology", "discourse",
    "listening", "reading", "writing",
}


# ──────────────────────────────────────────────
# GET /skills  →  lista todos os SkillNodes
# ──────────────────────────────────────────────
@skills_bp.route("/skills", methods=["GET"])
def list_skills():
    try:
        skills = SkillNode.query.order_by(SkillNode.cefr_target, SkillNode.skill_id).all()
        return jsonify([s.to_dict() for s in skills]), 200
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# GET /skills/by-level/<cefr_level>  →  filtra por cefr_target
# DEVE vir antes de /skills/<skill_id> para não colidir
# ──────────────────────────────────────────────
@skills_bp.route("/skills/by-level/<string:cefr_level>", methods=["GET"])
def list_skills_by_level(cefr_level):
    try:
        skills = (
            SkillNode.query
            .filter(SkillNode.cefr_target == cefr_level.upper())
            .order_by(SkillNode.skill_id)
            .all()
        )
        return jsonify([s.to_dict() for s in skills]), 200
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# GET /skills/<skill_id>  →  busca por skill_id
# ──────────────────────────────────────────────
@skills_bp.route("/skills/<string:skill_id>", methods=["GET"])
def get_skill(skill_id):
    try:
        skill = db.session.get(SkillNode, skill_id)
        if skill is None:
            return jsonify({"error": f"Skill '{skill_id}' não encontrada."}), 404
        return jsonify(skill.to_dict()), 200
    except SQLAlchemyError as e:
        return jsonify({"error": "Erro ao consultar o banco de dados.", "details": str(e)}), 500


# ──────────────────────────────────────────────
# POST /skills  →  cria SkillNode (seed only)
# ──────────────────────────────────────────────
@skills_bp.route("/skills", methods=["POST"])
def create_skill():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "O corpo da requisição deve ser um JSON válido."}), 400

    missing = [f for f in ("skill_id", "skill_domain", "cefr_target") if not data.get(f)]
    if missing:
        return jsonify({"error": f"Campos obrigatórios ausentes: {', '.join(missing)}."}), 400

    if data["skill_domain"] not in VALID_DOMAINS:
        return jsonify({
            "error": f"skill_domain inválido. Valores aceitos: {', '.join(sorted(VALID_DOMAINS))}."
        }), 400

    if db.session.get(SkillNode, data["skill_id"]) is not None:
        return jsonify({"error": f"Skill '{data['skill_id']}' já existe."}), 409

    try:
        prereq_ids = data.pop("prereqs", [])

        skill = SkillNode(
            skill_id=data["skill_id"],
            skill_domain=data["skill_domain"],
            cefr_target=data["cefr_target"].upper(),
            difficulty_weight=data.get("difficulty_weight", 1.0),
            examples=data.get("examples"),
        )
        db.session.add(skill)
        db.session.flush()  # garante que skill está na sessão antes de resolver prereqs

        if prereq_ids:
            prereqs = SkillNode.query.filter(SkillNode.skill_id.in_(prereq_ids)).all()
            found_ids = {p.skill_id for p in prereqs}
            missing_prereqs = set(prereq_ids) - found_ids
            if missing_prereqs:
                db.session.rollback()
                return jsonify({
                    "error": f"Prereqs não encontrados: {', '.join(sorted(missing_prereqs))}."
                }), 400
            for prereq in prereqs:
                skill.prereqs.append(prereq)

        db.session.commit()
        return jsonify(skill.to_dict()), 201
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Erro ao salvar no banco de dados.", "details": str(e)}), 500
