"""
tests/test_gap_analyzer.py
Testes unitários para as funções de análise de gaps.

Execução:
    pytest tests/test_gap_analyzer.py -v
"""

import pytest
from datetime import date

from app import app as flask_app
from extensions import db as _db
from models import Student, SkillNode, StudentSkillState
from services.gap_analyzer import compute_skill_gap, compute_aspect_gaps, compute_next_level_distance


# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def app():
    """
    Cria uma instância do Flask configurada para testes.
    """
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
    """
    Limpa todas as tabelas antes de cada teste.
    """
    with app.app_context():
        _db.session.rollback()
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()
    yield


# ─────────────────────────────────────────────────────────────
# Testes
# ─────────────────────────────────────────────────────────────

class TestComputeSkillGap:

    def test_returns_list_sorted_by_gap_descending(self, app):
        """compute_skill_gap deve retornar lista ordenada por gap decrescente."""
        with app.app_context():
            # Create test data
            student = Student(name="Test Student", start_date=date.fromisoformat("2024-01-01"))
            _db.session.add(student)
            _db.session.flush()  # obtém student.id antes de criar os states
            skills = [
                SkillNode(skill_id="GRAM_TEST_A1", skill_domain="grammar", cefr_target="A1", difficulty_weight=1.0, examples="Test grammar"),
                SkillNode(skill_id="VOCAB_TEST_A1", skill_domain="vocabulary", cefr_target="A1", difficulty_weight=1.0, examples="Test vocab"),
                SkillNode(skill_id="LISTEN_TEST_A1", skill_domain="listening", cefr_target="A1", difficulty_weight=1.0, examples="Test listening"),
                SkillNode(skill_id="SPEAK_TEST_A1", skill_domain="discourse", cefr_target="A1", difficulty_weight=1.0, examples="Test speaking"),
                SkillNode(skill_id="READ_TEST_A1", skill_domain="reading", cefr_target="A1", difficulty_weight=1.0, examples="Test reading"),
                SkillNode(skill_id="WRITE_TEST_A1", skill_domain="writing", cefr_target="A1", difficulty_weight=1.0, examples="Test writing"),
                SkillNode(skill_id="GATEKEEPER_B1", skill_domain="grammar", cefr_target="B1", difficulty_weight=1.3, examples="Gatekeeper skill"),
            ]
            _db.session.add_all(skills)
            states = [
                StudentSkillState(student_id=student.id, skill_id="GRAM_TEST_A1", mastery_score=0.8),
                StudentSkillState(student_id=student.id, skill_id="VOCAB_TEST_A1", mastery_score=0.6),
                StudentSkillState(student_id=student.id, skill_id="LISTEN_TEST_A1", mastery_score=0.4),
                StudentSkillState(student_id=student.id, skill_id="SPEAK_TEST_A1", mastery_score=0.2),
                StudentSkillState(student_id=student.id, skill_id="READ_TEST_A1", mastery_score=0.9),
                StudentSkillState(student_id=student.id, skill_id="WRITE_TEST_A1", mastery_score=0.1),
                StudentSkillState(student_id=student.id, skill_id="GATEKEEPER_B1", mastery_score=0.3),
            ]
            _db.session.add_all(states)
            _db.session.commit()

            result = compute_skill_gap(student.id, _db.session)

            assert isinstance(result, list)
            assert len(result) == 7

            # Verifica ordenação por gap decrescente
            gaps = [item["gap"] for item in result]
            assert gaps == sorted(gaps, reverse=True)

            # Verifica que contém os campos esperados
            for item in result:
                assert "skill_id" in item
                assert "gap" in item
                assert "mastery_score" in item

    def test_calculates_gap_correctly(self, app, sample_student, sample_states):
        """Verifica cálculo correto do gap = difficulty_weight * (1 - mastery_score)."""
        with app.app_context():
            result = compute_skill_gap(sample_student.id, _db.session)

            # Encontra o item para GRAM_TEST_A1 (weight=1.0, mastery=0.8, gap=0.2)
            gram_item = next(item for item in result if item["skill_id"] == "GRAM_TEST_A1")
            assert gram_item["gap"] == pytest.approx(0.2, rel=1e-4)

            # Encontra o item para WRITE_TEST_A1 (weight=1.0, mastery=0.1, gap=0.9)
            write_item = next(item for item in result if item["skill_id"] == "WRITE_TEST_A1")
            assert write_item["gap"] == pytest.approx(0.9, rel=1e-4)


class TestComputeAspectGaps:

    def test_returns_four_aspects_with_correct_sums(self, app, sample_student, sample_states):
        """compute_aspect_gaps deve retornar 4 aspectos com somas corretas."""
        with app.app_context():
            result = compute_aspect_gaps(sample_student.id, _db.session)

            assert isinstance(result, list)
            assert len(result) == 4

            aspect_names = [item["aspect"] for item in result]
            assert set(aspect_names) == {"listening", "speaking", "reading", "writing"}

            # Verifica que todos têm gap_total calculado
            for item in result:
                assert "gap_total" in item
                assert "skill_count" in item
                assert "top_skills" in item

    def test_sums_gaps_correctly_by_aspect(self, app, sample_student, sample_states):
        """Verifica somas corretas dos gaps por aspecto."""
        with app.app_context():
            result = compute_aspect_gaps(sample_student.id, _db.session)

            # Listening:
            #   LISTEN_TEST_A1 (domain=listening, 1 aspecto):  gap=0.6, share=0.6
            #   VOCAB_TEST_A1  (domain=vocabulary, 4 aspectos): gap=0.4, share=0.1
            #   Total = 0.7
            listening = next(item for item in result if item["aspect"] == "listening")
            assert listening["gap_total"] == pytest.approx(0.7, rel=1e-4)

            # Speaking:
            #   GRAM_TEST_A1   (domain=grammar,    2 aspectos): gap=0.2,  share=0.1
            #   VOCAB_TEST_A1  (domain=vocabulary, 4 aspectos): gap=0.4,  share=0.1
            #   SPEAK_TEST_A1  (domain=discourse,  2 aspectos): gap=0.8,  share=0.4
            #   GATEKEEPER_B1  (domain=grammar,    2 aspectos): gap=0.91, share=0.455
            #   Total = 1.055
            speaking = next(item for item in result if item["aspect"] == "speaking")
            assert speaking["gap_total"] == pytest.approx(1.055, rel=1e-4)


class TestComputeNextLevelDistance:

    def test_returns_0_percent_when_no_gatekeeper_above_threshold(self, app, sample_student, sample_skills):
        """Retorna 0% quando nenhum gatekeeper está acima do threshold."""
        with app.app_context():
            # Cria estado com mastery abaixo do threshold (0.65)
            state = StudentSkillState(student_id=sample_student.id, skill_id="GATEKEEPER_B1", mastery_score=0.5)
            _db.session.add(state)
            _db.session.commit()

            result = compute_next_level_distance(sample_student.id, "A1", _db.session)

            assert result["progress_to_next"] == 0.0

    def test_returns_100_percent_when_all_gatekeepers_above_threshold(self, app, sample_student, sample_skills):
        """Retorna 100% quando todos os gatekeepers estão acima do threshold."""
        with app.app_context():
            # Cria estado com mastery acima do threshold (0.65)
            state = StudentSkillState(student_id=sample_student.id, skill_id="GATEKEEPER_B1", mastery_score=0.8)
            _db.session.add(state)
            _db.session.commit()

            # GATEKEEPER_B1 tem cefr_target="B1" → é gatekeeper do nível A2→B1
            result = compute_next_level_distance(sample_student.id, "A2", _db.session)

            assert result["progress_to_next"] == 100.0

    def test_returns_correct_percentage_for_partial_mastery(self, app, sample_student, sample_skills):
        """Retorna porcentagem correta para domínio parcial."""
        with app.app_context():
            # Adiciona mais um gatekeeper no mesmo nível B1
            gatekeeper2 = SkillNode(skill_id="GATEKEEPER2_B1", skill_domain="vocabulary", cefr_target="B1", difficulty_weight=1.3, examples="Another gatekeeper")
            _db.session.add(gatekeeper2)
            _db.session.commit()

            # Um acima do threshold, um abaixo
            state1 = StudentSkillState(student_id=sample_student.id, skill_id="GATEKEEPER_B1", mastery_score=0.8)
            state2 = StudentSkillState(student_id=sample_student.id, skill_id="GATEKEEPER2_B1", mastery_score=0.5)
            _db.session.add_all([state1, state2])
            _db.session.commit()

            # GATEKEEPER_B1 e GATEKEEPER2_B1 têm cefr_target="B1" → gatekeepers de A2→B1
            result = compute_next_level_distance(sample_student.id, "A2", _db.session)

            assert result["progress_to_next"] == 50.0  # 1 de 2