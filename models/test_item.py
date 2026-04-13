from extensions import db
from datetime import datetime, timezone


test_item_skills = db.Table(
    "test_item_skills",
    db.Column("item_id", db.Integer, db.ForeignKey("test_items.id"), primary_key=True),
    db.Column("skill_id", db.String(50), db.ForeignKey("skill_nodes.skill_id"), primary_key=True),
)


class TestItem(db.Model):
    __tablename__ = "test_items"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    item_type = db.Column(db.String(50), nullable=False)
    target_cefr = db.Column(db.String(10), nullable=False)
    content = db.Column(db.Text, nullable=False)
    options = db.Column(db.Text, nullable=False)           # JSON string
    correct_answer = db.Column(db.String(10), nullable=False)
    vocab_targets = db.Column(db.Text, nullable=False)     # JSON string
    distractor_rationale = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    skills_tested = db.relationship(
        "SkillNode", secondary=test_item_skills, lazy="select"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "item_type": self.item_type,
            "target_cefr": self.target_cefr,
            "content": self.content,
            "options": self.options,
            "correct_answer": self.correct_answer,
            "vocab_targets": self.vocab_targets,
            "distractor_rationale": self.distractor_rationale,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"<TestItem id={self.id} type={self.item_type!r} cefr={self.target_cefr!r}>"
        )
