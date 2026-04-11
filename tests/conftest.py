"""
tests/conftest.py

Fixtures compartilhadas entre os módulos de teste.
"""

import pytest
from datetime import date

from app import app as flask_app
from extensions import db as _db
from models import Student, SkillNode, StudentSkillState


@pytest.fixture(scope="function")
def app():
    flask_app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
    })
    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.drop_all()


@pytest.fixture(scope="function")
def sample_student(app):
    """Aluno já persistido no banco de teste."""
    with app.app_context():
        student = Student(name="Sample Student", start_date=date.fromisoformat("2024-01-01"))
        _db.session.add(student)
        _db.session.commit()
        _db.session.refresh(student)
        yield student


@pytest.fixture(scope="function")
def sample_skills(app):
    """SkillNodes usados pelos testes de gap e distância."""
    with app.app_context():
        skills = [
            SkillNode(skill_id="GRAM_TEST_A1",   skill_domain="grammar",    cefr_target="A1", difficulty_weight=1.0, examples="Test grammar"),
            SkillNode(skill_id="VOCAB_TEST_A1",  skill_domain="vocabulary", cefr_target="A1", difficulty_weight=1.0, examples="Test vocab"),
            SkillNode(skill_id="LISTEN_TEST_A1", skill_domain="listening",  cefr_target="A1", difficulty_weight=1.0, examples="Test listening"),
            SkillNode(skill_id="SPEAK_TEST_A1",  skill_domain="discourse",  cefr_target="A1", difficulty_weight=1.0, examples="Test speaking"),
            SkillNode(skill_id="READ_TEST_A1",   skill_domain="reading",    cefr_target="A1", difficulty_weight=1.0, examples="Test reading"),
            SkillNode(skill_id="WRITE_TEST_A1",  skill_domain="writing",    cefr_target="A1", difficulty_weight=1.0, examples="Test writing"),
            SkillNode(skill_id="GATEKEEPER_B1",  skill_domain="grammar",    cefr_target="B1", difficulty_weight=1.3, examples="Gatekeeper skill"),
        ]
        _db.session.add_all(skills)
        _db.session.commit()
        yield skills


@pytest.fixture(scope="function")
def sample_states(app, sample_student, sample_skills):
    """StudentSkillStates para sample_student com os mastery scores dos testes."""
    with app.app_context():
        states = [
            StudentSkillState(student_id=sample_student.id, skill_id="GRAM_TEST_A1",   mastery_score=0.8),
            StudentSkillState(student_id=sample_student.id, skill_id="VOCAB_TEST_A1",  mastery_score=0.6),
            StudentSkillState(student_id=sample_student.id, skill_id="LISTEN_TEST_A1", mastery_score=0.4),
            StudentSkillState(student_id=sample_student.id, skill_id="SPEAK_TEST_A1",  mastery_score=0.2),
            StudentSkillState(student_id=sample_student.id, skill_id="READ_TEST_A1",   mastery_score=0.9),
            StudentSkillState(student_id=sample_student.id, skill_id="WRITE_TEST_A1",  mastery_score=0.1),
            StudentSkillState(student_id=sample_student.id, skill_id="GATEKEEPER_B1",  mastery_score=0.3),
        ]
        _db.session.add_all(states)
        _db.session.commit()
        yield states
