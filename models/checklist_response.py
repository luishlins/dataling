from extensions import db
from datetime import datetime, timezone


class ChecklistResponse(db.Model):
    __tablename__ = "checklist_responses"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    session_id = db.Column(
        db.Integer, db.ForeignKey("test_sessions.id"), nullable=False
    )
    check_id = db.Column(
        db.String(20), db.ForeignKey("checklist_items.check_id"), nullable=False
    )

    response    = db.Column(db.Boolean, nullable=False)   # True = Yes, False = No
    answered_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # --- Constraints ---
    __table_args__ = (
        db.UniqueConstraint("session_id", "check_id", name="uq_session_check"),
    )

    # --- Relationships ---
    session = db.relationship(
        "TestSession", backref=db.backref("checklist_responses", lazy="select")
    )
    item = db.relationship(
        "ChecklistItem", backref=db.backref("responses", lazy="select")
    )

    def to_dict(self) -> dict:
        return {
            "id":          self.id,
            "session_id":  self.session_id,
            "check_id":    self.check_id,
            "response":    self.response,
            "answered_at": self.answered_at.isoformat() if self.answered_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"<ChecklistResponse session={self.session_id} "
            f"check_id={self.check_id!r} response={self.response}>"
        )
