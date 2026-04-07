from datetime import datetime, timezone, timedelta
from sqlalchemy import update, select, text
from models.student_skill_state import StudentSkillState
from models.evidence_event import EvidenceEvent, evidence_skill_tags


def compute_recency_weight(last_updated_datetime):
    """
    Retorna um float entre 0.5 e 1.0 baseado em quantos dias se passaram desde last_updated.
    - < 1 dia: 1.0
    - 7 dias: 0.8
    - 30 dias: 0.6
    - > 90 dias: 0.5
    """
    now = datetime.now(timezone.utc)
    if last_updated_datetime.tzinfo is None:
        last_updated_datetime = last_updated_datetime.replace(tzinfo=timezone.utc)
    days_passed = (now - last_updated_datetime).days

    if days_passed < 1:
        return 1.0
    elif days_passed <= 7:
        # Interpola linearmente de 1.0 (dia 1) para 0.8 (dia 7)
        return 1.0 - (days_passed - 1) * (0.2 / 6)
    elif days_passed <= 30:
        # De 0.8 (dia 7) para 0.6 (dia 30)
        return 0.8 - (days_passed - 7) * (0.2 / 23)
    elif days_passed <= 90:
        # De 0.6 (dia 30) para 0.5 (dia 90)
        return 0.6 - (days_passed - 30) * (0.1 / 60)
    else:
        return 0.5


def update_mastery(student_id, skill_id, polarity, severity, db_session):
    """
    Busca ou cria o StudentSkillState para o par student-skill;
    calcula o delta como polarity * severity * 0.1 * recency_weight;
    clipa mastery_score entre 0.05 e 0.95;
    atualiza error_streak e success_streak;
    se success_streak >= 3, reduz o peso de evidências negativas anteriores registrando resolved_at;
    salva e retorna o StudentSkillState atualizado.
    """
    # Busca ou cria o StudentSkillState
    state = db_session.query(StudentSkillState).filter_by(
        student_id=student_id, skill_id=skill_id
    ).first()

    if not state:
        state = StudentSkillState(
            student_id=student_id,
            skill_id=skill_id,
            mastery_score=0.5,
            error_streak=0,
            success_streak=0,
            last_updated=datetime.now(timezone.utc)
        )
        db_session.add(state)
        db_session.flush()  # Para obter o id se necessário

    # Calcula recency_weight
    recency_weight = compute_recency_weight(state.last_updated)

    # Calcula delta
    delta = polarity * severity * 0.1 * recency_weight

    # Atualiza mastery_score e clipa
    state.mastery_score += delta
    state.mastery_score = max(0.05, min(0.95, state.mastery_score))

    # Atualiza streaks
    if polarity == 1:
        state.success_streak += 1
        state.error_streak = 0
    else:
        state.error_streak += 1
        state.success_streak = 0

    # Se success_streak >= 3, resolve evidências negativas anteriores
    if state.success_streak >= 3:
        # Verifica se há evidências negativas para este student
        has_negative = db_session.query(
            db_session.query(EvidenceEvent.id).filter(
                EvidenceEvent.student_id == student_id,
                EvidenceEvent.polarity == -1
            ).exists()
        ).scalar()
        if has_negative:
            # Atualiza resolved_at nas tags de evidências negativas para este student e skill
            db_session.execute(
                text("""
                    UPDATE evidence_skill_tags
                    SET resolved_at = :resolved_at
                    WHERE skill_id = :skill_id
                      AND evidence_id IN (
                          SELECT id FROM evidence_events
                          WHERE student_id = :student_id AND polarity = -1
                      )
                      AND resolved_at IS NULL
                """),
                {
                    'resolved_at': datetime.now(timezone.utc),
                    'skill_id': skill_id,
                    'student_id': student_id
                }
            )

    # Atualiza last_updated
    state.last_updated = datetime.now(timezone.utc)

    # Salva
    db_session.commit()

    return state


def process_evidence_event(event_id, db_session):
    """
    Busca um EvidenceEvent pelo id, para cada skill tagueado chama update_mastery,
    e retorna a lista de StudentSkillStates atualizados.
    """
    event = db_session.query(EvidenceEvent).filter_by(id=event_id).first()
    if not event:
        raise ValueError(f"EvidenceEvent with id {event_id} not found")

    updated_states = []
    for skill in event.skill_tags:
        state = update_mastery(
            event.student_id,
            skill.skill_id,
            event.polarity,
            event.severity,
            db_session
        )
        updated_states.append(state)

    return updated_states