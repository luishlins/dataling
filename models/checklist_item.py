from extensions import db


class ChecklistItem(db.Model):
    __tablename__ = "checklist_items"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    check_id = db.Column(db.String(20), unique=True, nullable=False)  # ex: FL_001
    dimension = db.Column(
        db.Enum(
            "Fluency",
            "Coherence",
            "GrammarAccuracy",
            "GrammarRange",
            "LexicalRange",
            "LexicalPrecision",
            "PronunciationSound",
            "PronunciationProsody",
            "Interaction",
            name="checklist_dimension_enum",
        ),
        nullable=False,
    )
    question_text       = db.Column(db.Text, nullable=False)
    weight              = db.Column(db.Float, nullable=False, default=1.0)
    typical_cefr_floor  = db.Column(db.String(10), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id":                 self.id,
            "check_id":           self.check_id,
            "dimension":          self.dimension,
            "question_text":      self.question_text,
            "weight":             self.weight,
            "typical_cefr_floor": self.typical_cefr_floor,
        }

    def __repr__(self) -> str:
        return (
            f"<ChecklistItem check_id={self.check_id!r} "
            f"dimension={self.dimension!r}>"
        )
