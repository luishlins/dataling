from app import db
from datetime import datetime, timezone


class Student(db.Model):
    __tablename__ = "students"

    # --- Campos obrigatórios ---
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(200), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # --- Perfil de contexto (opcionais) ---
    job_title = db.Column(db.String(200), nullable=True)
    typical_tasks = db.Column(db.Text, nullable=True)
    speaking_environments = db.Column(db.Text, nullable=True)
    accent_constraints = db.Column(db.Text, nullable=True)
    target_level = db.Column(db.String(10), nullable=True)
    target_date = db.Column(db.Date, nullable=True)
    test_purpose = db.Column(db.String(200), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "job_title": self.job_title,
            "typical_tasks": self.typical_tasks,
            "speaking_environments": self.speaking_environments,
            "accent_constraints": self.accent_constraints,
            "target_level": self.target_level,
            "target_date": self.target_date.isoformat() if self.target_date else None,
            "test_purpose": self.test_purpose,
        }

    def __repr__(self) -> str:
        return f"<Student id={self.id} name={self.name!r}>"
