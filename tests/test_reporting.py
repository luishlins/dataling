"""
tests/test_reporting.py
Testes de integração para POST /api/reporting/event.

Execução:
    pytest tests/test_reporting.py -v
"""

import pytest
from datetime import date

from app import app as flask_app
from extensions import db as _db
from models import Student, EvidenceEvent


# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
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
def client(app):
    return app.test_client()


@pytest.fixture(scope="function", autouse=True)
def clean_db(app):
    with app.app_context():
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()
    yield


@pytest.fixture(scope="function")
def student(app):
    """Cria e persiste um Student para usar nos testes."""
    with app.app_context():
        s = Student(name="Test Student", start_date=date(2024, 1, 1))
        _db.session.add(s)
        _db.session.commit()
        # Retorna o id escalar — evita DetachedInstanceError fora do contexto
        return s.id


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def post_event(client, payload):
    return client.post(
        "/api/reporting/event",
        json=payload,
        content_type="application/json",
    )


def valid_payload(student_id):
    """Payload mínimo válido para um evento de Mispronunciation."""
    return {
        "student_id":  student_id,
        "source_type": "grammar_flag",
        "raw_input":   "she said /θɪŋk/ as /tɪŋk/",
        "polarity":    -1,
        "severity":    1,
    }


# ─────────────────────────────────────────────────────────────
# Testes — criação bem-sucedida
# ─────────────────────────────────────────────────────────────

class TestCreateEvent:

    def test_valid_mispronunciation_returns_201(self, client, student):
        """POST com payload válido deve retornar 201."""
        response = post_event(client, valid_payload(student))
        assert response.status_code == 201

    def test_valid_mispronunciation_returns_json(self, client, student):
        """Resposta deve ser application/json."""
        response = post_event(client, valid_payload(student))
        assert response.content_type == "application/json"

    def test_response_contains_event_id(self, client, student):
        """Resposta deve conter o id do evento criado."""
        data = post_event(client, valid_payload(student)).get_json()
        assert "id" in data
        assert isinstance(data["id"], int)

    def test_response_mirrors_payload_fields(self, client, student):
        """Campos enviados devem estar na resposta."""
        payload  = valid_payload(student)
        data     = post_event(client, payload).get_json()

        assert data["student_id"]  == student
        assert data["source_type"] == payload["source_type"]
        assert data["raw_input"]   == payload["raw_input"]
        assert data["polarity"]    == payload["polarity"]
        assert data["severity"]    == payload["severity"]

    def test_event_persisted_in_database(self, client, student, app):
        """EvidenceEvent deve estar no banco após o POST."""
        post_event(client, valid_payload(student))

        with app.app_context():
            events = EvidenceEvent.query.filter_by(student_id=student).all()
            assert len(events) == 1
            assert events[0].source_module == "Reporting"

    def test_source_module_is_reporting(self, client, student):
        """source_module deve ser fixado como 'Reporting' pela rota."""
        data = post_event(client, valid_payload(student)).get_json()
        assert data["source_module"] == "Reporting"

    def test_timestamp_present(self, client, student):
        """Resposta deve incluir timestamp preenchido automaticamente."""
        data = post_event(client, valid_payload(student)).get_json()
        assert data["timestamp"] is not None

    def test_context_optional_field(self, client, student):
        """POST com context opcional deve retornar 201 e incluir o campo."""
        payload = {**valid_payload(student), "context": "Speaking task"}
        data    = post_event(client, payload).get_json()

        assert data["context"] == "Speaking task"

    def test_multiple_events_same_student(self, client, student, app):
        """Dois POSTs para o mesmo aluno devem criar dois eventos distintos."""
        post_event(client, valid_payload(student))
        post_event(client, valid_payload(student))

        with app.app_context():
            count = EvidenceEvent.query.filter_by(student_id=student).count()
            assert count == 2


# ─────────────────────────────────────────────────────────────
# Testes — skill_tags
# ─────────────────────────────────────────────────────────────

class TestSkillTags:

    def test_skill_tags_is_list(self, client, student):
        """skill_tags na resposta deve ser uma lista."""
        data = post_event(client, valid_payload(student)).get_json()
        assert "skill_tags" in data
        assert isinstance(data["skill_tags"], list)

    def test_skill_tags_items_have_skill_id(self, client, student):
        """Cada item em skill_tags deve ter o campo skill_id."""
        data = post_event(client, valid_payload(student)).get_json()
        for tag in data["skill_tags"]:
            assert "skill_id" in tag

    def test_skill_tags_items_have_confidence_score(self, client, student):
        """Cada item em skill_tags deve ter confidence_score entre 0 e 1."""
        data = post_event(client, valid_payload(student)).get_json()
        for tag in data["skill_tags"]:
            assert "confidence_score" in tag
            assert 0.0 <= tag["confidence_score"] <= 1.0


# ─────────────────────────────────────────────────────────────
# Testes — validação 400
# ─────────────────────────────────────────────────────────────

class TestValidation:

    def test_missing_student_id_returns_400(self, client):
        """POST sem student_id deve retornar 400."""
        payload = {
            "source_type": "grammar_flag",
            "raw_input":   "she don't use third person",
            "polarity":    -1,
            "severity":    1,
        }
        response = post_event(client, payload)
        assert response.status_code == 400

    def test_missing_student_id_error_message(self, client):
        """Resposta 400 por student_id ausente deve conter campo 'error'."""
        payload = {
            "source_type": "grammar_flag",
            "raw_input":   "she don't use third person",
            "polarity":    -1,
            "severity":    1,
        }
        data = post_event(client, payload).get_json()
        assert "error" in data

    def test_nonexistent_student_id_returns_400(self, client):
        """POST com student_id que não existe no banco deve retornar 400."""
        response = post_event(client, valid_payload(99999))
        assert response.status_code == 400

    def test_nonexistent_student_id_error_message(self, client):
        """Resposta 400 por student inexistente deve conter campo 'error'."""
        data = post_event(client, valid_payload(99999)).get_json()
        assert "error" in data

    def test_missing_source_type_returns_400(self, client, student):
        """POST sem source_type deve retornar 400."""
        payload = {k: v for k, v in valid_payload(student).items() if k != "source_type"}
        assert post_event(client, payload).status_code == 400

    def test_invalid_source_type_returns_400(self, client, student):
        """POST com source_type inválido deve retornar 400."""
        payload = {**valid_payload(student), "source_type": "unknown_type"}
        assert post_event(client, payload).status_code == 400

    def test_missing_raw_input_returns_400(self, client, student):
        """POST sem raw_input deve retornar 400."""
        payload = {k: v for k, v in valid_payload(student).items() if k != "raw_input"}
        assert post_event(client, payload).status_code == 400

    def test_invalid_polarity_returns_400(self, client, student):
        """POST com polarity fora de {-1, 1} deve retornar 400."""
        payload = {**valid_payload(student), "polarity": 0}
        assert post_event(client, payload).status_code == 400

    def test_invalid_severity_returns_400(self, client, student):
        """POST com severity fora de {1, 2, 3} deve retornar 400."""
        payload = {**valid_payload(student), "severity": 5}
        assert post_event(client, payload).status_code == 400

    def test_empty_raw_input_returns_400(self, client, student):
        """POST com raw_input em branco deve retornar 400."""
        payload = {**valid_payload(student), "raw_input": "   "}
        assert post_event(client, payload).status_code == 400

    def test_empty_body_returns_400(self, client):
        """POST sem corpo algum deve retornar 400."""
        response = client.post(
            "/api/reporting/event",
            data="",
            content_type="application/json",
        )
        assert response.status_code == 400
