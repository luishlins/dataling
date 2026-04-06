"""
tests/test_students.py
Testes de integração para as rotas de Student.

Execução:
    pytest tests/test_students.py -v
"""

import pytest

from app import app as flask_app
from extensions import db as _db


# ─────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def app():
    """
    Cria uma instância do Flask configurada para testes.
    - Banco em memória (SQLite) — isolado, descartado ao final.
    - TESTING=True desativa o tratamento de exceções do Flask,
      deixando o pytest capturar os erros diretamente.
    - scope="session": a app é criada uma única vez por sessão
      de testes (mais rápido).
    """
    flask_app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
    })

    with flask_app.app_context():
        _db.create_all()   # cria todas as tabelas no banco em memória
        yield flask_app
        _db.drop_all()     # limpa tudo ao encerrar a sessão


@pytest.fixture(scope="function")
def client(app):
    """
    Retorna o test client do Flask.
    scope="function": cada teste recebe um client limpo.
    """
    return app.test_client()


@pytest.fixture(scope="function", autouse=True)
def clean_db(app):
    """
    Limpa todas as tabelas antes de cada teste para garantir
    isolamento — sem dependência de ordem de execução.
    autouse=True: aplicado automaticamente a todos os testes
    sem precisar declarar como parâmetro.
    """
    with app.app_context():
        # Deleta registros sem recriar o schema (mais rápido que drop_all)
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()
    yield


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def post_student(client, payload):
    """Atalho para POST /api/students com corpo JSON."""
    return client.post(
        "/api/students",
        json=payload,               # json= serializa e define Content-Type automaticamente
        content_type="application/json",
    )


# ─────────────────────────────────────────────────────────────
# Testes — GET /api/students
# ─────────────────────────────────────────────────────────────

class TestListStudents:

    def test_returns_empty_list_when_no_students(self, client):
        """GET /api/students deve retornar [] e 200 com banco vazio."""
        response = client.get("/api/students")

        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        assert data == []

    def test_returns_all_students(self, client):
        """GET /api/students deve retornar todos os alunos criados."""
        post_student(client, {"name": "Alice",   "start_date": "2024-01-10"})
        post_student(client, {"name": "Bob",     "start_date": "2024-02-15"})
        post_student(client, {"name": "Charlie", "start_date": "2024-03-20"})

        response = client.get("/api/students")

        assert response.status_code == 200
        data = response.get_json()
        assert len(data) == 3
        names = {s["name"] for s in data}
        assert names == {"Alice", "Bob", "Charlie"}

    def test_response_is_json(self, client):
        """GET /api/students deve responder com Content-Type application/json."""
        response = client.get("/api/students")
        assert response.content_type == "application/json"


# ─────────────────────────────────────────────────────────────
# Testes — POST /api/students
# ─────────────────────────────────────────────────────────────

class TestCreateStudent:

    def test_valid_payload_returns_201(self, client):
        """POST com name e start_date válidos deve retornar 201."""
        response = post_student(client, {
            "name": "Maria Silva",
            "start_date": "2024-03-01",
        })

        assert response.status_code == 201

    def test_valid_payload_returns_student_data(self, client):
        """Corpo da resposta deve conter os dados do aluno criado."""
        response = post_student(client, {
            "name": "Maria Silva",
            "start_date": "2024-03-01",
        })

        data = response.get_json()
        assert data["name"] == "Maria Silva"
        assert data["start_date"] == "2024-03-01"
        assert "id" in data            # id foi gerado pelo banco
        assert "created_at" in data    # campo automático está presente

    def test_created_student_appears_in_list(self, client):
        """Aluno criado via POST deve aparecer no GET subsequente."""
        post_student(client, {"name": "João Santos", "start_date": "2024-05-01"})

        response = client.get("/api/students")
        names = [s["name"] for s in response.get_json()]
        assert "João Santos" in names

    def test_missing_name_returns_400(self, client):
        """POST sem 'name' deve retornar 400."""
        response = post_student(client, {"start_date": "2024-03-01"})

        assert response.status_code == 400

    def test_missing_start_date_returns_400(self, client):
        """POST sem 'start_date' deve retornar 400."""
        response = post_student(client, {"name": "Ana Lima"})

        assert response.status_code == 400

    def test_missing_both_fields_returns_400(self, client):
        """POST com payload vazio deve retornar 400."""
        response = post_student(client, {})

        assert response.status_code == 400

    def test_missing_name_error_message(self, client):
        """Resposta 400 deve conter campo 'error' com mensagem descritiva."""
        response = post_student(client, {"start_date": "2024-03-01"})

        data = response.get_json()
        assert "error" in data
        assert "name" in data["error"].lower()

    def test_empty_body_returns_400(self, client):
        """POST sem corpo algum deve retornar 400."""
        response = client.post(
            "/api/students",
            data="",
            content_type="application/json",
        )
        assert response.status_code == 400

    def test_invalid_date_format_returns_400(self, client):
        """POST com start_date em formato inválido deve retornar 400."""
        response = post_student(client, {
            "name": "Test User",
            "start_date": "01/03/2024",   # formato BR — inválido para a API
        })

        assert response.status_code == 400


# ─────────────────────────────────────────────────────────────
# Testes — GET /api/students/<id>
# ─────────────────────────────────────────────────────────────

class TestGetStudent:

    def test_existing_id_returns_200(self, client):
        """GET /api/students/<id> com id existente deve retornar 200."""
        created = post_student(client, {
            "name": "Carlos Mendes",
            "start_date": "2024-06-01",
        }).get_json()

        response = client.get(f"/api/students/{created['id']}")

        assert response.status_code == 200

    def test_existing_id_returns_correct_student(self, client):
        """Resposta deve conter os dados do aluno correto."""
        created = post_student(client, {
            "name": "Lucia Ferreira",
            "start_date": "2024-07-15",
        }).get_json()

        data = client.get(f"/api/students/{created['id']}").get_json()

        assert data["id"]         == created["id"]
        assert data["name"]       == "Lucia Ferreira"
        assert data["start_date"] == "2024-07-15"

    def test_nonexistent_id_returns_404(self, client):
        """GET /api/students/<id> com id inexistente deve retornar 404."""
        response = client.get("/api/students/99999")

        assert response.status_code == 404

    def test_nonexistent_id_error_message(self, client):
        """Resposta 404 deve conter campo 'error'."""
        response = client.get("/api/students/99999")

        data = response.get_json()
        assert "error" in data


# ─────────────────────────────────────────────────────────────
# Testes — PUT /api/students/<id>
# ─────────────────────────────────────────────────────────────

class TestUpdateStudent:

    def test_update_name_returns_200(self, client):
        """PUT com name válido deve retornar 200."""
        created = post_student(client, {
            "name": "Pedro Costa",
            "start_date": "2024-08-01",
        }).get_json()

        response = client.put(
            f"/api/students/{created['id']}",
            json={"name": "Pedro Costa Silva"},
            content_type="application/json",
        )

        assert response.status_code == 200

    def test_update_name_persists(self, client):
        """Nome atualizado via PUT deve ser retornado no GET seguinte."""
        created = post_student(client, {
            "name": "Ana Souza",
            "start_date": "2024-09-10",
        }).get_json()

        client.put(
            f"/api/students/{created['id']}",
            json={"name": "Ana Souza Lima"},
            content_type="application/json",
        )

        data = client.get(f"/api/students/{created['id']}").get_json()
        assert data["name"] == "Ana Souza Lima"

    def test_update_nonexistent_id_returns_404(self, client):
        """PUT em id inexistente deve retornar 404."""
        response = client.put(
            "/api/students/99999",
            json={"name": "Ghost"},
            content_type="application/json",
        )

        assert response.status_code == 404


# ─────────────────────────────────────────────────────────────
# Testes — DELETE /api/students/<id>
# ─────────────────────────────────────────────────────────────

class TestDeleteStudent:

    def test_delete_existing_returns_200(self, client):
        """DELETE em id existente deve retornar 200."""
        created = post_student(client, {
            "name": "Marcos Lima",
            "start_date": "2024-10-01",
        }).get_json()

        response = client.delete(f"/api/students/{created['id']}")

        assert response.status_code == 200

    def test_deleted_student_not_found(self, client):
        """GET após DELETE deve retornar 404."""
        created = post_student(client, {
            "name": "Sofia Ramos",
            "start_date": "2024-11-01",
        }).get_json()

        client.delete(f"/api/students/{created['id']}")
        response = client.get(f"/api/students/{created['id']}")

        assert response.status_code == 404

    def test_delete_nonexistent_id_returns_404(self, client):
        """DELETE em id inexistente deve retornar 404."""
        response = client.delete("/api/students/99999")

        assert response.status_code == 404
