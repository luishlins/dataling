from datetime import datetime, timezone, timedelta

from models.student_skill_state import StudentSkillState
from models.evidence_event import EvidenceEvent, evidence_skill_tags
from models.skill_node import SkillNode


def compute_level_estimate(student_id, db_session, skill_domains=None):
    """
    Calcula a estimativa de nível CEFR para um aluno baseado nos StudentSkillStates.

    Parâmetro skill_domains: opcional, string ou lista de strings com domínios de skill a considerar.
    Se None, considera todos os domínios.

    Retorna um dicionário com:
    - overall_level: nível CEFR estimado (A1-C2) ou None
    - confidence: confiança da estimativa (0.0-1.0)
    - fit_scores_by_level: dicionário com fit_score para cada nível CEFR
    """
    # Busca todos os StudentSkillStates do aluno
    query = db_session.query(StudentSkillState).filter_by(student_id=student_id)
    if skill_domains is not None:
        if isinstance(skill_domains, str):
            skill_domains = [skill_domains]
        # Filtra por domínios
        query = query.join(SkillNode).filter(SkillNode.skill_domain.in_(skill_domains))
    else:
        # Mesmo assim precisa join para acessar skill
        query = query.join(SkillNode)
    
    skill_states = query.all()

    # Níveis CEFR
    cefr_levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

    fit_scores_by_level = {}

    for level in cefr_levels:
        # Filtra skills para este nível
        level_skills = [state for state in skill_states if state.skill.cefr_target == level]

        if not level_skills:
            fit_scores_by_level[level] = None
            continue

        # Calcula numerador: soma de (mastery_score * difficulty_weight)
        numerator = sum(state.mastery_score * state.skill.difficulty_weight for state in level_skills)

        # Calcula denominador: soma de difficulty_weight
        denominator = sum(state.skill.difficulty_weight for state in level_skills)

        if denominator == 0:
            fit_scores_by_level[level] = None
        else:
            fit_scores_by_level[level] = numerator / denominator

    # Escolhe nível estimado: maior fit_score > 0.6
    overall_level = None
    max_fit = 0.0
    for level, fit in fit_scores_by_level.items():
        if fit is not None and fit > 0.6 and fit > max_fit:
            max_fit = fit
            overall_level = level

    # Calcula confiança: min(1.0, total_evidencias / 20)
    total_evidences = db_session.query(EvidenceEvent).filter_by(student_id=student_id).count()
    confidence = min(1.0, total_evidences / 20.0)

    return {
        'overall_level': overall_level,
        'confidence': confidence,
        'fit_scores_by_level': fit_scores_by_level
    }


def compute_evidence_coverage(student_id, db_session):
    """
    Para cada macro-habilidade, retorna:
    - "covered": tem EvidenceEvent com skill_tag no domínio correspondente nos últimos 30 dias
    - "stale":   tem evidência, mas com mais de 30 dias
    - "missing": sem nenhuma evidência nos domínios correspondentes

    Mapeamento macro → skill_domains:
      Listening → ["listening"]
      Speaking  → ["phonology", "discourse"]
      Reading   → ["reading"]
      Writing   → ["writing"]
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    macro_map = {
        "Listening": ["listening"],
        "Speaking":  ["phonology", "discourse"],
        "Reading":   ["reading"],
        "Writing":   ["writing"],
    }

    result = {}

    for macro, domains in macro_map.items():
        latest = (
            db_session.query(EvidenceEvent)
            .join(evidence_skill_tags, evidence_skill_tags.c.evidence_id == EvidenceEvent.id)
            .join(SkillNode, SkillNode.skill_id == evidence_skill_tags.c.skill_id)
            .filter(
                EvidenceEvent.student_id == student_id,
                SkillNode.skill_domain.in_(domains),
            )
            .order_by(EvidenceEvent.timestamp.desc())
            .first()
        )

        if latest is None:
            result[macro] = "missing"
        else:
            ts = latest.timestamp
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            result[macro] = "covered" if ts >= cutoff else "stale"

    return result


def compute_all_skill_estimates(student_id, db_session):
    """
    Calcula estimativas de nível CEFR para cada macro-habilidade do aluno.

    Retorna um dicionário com chaves 'listening', 'speaking', 'reading', 'writing',
    cada uma contendo o resultado de compute_level_estimate para os respectivos domínios.
    """
    return {
        'listening': compute_level_estimate(student_id, db_session, 'listening'),
        'speaking': compute_level_estimate(student_id, db_session, ['phonology', 'discourse']),
        'reading': compute_level_estimate(student_id, db_session, 'reading'),
        'writing': compute_level_estimate(student_id, db_session, 'writing'),
    }