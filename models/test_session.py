from extensions import db
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


class TestSessionResult(db.Model):
    __tablename__ = "test_session_results"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    session_id = db.Column(
        db.Integer, db.ForeignKey("test_sessions.id"), nullable=False
    )
    item_id = db.Column(
        db.Integer, db.ForeignKey("test_items.id"), nullable=False
    )

    student_answer = db.Column(db.String(10), nullable=False)
    is_correct     = db.Column(db.Boolean, nullable=False)
    answered_at    = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # --- Relacionamentos ---
    session = db.relationship(
        "TestSession", backref=db.backref("results", lazy="dynamic")
    )
    item = db.relationship(
        "TestItem", backref=db.backref("results", lazy="dynamic")
    )

    def to_dict(self) -> dict:
        return {
            "id":             self.id,
            "session_id":     self.session_id,
            "item_id":        self.item_id,
            "student_answer": self.student_answer,
            "is_correct":     self.is_correct,
            "answered_at":    self.answered_at.isoformat() if self.answered_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"<TestSessionResult id={self.id} session={self.session_id} "
            f"item={self.item_id} correct={self.is_correct}>"
        )
