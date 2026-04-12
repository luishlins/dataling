import json
from extensions import db
from datetime import datetime, timezone

_VALID_TYPES = {"Proficiency", "Reading", "Listening", "Speaking", "Writing"}


class TestSession(db.Model):
    __tablename__ = "test_sessions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)

    # "Proficiency" | "Reading" | "Listening" | "Speaking" | "Writing"
    session_type = db.Column(db.String(50), nullable=False)

    # When the session took place (defaults to creation time)
    session_date = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    # Backward-compat alias kept as a property (old routes used applied_at)
    @property
    def applied_at(self):
        return self.session_date

    duration_minutes = db.Column(db.Integer, nullable=True)

    # JSON blob — summary computed at the end of the session
    overall_result = db.Column(db.Text, nullable=True)

    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # --- Relacionamentos ---
    student = db.relationship(
        "Student", backref=db.backref("test_sessions", lazy="select", cascade="all, delete-orphan")
    )

    # --- Helpers ---
    def get_overall_result(self) -> dict | None:
        if self.overall_result is None:
            return None
        try:
            return json.loads(self.overall_result)
        except (ValueError, TypeError):
            return None

    def set_overall_result(self, data: dict) -> None:
        self.overall_result = json.dumps(data)

    def to_dict(self) -> dict:
        return {
            "id":               self.id,
            "student_id":       self.student_id,
            "session_type":     self.session_type,
            "session_date":     self.session_date.isoformat() if self.session_date else None,
            "duration_minutes": self.duration_minutes,
            "overall_result":   self.get_overall_result(),
            "notes":            self.notes,
            "created_at":       self.created_at.isoformat() if self.created_at else None,
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
