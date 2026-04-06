from app import db
from datetime import datetime, timezone


class AdvisedVocabItem(db.Model):
    __tablename__ = "advised_vocab_items"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)

    term = db.Column(db.String(200), nullable=False)
    domain = db.Column(db.String(100), nullable=True)
    subdomain = db.Column(db.String(100), nullable=True)
    situation = db.Column(db.String(200), nullable=True)
    priority_weight = db.Column(db.Float, nullable=False, default=1.0)
    is_multiword = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # --- Relacionamentos ---
    student = db.relationship(
        "Student", backref=db.backref("advised_vocab_items", lazy="dynamic")
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "student_id": self.student_id,
            "term": self.term,
            "domain": self.domain,
            "subdomain": self.subdomain,
            "situation": self.situation,
            "priority_weight": self.priority_weight,
            "is_multiword": self.is_multiword,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"<AdvisedVocabItem id={self.id} student={self.student_id} "
            f"term={self.term!r} multiword={self.is_multiword}>"
        )
