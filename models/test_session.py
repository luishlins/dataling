from app import db
from datetime import datetime, timezone


class TestSession(db.Model):
    __tablename__ = "test_sessions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)

    session_type = db.Column(db.String(50), nullable=False)
    applied_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    notes = db.Column(db.Text, nullable=True)

    # --- Relacionamentos ---
    student = db.relationship(
        "Student", backref=db.backref("test_sessions", lazy="dynamic")
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "student_id": self.student_id,
            "session_type": self.session_type,
            "applied_at": self.applied_at.isoformat() if self.applied_at else None,
            "notes": self.notes,
        }

    def __repr__(self) -> str:
        return (
            f"<TestSession id={self.id} student={self.student_id} "
            f"type={self.session_type!r}>"
        )
