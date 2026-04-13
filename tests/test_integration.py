"""
tests/test_integration.py

Testes de integração de fluxo completo:
  Criar aluno → registrar EvidenceEvents → verificar StudentSkillStates →
  nível CEFR estimado (level-estimate) → gap analysis com 5 itens.

Execução:
    pytest tests/test_integration.py -v
"""

import pytest
from datetime import date

from app import app as flask_app
from extensions import db as _db
from models import Student, SkillNode, StudentSkillState


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


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _post_student(client, name="Integration Student", start_date="2024-01-15"):
    res = client.post(
        "/api/students",
        json={"name": name, "start_date": start_date},
        content_type="application/json",
    )
    assert res.status_code == 201, f"POST /api/students falhou: {res.get_json()}"
    return res.get_json()["id"]


def _post_event(client, payload):
    return client.post(
        "/api/reporting/event",
        json=payload,
        content_type="application/json",
    )


def _seed_skills(app):
    """
    Insere 7 SkillNodes no banco:
      - 2 em A1 com examples que combinam com os eventos positivos
        → após 3 eventos severity=3, mastery chega a 0.95 (clipped),
          garantindo fit_score_A1 > 0.6 para level-estimate
      - 5 em B1 com mastery baixo (injetado direto)
        → fornecem os 5 itens de top_5_to_fix em gap-analysis
    """
    with app.app_context():
        skills = [
            # A1 — alvo dos eventos positivos
            SkillNode(
                skill_id="INT_A1_GRAM_01", skill_domain="grammar",
                cefr_target="A1", difficulty_weight=1.0,
                examples="present simple conjugation verb",
            ),
            SkillNode(
                skill_id="INT_A1_GRAM_02", skill_domain="grammar",
                cefr_target="A1", difficulty_weight=1.0,
                examples="articles usage correct definite indefinite",
            ),
            # B1 — skills com mastery baixo para compor os 5 gaps
            SkillNode(
                skill_id="INT_B1_GRAM_01", skill_domain="grammar",
                cefr_target="B1", difficulty_weight=1.0,
                examples="passive voice construction sentences",
            ),
            SkillNode(
                skill_id="INT_B1_GRAM_02", skill_domain="grammar",
                cefr_target="B1", difficulty_weight=1.0,
                examples="conditional sentences hypothetical clauses",
            ),
            SkillNode(
                skill_id="INT_B1_VOCAB_01", skill_domain="vocabulary",
                cefr_target="B1", difficulty_weight=1.0,
                examples="academic vocabulary formal register terms",
            ),
            SkillNode(
                skill_id="INT_B1_LISTEN_01", skill_domain="listening",
                cefr_target="B1", difficulty_weight=1.0,
                examples="listening complex lecture notes",
            ),
            SkillNode(
                skill_id="INT_B1_SPEAK_01", skill_domain="discourse",
                cefr_target="B1", difficulty_weight=1.0,
                examples="discourse coherence cohesion markers",
            ),
        ]
        _db.session.add_all(skills)
        _db.session.commit()


def _inject_b1_states(app, student_id, mastery=0.2):
    """Injeta/atualiza StudentSkillStates com mastery baixo para os 5 skills B1.

    Sempre sobrescreve states existentes para garantir mastery=mastery mesmo que
    os eventos de setup tenham taggeado algum skill B1 indiretamente (ex: substring
    "form" matchando "formal" no campo examples).
    """
    b1_ids = [
        "INT_B1_GRAM_01", "INT_B1_GRAM_02", "INT_B1_VOCAB_01",
        "INT_B1_LISTEN_01", "INT_B1_SPEAK_01",
    ]
    with app.app_context():
        for skill_id in b1_ids:
            state = StudentSkillState.query.filter_by(
                student_id=student_id, skill_id=skill_id
            ).first()
            if state:
                state.mastery_score = mastery
            else:
                _db.session.add(StudentSkillState(
                    student_id=student_id,
                    skill_id=skill_id,
                    mastery_score=mastery,
                ))
        _db.session.commit()


# Eventos positivos que elevam mastery dos skills A1 acima de 0.6
# raw_input projeta tokens que combinam com os examples de INT_A1_GRAM_01 e INT_A1_GRAM_02
_POSITIVE_EVENTS = [
    # tags INT_A1_GRAM_01 e possivelmente INT_A1_GRAM_02 (token "correct")
    {
        "source_type": "grammar_flag",
        "raw_input":   "correct use present simple conjugation verb",
        "polarity":    1,
        "severity":    3,
    },
    # tags INT_A1_GRAM_02 (tokens articles, usage, correct, definite)
    {
        "source_type": "grammar_flag",
        "raw_input":   "articles usage correct definite form",
        "polarity":    1,
        "severity":    3,
    },
]

# Os 5 eventos do fluxo completo (tipos variados)
_FIVE_EVENTS = [
    {
        "source_type": "grammar_flag",
        "raw_input":   "correct use present simple conjugation verb",
        "polarity":    1,
        "severity":    3,
    },
    {
        "source_type": "grammar_flag",
        "raw_input":   "articles usage correct definite form",
        "polarity":    1,
        "severity":    2,
    },
    {
        "source_type": "grammar_flag",
        "raw_input":   "passive voice construction errors observed",
        "polarity":    -1,
        "severity":    1,
    },
    {
        "source_type": "free_note",
        "raw_input":   "listening complex lecture notes very difficult",
        "polarity":    -1,
        "severity":    1,
    },
    {
        "source_type": "test_response",
        "raw_input":   "discourse coherence cohesion issues present",
        "polarity":    -1,
        "severity":    1,
    },
]


# ─────────────────────────────────────────────────────────────
# Testes — fluxo completo
# ─────────────────────────────────────────────────────────────

class TestCompleteStudentFlow:
    """
    Cobre o fluxo completo do professor:
      1. Cria aluno  2. Registra 5 EvidenceEvents de tipos distintos
      3. Verifica StudentSkillStates atualizados
      4. Verifica level-estimate retorna overall_level != None
      5. Verifica gap-analysis retorna top_5_to_fix com 5 itens
    """

    # ── 1. Criar aluno ────────────────────────────────────────

    def test_step1_create_student(self, client):
        """POST /api/students retorna 201 com dados do aluno."""
        res = client.post(
            "/api/students",
            json={"name": "Ana Lima", "start_date": "2024-03-01"},
            content_type="application/json",
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data["name"] == "Ana Lima"
        assert "id" in data

    # ── 2. Registrar 5 EvidenceEvents ────────────────────────

    def test_step2_register_five_events(self, client, app):
        """5 EvidenceEvents de tipos diferentes são aceitos e retornam 201."""
        student_id = _post_student(client, name="Event Student")
        _seed_skills(app)

        for ev in _FIVE_EVENTS:
            res = _post_event(client, {**ev, "student_id": student_id})
            assert res.status_code == 201, (
                f"Evento {ev['source_type']} falhou: {res.get_json()}"
            )

    def test_step2_event_types_coverage(self, client, app):
        """Os 5 eventos cobrem os source_types esperados."""
        student_id = _post_student(client, name="Types Student")
        _seed_skills(app)

        source_types_used = set()
        for ev in _FIVE_EVENTS:
            res = _post_event(client, {**ev, "student_id": student_id})
            assert res.status_code == 201
            source_types_used.add(ev["source_type"])

        # Deve cobrir pelo menos 3 source_types distintos
        assert len(source_types_used) >= 3, (
            f"Esperados ≥3 source_types, encontrados: {source_types_used}"
        )

    # ── 3. StudentSkillStates atualizados ─────────────────────

    def test_step3_skill_states_created(self, client, app):
        """Após eventos com skill_tags, StudentSkillStates são criados."""
        student_id = _post_student(client, name="State Student")
        _seed_skills(app)

        # Eventos que devem gerar skill_tags (grammar_flag → auto_tag ativo)
        for ev in _POSITIVE_EVENTS:
            _post_event(client, {**ev, "student_id": student_id})

        with app.app_context():
            states = StudentSkillState.query.filter_by(student_id=student_id).all()
            assert len(states) >= 1, (
                "Pelo menos um StudentSkillState deve existir após eventos com skill_tags"
            )

    def test_step3_mastery_updated_positive(self, client, app):
        """Eventos positivos (polarity=1) aumentam mastery acima do valor inicial."""
        student_id = _post_student(client, name="Mastery Student")
        _seed_skills(app)

        # Registra 3 eventos positivos de alta severidade para INT_A1_GRAM_01
        for _ in range(3):
            _post_event(client, {
                "student_id":  student_id,
                "source_type": "grammar_flag",
                "raw_input":   "present simple conjugation verb correct",
                "polarity":    1,
                "severity":    3,
            })

        with app.app_context():
            state = StudentSkillState.query.filter_by(
                student_id=student_id, skill_id="INT_A1_GRAM_01"
            ).first()
            assert state is not None
            # Mastery deve ter subido do valor inicial (0.5) após 3 eventos polarity=1
            assert state.mastery_score > 0.5, (
                f"mastery_score={state.mastery_score} deveria ser > 0.5 após eventos positivos"
            )

    # ── 4. level-estimate retorna nível não nulo ──────────────

    def test_step4_level_estimate_returns_level(self, client, app):
        """
        Após eventos positivos suficientes, level-estimate retorna
        overall_level != None.

        Lógica: 3 rounds de severity=3 elevam mastery dos 2 skills A1 para
        0.95 (clipped). fit_score_A1 = 0.95 > 0.6 → overall_level = 'A1'.
        """
        student_id = _post_student(client, name="Level Student")
        _seed_skills(app)

        # 3 rounds para garantir mastery >> 0.6 nos skills A1
        for _ in range(3):
            for ev in _POSITIVE_EVENTS:
                _post_event(client, {**ev, "student_id": student_id})

        res = client.get(f"/api/students/{student_id}/level-estimate")
        assert res.status_code == 200

        data = res.get_json()
        assert data["overall"]["level"] is not None, (
            "overall_level deve ser não nulo após múltiplos eventos positivos de alta severidade"
        )

    def test_step4_level_estimate_includes_coverage(self, client, app):
        """A resposta de level-estimate inclui o campo evidence_coverage."""
        student_id = _post_student(client, name="Coverage Student")
        _seed_skills(app)

        for ev in _POSITIVE_EVENTS:
            _post_event(client, {**ev, "student_id": student_id})

        res = client.get(f"/api/students/{student_id}/level-estimate")
        assert res.status_code == 200

        data = res.get_json()
        assert "evidence_coverage" in data, "Campo evidence_coverage deve estar na resposta"
        coverage = data["evidence_coverage"]
        for skill in ("Listening", "Speaking", "Reading", "Writing"):
            assert skill in coverage
            assert coverage[skill] in ("covered", "stale", "missing")

    # ── 5. gap-analysis retorna top_5_to_fix com 5 itens ─────

    def test_step5_gap_analysis_returns_5_items(self, client, app):
        """
        gap-analysis retorna top_5_to_fix com exatamente 5 itens.

        Pré-condição: level-estimate deve retornar um nível válido (caso
        contrário a rota retorna 400). Garantido pelos eventos positivos + skills A1.
        Os 5 itens vêm dos 5 skills B1 injetados com mastery=0.2.
        """
        student_id = _post_student(client, name="Gap Student")
        _seed_skills(app)

        # Eleva mastery dos A1 para que level-estimate funcione
        for _ in range(3):
            for ev in _POSITIVE_EVENTS:
                _post_event(client, {**ev, "student_id": student_id})

        # Injeta 5 skills B1 com mastery baixo
        _inject_b1_states(app, student_id, mastery=0.2)

        res = client.get(f"/api/students/{student_id}/gap-analysis")
        assert res.status_code == 200, (
            f"gap-analysis retornou {res.status_code}: {res.get_json()}"
        )

        data = res.get_json()
        assert "top_5_to_fix" in data
        assert len(data["top_5_to_fix"]) == 5, (
            f"Esperados 5 itens em top_5_to_fix, obtidos {len(data['top_5_to_fix'])}"
        )

    def test_step5_gap_analysis_b1_items_have_low_mastery(self, client, app):
        """Os itens de top_5_to_fix têm mastery_score baixo (skills com maior gap)."""
        student_id = _post_student(client, name="Gap Mastery Student")
        _seed_skills(app)

        for _ in range(3):
            for ev in _POSITIVE_EVENTS:
                _post_event(client, {**ev, "student_id": student_id})

        _inject_b1_states(app, student_id, mastery=0.2)

        data = client.get(f"/api/students/{student_id}/gap-analysis").get_json()
        for item in data["top_5_to_fix"]:
            assert item["mastery_score"] <= 0.5, (
                f"skill {item['skill_id']} tem mastery={item['mastery_score']} "
                f"mas deveria ser baixo (gap alto)"
            )

    # ── Fluxo completo em sequência ───────────────────────────

    def test_complete_flow_end_to_end(self, client, app):
        """
        Executa o fluxo completo em um único teste sequencial:
          aluno → 5 eventos → estados → level-estimate → gap-analysis.
        """
        # ── 1. Criar aluno ────────────────────────────────────
        student_id = _post_student(client, name="Full Flow Student", start_date="2024-06-01")
        assert isinstance(student_id, int)

        _seed_skills(app)

        # ── 2. Registrar 5 EvidenceEvents de tipos diferentes ─
        for ev in _FIVE_EVENTS:
            res = _post_event(client, {**ev, "student_id": student_id})
            assert res.status_code == 201

        # ── 3. Verificar StudentSkillStates atualizados ───────
        # Acumula mais eventos positivos para elevar mastery dos A1
        for _ in range(2):
            for ev in _POSITIVE_EVENTS:
                _post_event(client, {**ev, "student_id": student_id})

        with app.app_context():
            states = StudentSkillState.query.filter_by(student_id=student_id).all()
            assert len(states) >= 1, "StudentSkillStates devem existir após os eventos"

        # ── 4. level-estimate retorna overall_level != None ───
        res = client.get(f"/api/students/{student_id}/level-estimate")
        assert res.status_code == 200
        level_data = res.get_json()
        assert level_data["overall"]["level"] is not None

        # ── 5. gap-analysis retorna top_5_to_fix com 5 itens ─
        _inject_b1_states(app, student_id, mastery=0.2)

        res = client.get(f"/api/students/{student_id}/gap-analysis")
        assert res.status_code == 200
        gap_data = res.get_json()
        assert len(gap_data["top_5_to_fix"]) == 5
