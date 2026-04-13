"""
tests/test_targeter.py

Testes unitários para services/test_targeter.py.

Execução:
    pytest tests/test_targeter.py -v
"""
import json
import pytest
from datetime import date, datetime, timezone, timedelta

from app import app as flask_app
from extensions import db as _db
from models import Student, SkillNode, StudentSkillState, TestItem
from models.advised_vocab import AdvisedVocabItem
from models.test_session import TestSession, TestSessionResult
from services.test_targeter import compute_item_relevance, select_items_for_session


# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────

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


@pytest.fixture(scope="function", autouse=True)
def clean_db(app):
    with app.app_context():
        _db.session.rollback()
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()
    yield


@pytest.fixture
def student(app):
    with app.app_context():
        s = Student(name="Aluno Teste", start_date=date(2024, 1, 1))
        _db.session.add(s)
        _db.session.commit()
        _db.session.refresh(s)
        yield s


@pytest.fixture
def skill_a1(app):
    with app.app_context():
        sk = SkillNode(
            skill_id="GRAM_A1",
            skill_domain="grammar",
            cefr_target="A1",
            difficulty_weight=1.0,
        )
        _db.session.add(sk)
        _db.session.commit()
        yield sk


@pytest.fixture
def skill_b1(app):
    with app.app_context():
        sk = SkillNode(
            skill_id="GRAM_B1",
            skill_domain="grammar",
            cefr_target="B1",
            difficulty_weight=1.0,
        )
        _db.session.add(sk)
        _db.session.commit()
        yield sk


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _make_item(item_type, target_cefr, vocab_targets=None, skills=None):
    """Cria e persiste um TestItem, opcionalmente com skills_tested."""
    item = TestItem(
        item_type=item_type,
        target_cefr=target_cefr,
        content="Fill in the blank: ___",
        options=json.dumps({"A": "go", "B": "went", "C": "gone", "D": "going"}),
        correct_answer="B",
        vocab_targets=json.dumps(vocab_targets or []),
    )
    if skills:
        item.skills_tested = skills
    _db.session.add(item)
    _db.session.commit()
    _db.session.refresh(item)
    return item


# ─────────────────────────────────────────────────────────────
# Testes: compute_item_relevance
# ─────────────────────────────────────────────────────────────

class TestComputeItemRelevance:

    def test_basic_gap_score_no_bonus_no_penalty(self, app, student, skill_a1):
        """gap_score correto quando sem recência e sem advising_bonus."""
        with app.app_context():
            # mastery=0.3 → gap=0.7; recency=1.0; bonus=0.0 → score=0.7
            _db.session.add(
                StudentSkillState(student_id=student.id, skill_id="GRAM_A1", mastery_score=0.3)
            )
            skill = _db.session.get(SkillNode, "GRAM_A1")
            item = _make_item("Reading", "A1", skills=[skill])

            score = compute_item_relevance(student.id, item.id, _db.session)

            assert score == pytest.approx(0.7, rel=1e-4)

    def test_no_skills_tested_returns_zero_gap(self, app, student):
        """Item sem skills_tested → gap_score=0, score=0.0."""
        with app.app_context():
            item = _make_item("Reading", "A1")

            score = compute_item_relevance(student.id, item.id, _db.session)

            assert score == pytest.approx(0.0, rel=1e-4)

    def test_unknown_item_returns_zero(self, app, student):
        """item_id inexistente retorna 0.0."""
        with app.app_context():
            score = compute_item_relevance(student.id, 9999, _db.session)
            assert score == 0.0

    def test_advising_bonus_applied_when_vocab_matches(self, app, student, skill_a1):
        """advising_bonus=+0.2 quando vocab_target coincide com AdvisedVocabItem de alta prioridade."""
        with app.app_context():
            _db.session.add(
                StudentSkillState(student_id=student.id, skill_id="GRAM_A1", mastery_score=0.5)
            )
            _db.session.add(
                AdvisedVocabItem(student_id=student.id, term="negotiate", priority_weight=2.0)
            )
            skill = _db.session.get(SkillNode, "GRAM_A1")
            item = _make_item("Reading", "A1", vocab_targets=["negotiate", "contract"], skills=[skill])

            score = compute_item_relevance(student.id, item.id, _db.session)

            # gap=0.5, penalty=1.0, bonus=0.2 → 0.7
            assert score == pytest.approx(0.7, rel=1e-4)

    def test_advising_bonus_not_applied_for_low_priority(self, app, student, skill_a1):
        """Sem bonus quando priority_weight <= 1.0."""
        with app.app_context():
            _db.session.add(
                StudentSkillState(student_id=student.id, skill_id="GRAM_A1", mastery_score=0.5)
            )
            _db.session.add(
                AdvisedVocabItem(student_id=student.id, term="negotiate", priority_weight=1.0)
            )
            skill = _db.session.get(SkillNode, "GRAM_A1")
            item = _make_item("Reading", "A1", vocab_targets=["negotiate"], skills=[skill])

            score = compute_item_relevance(student.id, item.id, _db.session)

            # gap=0.5, penalty=1.0, bonus=0.0 → 0.5
            assert score == pytest.approx(0.5, rel=1e-4)

    def test_recency_penalty_7_days(self, app, student, skill_a1):
        """recency_penalty=0.5 quando item foi respondido nos últimos 7 dias."""
        with app.app_context():
            _db.session.add(
                StudentSkillState(student_id=student.id, skill_id="GRAM_A1", mastery_score=0.0)
            )
            skill = _db.session.get(SkillNode, "GRAM_A1")
            item = _make_item("Reading", "A1", skills=[skill])

            session = TestSession(student_id=student.id, session_type="Reading")
            _db.session.add(session)
            _db.session.flush()

            recent = datetime.now(timezone.utc) - timedelta(days=3)
            result = TestSessionResult(
                session_id=session.id,
                item_id=item.id,
                student_answer="A",
                is_correct=False,
                answered_at=recent,
            )
            _db.session.add(result)
            _db.session.commit()

            score = compute_item_relevance(student.id, item.id, _db.session)

            # gap=1.0, penalty=0.5, bonus=0.0 → 0.5
            assert score == pytest.approx(0.5, rel=1e-4)

    def test_recency_penalty_30_days(self, app, student, skill_a1):
        """recency_penalty=0.8 quando item foi respondido entre 7 e 30 dias atrás."""
        with app.app_context():
            _db.session.add(
                StudentSkillState(student_id=student.id, skill_id="GRAM_A1", mastery_score=0.0)
            )
            skill = _db.session.get(SkillNode, "GRAM_A1")
            item = _make_item("Reading", "A1", skills=[skill])

            session = TestSession(student_id=student.id, session_type="Reading")
            _db.session.add(session)
            _db.session.flush()

            semi_recent = datetime.now(timezone.utc) - timedelta(days=15)
            result = TestSessionResult(
                session_id=session.id,
                item_id=item.id,
                student_answer="B",
                is_correct=True,
                answered_at=semi_recent,
            )
            _db.session.add(result)
            _db.session.commit()

            score = compute_item_relevance(student.id, item.id, _db.session)

            # gap=1.0, penalty=0.8, bonus=0.0 → 0.8
            assert score == pytest.approx(0.8, rel=1e-4)


# ─────────────────────────────────────────────────────────────
# Testes: select_items_for_session
# ─────────────────────────────────────────────────────────────

class TestSelectItemsForSession:

    def test_filters_by_session_type(self, app, student, skill_a1):
        """Somente itens do tipo correto devem ser candidatos."""
        with app.app_context():
            skill = _db.session.get(SkillNode, "GRAM_A1")
            _make_item("Reading", "A1", skills=[skill])
            _make_item("Listening", "A1", skills=[skill])

            result = select_items_for_session(student.id, "Reading", 10, _db.session)

            assert all(item.item_type == "Reading" for item in result)
            assert len(result) == 1

    def test_returns_top_n_items(self, app, student, skill_a1):
        """Retorna no máximo n_items itens."""
        with app.app_context():
            skill = _db.session.get(SkillNode, "GRAM_A1")
            _db.session.add(
                StudentSkillState(student_id=student.id, skill_id="GRAM_A1", mastery_score=0.5)
            )
            for _ in range(5):
                _make_item("Reading", "A1", skills=[skill])

            result = select_items_for_session(student.id, "Reading", 3, _db.session)

            assert len(result) == 3

    def test_ranks_by_relevance_descending(self, app, student, skill_a1):
        """Itens com maior gap_score devem vir primeiro."""
        with app.app_context():
            skill = _db.session.get(SkillNode, "GRAM_A1")

            # Item com alta relevância: skill sem state → mastery assume 0 → gap=1.0
            item_high = _make_item("Reading", "A1", skills=[skill])

            # Item com baixa relevância: mastery alta → gap pequeno
            _db.session.add(
                StudentSkillState(student_id=student.id, skill_id="GRAM_A1", mastery_score=0.9)
            )
            item_low = _make_item("Reading", "A1")  # sem skills_tested → gap=0.0

            result = select_items_for_session(student.id, "Reading", 2, _db.session)

            assert len(result) == 2
            # item_high (gap=1.0 antes do state existir, mas agora state existe com 0.9)
            # item_low  (gap=0.0 por não ter skills)
            assert result[0].id == item_high.id
            assert result[1].id == item_low.id

    def test_empty_when_no_matching_items(self, app, student):
        """Retorna lista vazia quando não há itens do tipo solicitado."""
        with app.app_context():
            result = select_items_for_session(student.id, "Writing", 5, _db.session)
            assert result == []
