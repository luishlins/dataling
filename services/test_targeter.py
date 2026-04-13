import json
from datetime import datetime, timezone, timedelta

from models.student_skill_state import StudentSkillState
from models.test_item import TestItem
from models.advised_vocab import AdvisedVocabItem
from models.test_session import TestSessionResult
from services.level_estimator import compute_level_estimate

_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']


def compute_item_relevance(student_id, item_id, db_session) -> float:
    """
    Calcula a relevância de um TestItem para um aluno:

    gap_score       = média de (1 - mastery_score) para cada skill em item.skills_tested
                      (skill sem state assume mastery_score=0.0)
    recency_penalty = 0.5 se o item foi aplicado ao aluno nos últimos 7 dias
                      0.8 se nos últimos 30 dias
                      1.0 caso contrário
    advising_bonus  = +0.2 se algum vocab_target do item coincide com um
                      AdvisedVocabItem do aluno com priority_weight > 1.0

    Retorna: gap_score * recency_penalty + advising_bonus
    """
    item = db_session.get(TestItem, item_id)
    if item is None:
        return 0.0

    # --- gap_score ---
    skills = item.skills_tested
    if skills:
        skill_ids = [s.skill_id for s in skills]
        states = (
            db_session.query(StudentSkillState)
            .filter_by(student_id=student_id)
            .filter(StudentSkillState.skill_id.in_(skill_ids))
            .all()
        )
        mastery_by_skill = {s.skill_id: s.mastery_score for s in states}
        gap_score = sum(1.0 - mastery_by_skill.get(sid, 0.0) for sid in skill_ids) / len(skill_ids)
    else:
        gap_score = 0.0

    # --- recency_penalty ---
    now = datetime.now(timezone.utc)
    last_result = (
        db_session.query(TestSessionResult)
        .join(TestSessionResult.session)
        .filter(
            TestSessionResult.item_id == item_id,
            TestSessionResult.session.has(student_id=student_id),
        )
        .order_by(TestSessionResult.answered_at.desc())
        .first()
    )
    if last_result is not None:
        answered = last_result.answered_at
        if answered.tzinfo is None:
            answered = answered.replace(tzinfo=timezone.utc)
        delta = now - answered
        if delta <= timedelta(days=7):
            recency_penalty = 0.5
        elif delta <= timedelta(days=30):
            recency_penalty = 0.8
        else:
            recency_penalty = 1.0
    else:
        recency_penalty = 1.0

    # --- advising_bonus ---
    try:
        vocab_targets = json.loads(item.vocab_targets) if item.vocab_targets else []
    except (ValueError, TypeError):
        vocab_targets = []

    advising_bonus = 0.0
    if vocab_targets:
        advised_terms = {
            row.term
            for row in db_session.query(AdvisedVocabItem)
            .filter_by(student_id=student_id)
            .filter(AdvisedVocabItem.priority_weight > 1.0)
            .all()
        }
        if advised_terms & set(vocab_targets):
            advising_bonus = 0.2

    return gap_score * recency_penalty + advising_bonus


def select_items_for_session(student_id, session_type, n_items, db_session) -> list:
    """
    Seleciona os TestItems mais relevantes para uma sessão:

    1. Filtra por item_type == session_type.
    2. Filtra por target_cefr dentro de ±1 nível do nível CEFR estimado do aluno
       (se não houver estimativa, considera todos os níveis).
    3. Ordena por compute_item_relevance desc e retorna os top n_items.
    """
    estimate = compute_level_estimate(student_id, db_session)
    overall_level = estimate.get('overall_level')

    if overall_level and overall_level in _CEFR_LEVELS:
        idx = _CEFR_LEVELS.index(overall_level)
        allowed = {_CEFR_LEVELS[i] for i in range(max(0, idx - 1), min(len(_CEFR_LEVELS), idx + 2))}
    else:
        allowed = set(_CEFR_LEVELS)

    candidates = (
        db_session.query(TestItem)
        .filter(
            TestItem.item_type == session_type,
            TestItem.target_cefr.in_(allowed),
        )
        .all()
    )

    scored = [
        (item, compute_item_relevance(student_id, item.id, db_session))
        for item in candidates
    ]
    scored.sort(key=lambda x: x[1], reverse=True)

    return [item for item, _ in scored[:n_items]]
