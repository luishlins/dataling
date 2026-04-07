import pytest
from datetime import datetime, timezone
from services.knowledge_tracing import update_mastery, process_evidence_event
from models import Student, SkillNode, EvidenceEvent, StudentSkillState
from models.evidence_event import evidence_skill_tags
from extensions import db


@pytest.fixture
def app():
    from app import app as flask_app
    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def student(app):
    student = Student(name="Test Student", start_date=datetime.now(timezone.utc).date())
    db.session.add(student)
    db.session.commit()
    return student


@pytest.fixture
def skill(app):
    skill = SkillNode(
        skill_id="TEST_SKILL_001",
        skill_domain="grammar",
        cefr_target="B1",
        difficulty_weight=1.0,
        examples="Test examples"
    )
    db.session.add(skill)
    db.session.commit()
    return skill


@pytest.fixture
def skill2(app):
    skill = SkillNode(
        skill_id="TEST_SKILL_002",
        skill_domain="vocabulary",
        cefr_target="A2",
        difficulty_weight=1.0,
        examples="More examples"
    )
    db.session.add(skill)
    db.session.commit()
    return skill


def test_update_mastery_positive_polarity_increases_mastery_score(app, student, skill):
    # Create initial state
    state = StudentSkillState(student_id=student.id, skill_id=skill.skill_id, mastery_score=0.5)
    db.session.add(state)
    db.session.commit()

    initial_score = state.mastery_score

    # Update with positive polarity
    updated_state = update_mastery(student.id, skill.skill_id, polarity=1, severity=1, db_session=db.session)

    assert updated_state.mastery_score > initial_score


def test_update_mastery_negative_polarity_decreases_mastery_score(app, student, skill):
    # Create initial state
    state = StudentSkillState(student_id=student.id, skill_id=skill.skill_id, mastery_score=0.5)
    db.session.add(state)
    db.session.commit()

    initial_score = state.mastery_score

    # Update with negative polarity
    updated_state = update_mastery(student.id, skill.skill_id, polarity=-1, severity=1, db_session=db.session)

    assert updated_state.mastery_score < initial_score


def test_three_positive_evidences_increment_success_streak_to_3(app, student, skill):
    # Create initial state with success_streak = 2
    state = StudentSkillState(student_id=student.id, skill_id=skill.skill_id, mastery_score=0.5, success_streak=2)
    db.session.add(state)
    db.session.commit()

    # One more positive update to reach 3
    update_mastery(student.id, skill.skill_id, polarity=1, severity=1, db_session=db.session)

    # Check final state
    final_state = db.session.query(StudentSkillState).filter_by(student_id=student.id, skill_id=skill.skill_id).first()
    assert final_state.success_streak == 3


def test_mastery_score_clamped_between_005_and_095(app, student, skill):
    # Test upper bound
    state = StudentSkillState(student_id=student.id, skill_id=skill.skill_id, mastery_score=0.9)
    db.session.add(state)
    db.session.commit()

    updated_state = update_mastery(student.id, skill.skill_id, polarity=1, severity=3, db_session=db.session)
    assert updated_state.mastery_score <= 0.95

    # Test lower bound
    state2 = StudentSkillState(student_id=student.id, skill_id="TEST_SKILL_002", mastery_score=0.1)
    db.session.add(state2)
    db.session.commit()

    updated_state2 = update_mastery(student.id, "TEST_SKILL_002", polarity=-1, severity=3, db_session=db.session)
    assert updated_state2.mastery_score >= 0.05


def test_process_evidence_event_updates_all_tagged_skills(app, student, skill, skill2):
    # Create event
    event = EvidenceEvent(
        student_id=student.id,
        source_module="Reporting",
        source_type="free_note",
        raw_input="Test input",
        polarity=1,
        severity=1
    )
    db.session.add(event)
    db.session.flush()

    # Tag skills
    db.session.execute(evidence_skill_tags.insert().values(
        evidence_id=event.id,
        skill_id=skill.skill_id
    ))
    db.session.execute(evidence_skill_tags.insert().values(
        evidence_id=event.id,
        skill_id=skill2.skill_id
    ))
    db.session.commit()

    # Process event
    updated_states = process_evidence_event(event.id, db.session)

    # Check that both skills were updated
    assert len(updated_states) == 2
    skill_ids = {state.skill_id for state in updated_states}
    assert skill.skill_id in skill_ids
    assert skill2.skill_id in skill_ids

    # Verify states exist in db
    state1 = db.session.query(StudentSkillState).filter_by(student_id=student.id, skill_id=skill.skill_id).first()
    state2 = db.session.query(StudentSkillState).filter_by(student_id=student.id, skill_id=skill2.skill_id).first()
    assert state1 is not None
    assert state2 is not None