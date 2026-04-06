from extensions import db
from datetime import datetime, timezone


evidence_skill_tags = db.Table(
    "evidence_skill_tags",
    db.Column("evidence_id", db.Integer, db.ForeignKey("evidence_events.id"), primary_key=True),
    db.Column("skill_id", db.String(50), db.ForeignKey("skill_nodes.skill_id"), primary_key=True),
    db.Column("teacher_override", db.Boolean, nullable=False, default=False),
)


class EvidenceEvent(db.Model):
    __tablename__ = "evidence_events"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)

    timestamp = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    source_module = db.Column(
        db.Enum("Reporting", "Advising", "Testing", name="source_module_enum"),
        nullable=False,
    )
    source_type = db.Column(db.String(80), nullable=False)

    raw_input = db.Column(db.Text, nullable=False)
    context = db.Column(db.Text, nullable=True)

    polarity = db.Column(db.Integer, nullable=False)          # -1 = erro | 1 = acerto
    severity = db.Column(db.Integer, nullable=False, default=1)  # 1–3
    machine_confidence = db.Column(db.Float, nullable=True)

    # --- Relacionamentos ---
    student = db.relationship("Student", backref=db.backref("evidence_events", lazy="dynamic"))

    skill_tags = db.relationship(
        "SkillNode",
        secondary=evidence_skill_tags,
        backref=db.backref("evidence_events", lazy="dynamic"),
        lazy="dynamic",
    )

    # --- Validações leves ---
    @staticmethod
    def _validate(polarity: int, severity: int) -> None:
        if polarity not in (-1, 1):
            raise ValueError(f"polarity must be -1 or 1, got {polarity}")
        if severity not in (1, 2, 3):
            raise ValueError(f"severity must be 1, 2 or 3, got {severity}")

    def __init__(self, **kwargs):
        EvidenceEvent._validate(kwargs.get("polarity"), kwargs.get("severity", 1))
        super().__init__(**kwargs)

    def to_dict(self, include_tags: bool = True) -> dict:
        data = {
            "id": self.id,
            "student_id": self.student_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "source_module": self.source_module,
            "source_type": self.source_type,
            "raw_input": self.raw_input,
            "context": self.context,
            "polarity": self.polarity,
            "severity": self.severity,
            "machine_confidence": self.machine_confidence,
        }
        if include_tags:
            data["skill_tags"] = [
                {
                    "skill_id": tag.skill_id,
                    "teacher_override": db.session.execute(
                        db.select(evidence_skill_tags.c.teacher_override).where(
                            evidence_skill_tags.c.evidence_id == self.id,
                            evidence_skill_tags.c.skill_id == tag.skill_id,
                        )
                    ).scalar(),
                }
                for tag in self.skill_tags
            ]
        return data

    def __repr__(self) -> str:
        return (
            f"<EvidenceEvent id={self.id} student={self.student_id} "
            f"module={self.source_module!r} polarity={self.polarity}>"
        )
