from extensions import db
from datetime import datetime, timezone


skill_prereqs = db.Table(
    "skill_prereqs",
    db.Column("skill_id", db.String(50), db.ForeignKey("skill_nodes.skill_id"), primary_key=True),
    db.Column("prereq_id", db.String(50), db.ForeignKey("skill_nodes.skill_id"), primary_key=True),
)


class SkillNode(db.Model):
    __tablename__ = "skill_nodes"

    skill_id = db.Column(db.String(50), primary_key=True)
    skill_domain = db.Column(
        db.Enum(
            "grammar",
            "vocabulary",
            "phonology",
            "discourse",
            "listening",
            "reading",
            "writing",
            name="skill_domain_enum",
        ),
        nullable=False,
    )
    cefr_target = db.Column(db.String(10), nullable=False)
    difficulty_weight = db.Column(db.Float, nullable=False, default=1.0)
    examples = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    prereqs = db.relationship(
        "SkillNode",
        secondary=skill_prereqs,
        primaryjoin=skill_id == skill_prereqs.c.skill_id,
        secondaryjoin=skill_id == skill_prereqs.c.prereq_id,
        backref=db.backref("required_by", lazy="select"),
        lazy="select",
    )

    def to_dict(self, include_prereqs: bool = True) -> dict:
        data = {
            "skill_id": self.skill_id,
            "skill_domain": self.skill_domain,
            "cefr_target": self.cefr_target,
            "difficulty_weight": self.difficulty_weight,
            "examples": self.examples,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_prereqs:
            data["prereqs"] = [p.to_dict(include_prereqs=False) for p in self.prereqs]
            data["required_by"] = [s.to_dict(include_prereqs=False) for s in self.required_by]
        return data

    def __repr__(self) -> str:
        return f"<SkillNode skill_id={self.skill_id!r} domain={self.skill_domain!r} cefr={self.cefr_target!r}>"
