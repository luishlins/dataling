from extensions import db
from datetime import datetime, timezone


class StudentSkillState(db.Model):
    __tablename__ = "student_skill_states"

    __table_args__ = (
        db.UniqueConstraint("student_id", "skill_id", name="uq_student_skill"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    skill_id = db.Column(db.String(50), db.ForeignKey("skill_nodes.skill_id"), nullable=False)

    mastery_score = db.Column(db.Float, nullable=False, default=0.5)
    error_streak = db.Column(db.Integer, nullable=False, default=0)
    success_streak = db.Column(db.Integer, nullable=False, default=0)
    last_updated = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # --- Relacionamentos ---
    student = db.relationship(
        "Student", backref=db.backref("skill_states", lazy="dynamic")
    )
    skill = db.relationship(
        "SkillNode", backref=db.backref("student_states", lazy="dynamic")
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "student_id": self.student_id,
            "skill_id": self.skill_id,
            "mastery_score": self.mastery_score,
            "error_streak": self.error_streak,
            "success_streak": self.success_streak,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
        }

    def __repr__(self) -> str:
        return (
            f"<StudentSkillState id={self.id} student={self.student_id} "
            f"skill={self.skill_id!r} mastery={self.mastery_score:.2f}>"
        )
