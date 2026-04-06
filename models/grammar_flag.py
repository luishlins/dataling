from extensions import db
from datetime import datetime, timezone


class GrammarFlag(db.Model):
    __tablename__ = "grammar_flags"

    id = db.Column(db.Integer, primary_key=True)

    # Quem cometeu o erro e quando foi observado
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    observed_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # O que o professor anotou
    raw_input = db.Column(db.Text, nullable=False)          # texto livre do professor
    error_type = db.Column(
        db.Enum(
            "grammar",
            "vocabulary",
            "phonology",
            "discourse",
            name="grammar_flag_error_type_enum",
        ),
        nullable=True,
    )

    # Contexto opcional: trecho da fala/escrita que gerou o flag
    context_excerpt = db.Column(db.Text, nullable=True)

    # Skills vinculadas após o auto-tag (relacionamento N:M via tabela associativa)
    tagged_skills = db.relationship(
        "SkillNode",
        secondary="grammar_flag_skills",
        lazy="dynamic",
    )

    student = db.relationship("Student", backref=db.backref("grammar_flags", lazy="dynamic", cascade="all, delete-orphan"))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "student_id": self.student_id,
            "observed_at": self.observed_at.isoformat() if self.observed_at else None,
            "raw_input": self.raw_input,
            "error_type": self.error_type,
            "context_excerpt": self.context_excerpt,
            "tagged_skill_ids": [s.skill_id for s in self.tagged_skills],
        }

    def __repr__(self) -> str:
        return f"<GrammarFlag id={self.id} student_id={self.student_id}>"


# Tabela associativa GrammarFlag ↔ SkillNode
grammar_flag_skills = db.Table(
    "grammar_flag_skills",
    db.Column(
        "flag_id",
        db.Integer,
        db.ForeignKey("grammar_flags.id"),
        primary_key=True,
    ),
    db.Column(
        "skill_id",
        db.String(50),
        db.ForeignKey("skill_nodes.skill_id"),
        primary_key=True,
    ),
)
