"""
services/gap_analyzer.py

Análise de lacunas de habilidade (skill gap analysis) para o DataLing.

Funções públicas:
  compute_skill_gap(student_id, db_session)
      → lista de gaps por skill, ordenada por gap decrescente

  compute_aspect_gaps(student_id, db_session)
      → gaps agrupados por macro-habilidade (listening, speaking, reading, writing)

  compute_next_level_distance(student_id, current_level, db_session)
      → progresso em direção ao próximo nível CEFR, top clusters, study targets
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from models import SkillNode, StudentSkillState

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

# Sequência de níveis CEFR — usada para determinar o próximo nível
_CEFR_SEQUENCE = ["A1", "A2", "B1", "B2", "C1", "C2"]

# Threshold de mastery para considerar uma gatekeeper skill "dominada"
_MASTERY_THRESHOLD = 0.65

# difficulty_weight mínimo para classificar uma skill como gatekeeper
_GATEKEEPER_WEIGHT = 1.2

# Mapeamento de skill_domain → macro-habilidade
# Domínios que não aparecem aqui são tratados como transversais e contribuem
# para todos os quatro aspectos com peso reduzido (0.25 cada)
_DOMAIN_TO_ASPECTS: dict[str, list[str]] = {
    "grammar":    ["speaking", "writing"],
    "vocabulary": ["speaking", "writing", "reading", "listening"],
    "phonology":  ["speaking", "listening"],
    "discourse":  ["speaking", "writing"],
    "listening":  ["listening"],
    "reading":    ["reading"],
    "writing":    ["writing"],
}

_ALL_ASPECTS = ["listening", "speaking", "reading", "writing"]


# ─────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────

def _load_states_with_skills(
    student_id: int, db_session
) -> list[tuple[StudentSkillState, SkillNode]]:
    """
    Carrega todos os StudentSkillStates do aluno com seus SkillNodes via JOIN.
    Retorna lista de tuplas (state, skill).
    """
    from sqlalchemy import select

    rows = db_session.execute(
        select(StudentSkillState, SkillNode)
        .join(SkillNode, SkillNode.skill_id == StudentSkillState.skill_id)
        .where(StudentSkillState.student_id == student_id)
    ).all()

    return [(row[0], row[1]) for row in rows]


def _gap(state: StudentSkillState, skill: SkillNode) -> float:
    """
    gap = difficulty_weight * (1 - mastery_score)

    Interpretação:
      - Uma skill difícil (weight alto) com baixo domínio tem gap alto.
      - Uma skill fácil totalmente dominada tem gap próximo de zero.
      - O gap reflete tanto a importância da skill quanto o quanto falta dominar.
    """
    return round(skill.difficulty_weight * (1.0 - state.mastery_score), 4)


# ─────────────────────────────────────────────────────────────
# compute_skill_gap
# ─────────────────────────────────────────────────────────────

def compute_skill_gap(
    student_id: int,
    db_session,
) -> list[dict[str, Any]]:
    """
    Para cada StudentSkillState do aluno, calcula:
        gap = difficulty_weight * (1 - mastery_score)

    Retorna lista de dicts ordenada por gap decrescente, enriquecida com
    os campos do SkillNode correspondente.

    Parâmetros:
        student_id  : id do aluno
        db_session  : SQLAlchemy session (flask: db.session)

    Retorno exemplo:
        [
            {
                "skill_id":         "GRAM_PASSIVE_VOICE_B1",
                "skill_domain":     "grammar",
                "cefr_target":      "B1",
                "difficulty_weight": 1.3,
                "mastery_score":    0.35,
                "gap":              0.845,
                "error_streak":     2,
                "success_streak":   0,
                "last_updated":     "2026-04-06T22:10:13...",
            },
            ...
        ]
    """
    pairs = _load_states_with_skills(student_id, db_session)

    results = []
    for state, skill in pairs:
        results.append({
            "skill_id":          skill.skill_id,
            "skill_domain":      skill.skill_domain,
            "cefr_target":       skill.cefr_target,
            "difficulty_weight": skill.difficulty_weight,
            "mastery_score":     round(state.mastery_score, 4),
            "gap":               _gap(state, skill),
            "error_streak":      state.error_streak,
            "success_streak":    state.success_streak,
            "last_updated":      state.last_updated.isoformat() if state.last_updated else None,
        })

    results.sort(key=lambda x: x["gap"], reverse=True)
    return results


# ─────────────────────────────────────────────────────────────
# compute_aspect_gaps
# ─────────────────────────────────────────────────────────────

def compute_aspect_gaps(
    student_id: int,
    db_session,
) -> list[dict[str, Any]]:
    """
    Agrupa os gaps individuais por macro-habilidade:
        listening | speaking | reading | writing

    O gap de uma skill é distribuído proporcionalmente entre os aspectos
    que seu domínio afeta. Por exemplo, "phonology" afeta speaking e listening,
    então seu gap contribui 50% para cada.

    Retorna os quatro aspectos ordenados por gap_total decrescente.

    Retorno exemplo:
        [
            {"aspect": "speaking",  "gap_total": 4.82, "skill_count": 12, "top_skills": [...]},
            {"aspect": "writing",   "gap_total": 3.17, "skill_count": 8,  "top_skills": [...]},
            {"aspect": "reading",   "gap_total": 2.44, "skill_count": 6,  "top_skills": [...]},
            {"aspect": "listening", "gap_total": 1.93, "skill_count": 7,  "top_skills": [...]},
        ]
    """
    pairs = _load_states_with_skills(student_id, db_session)

    # Acumuladores por aspecto
    aspect_gap_total: dict[str, float]        = defaultdict(float)
    aspect_skill_count: dict[str, int]         = defaultdict(int)
    aspect_top_skills: dict[str, list[dict]]  = defaultdict(list)

    for state, skill in pairs:
        gap = _gap(state, skill)
        if gap <= 0:
            continue

        aspects = _DOMAIN_TO_ASPECTS.get(skill.skill_domain, _ALL_ASPECTS)
        share = gap / len(aspects)  # distribui igualmente entre os aspectos afetados

        for aspect in aspects:
            aspect_gap_total[aspect]   += share
            aspect_skill_count[aspect] += 1
            aspect_top_skills[aspect].append({
                "skill_id":      skill.skill_id,
                "gap":           gap,
                "mastery_score": round(state.mastery_score, 4),
                "cefr_target":   skill.cefr_target,
            })

    # Garante que todos os 4 aspectos aparecem na resposta mesmo sem dados
    results = []
    for aspect in _ALL_ASPECTS:
        top = sorted(
            aspect_top_skills.get(aspect, []),
            key=lambda x: x["gap"],
            reverse=True,
        )[:5]  # top 5 skills por aspecto

        results.append({
            "aspect":      aspect,
            "gap_total":   round(aspect_gap_total.get(aspect, 0.0), 4),
            "skill_count": aspect_skill_count.get(aspect, 0),
            "top_skills":  top,
        })

    results.sort(key=lambda x: x["gap_total"], reverse=True)
    return results


# ─────────────────────────────────────────────────────────────
# compute_next_level_distance
# ─────────────────────────────────────────────────────────────

def compute_next_level_distance(
    student_id: int,
    current_level: str,
    db_session,
) -> dict[str, Any]:
    """
    Calcula a distância do aluno em direção ao próximo nível CEFR.

    Lógica:
      1. Determina o próximo nível (ex: B1 → B2).
      2. Filtra SkillNodes com cefr_target == próximo nível
         e difficulty_weight >= 1.2 (gatekeeper skills).
      3. Para cada gatekeeper, verifica se o aluno tem StudentSkillState
         com mastery_score >= 0.65.
      4. Calcula progress_to_next = gatekeepers dominadas / total gatekeepers.
      5. Identifica top 3 skill clusters (domínios) com maior gap médio.
      6. Retorna study targets: skill_ids específicos com maior gap.

    Parâmetros:
        student_id    : id do aluno
        current_level : nível atual (ex: "B1")
        db_session    : SQLAlchemy session

    Retorno exemplo:
        {
            "current_level":     "B1",
            "next_level":        "B2",
            "gatekeepers_total": 14,
            "gatekeepers_mastered": 6,
            "progress_to_next":  42.9,   # percentual
            "top_clusters": [
                {"domain": "grammar",    "avg_gap": 0.72, "skill_count": 5},
                {"domain": "phonology",  "avg_gap": 0.61, "skill_count": 3},
                {"domain": "vocabulary", "avg_gap": 0.54, "skill_count": 4},
            ],
            "study_targets": ["GRAM_PASSIVE_VOICE_B1", "PHON_NUCLEAR_STRESS_B1", ...],
            "note": "..."
        }
    """
    level_upper = current_level.strip().upper()

    # ── 1. Determina próximo nível ────────────────────────────
    if level_upper not in _CEFR_SEQUENCE:
        return {
            "error": f"Nível CEFR inválido: '{current_level}'. "
                     f"Use um de: {', '.join(_CEFR_SEQUENCE)}."
        }

    current_idx = _CEFR_SEQUENCE.index(level_upper)
    if current_idx >= len(_CEFR_SEQUENCE) - 1:
        return {
            "current_level":    level_upper,
            "next_level":       None,
            "progress_to_next": 100.0,
            "note":             "Nível máximo (C2) já atingido.",
            "top_clusters":     [],
            "study_targets":    [],
        }

    next_level = _CEFR_SEQUENCE[current_idx + 1]

    # ── 2. Carrega gatekeeper skills do próximo nível ─────────
    from sqlalchemy import select

    gatekeeper_skills: list[SkillNode] = db_session.execute(
        select(SkillNode).where(
            SkillNode.cefr_target == next_level,
            SkillNode.difficulty_weight >= _GATEKEEPER_WEIGHT,
        )
    ).scalars().all()

    if not gatekeeper_skills:
        return {
            "current_level":       level_upper,
            "next_level":          next_level,
            "gatekeepers_total":   0,
            "gatekeepers_mastered": 0,
            "progress_to_next":    0.0,
            "top_clusters":        [],
            "study_targets":       [],
            "note": f"Nenhuma gatekeeper skill encontrada para {next_level}.",
        }

    gatekeeper_ids = {s.skill_id for s in gatekeeper_skills}

    # ── 3. Carrega estados do aluno para essas skills ─────────
    state_rows = db_session.execute(
        select(StudentSkillState).where(
            StudentSkillState.student_id == student_id,
            StudentSkillState.skill_id.in_(gatekeeper_ids),
        )
    ).scalars().all()

    state_map: dict[str, StudentSkillState] = {s.skill_id: s for s in state_rows}

    # ── 4. Calcula progresso ──────────────────────────────────
    mastered_count = 0
    skill_gaps: list[dict] = []

    for skill in gatekeeper_skills:
        state = state_map.get(skill.skill_id)
        mastery = state.mastery_score if state else 0.5  # prior neutro se sem histórico

        is_mastered = mastery >= _MASTERY_THRESHOLD
        if is_mastered:
            mastered_count += 1

        gap = _gap(state, skill) if state else skill.difficulty_weight * 0.5
        skill_gaps.append({
            "skill_id":          skill.skill_id,
            "skill_domain":      skill.skill_domain,
            "cefr_target":       skill.cefr_target,
            "difficulty_weight": skill.difficulty_weight,
            "mastery_score":     round(mastery, 4),
            "gap":               round(gap, 4),
            "is_mastered":       is_mastered,
        })

    total = len(gatekeeper_skills)
    progress_pct = round(mastered_count / total * 100, 1) if total else 0.0

    # ── 5. Top 3 clusters (domínios) com maior gap médio ─────
    domain_gaps: dict[str, list[float]] = defaultdict(list)
    for sg in skill_gaps:
        if not sg["is_mastered"]:
            domain_gaps[sg["skill_domain"]].append(sg["gap"])

    top_clusters = sorted(
        [
            {
                "domain":      domain,
                "avg_gap":     round(sum(gaps) / len(gaps), 4),
                "skill_count": len(gaps),
            }
            for domain, gaps in domain_gaps.items()
        ],
        key=lambda x: x["avg_gap"],
        reverse=True,
    )[:3]

    # ── 6. Study targets: top 5 skill_ids com maior gap ──────
    study_targets = [
        sg["skill_id"]
        for sg in sorted(skill_gaps, key=lambda x: x["gap"], reverse=True)
        if not sg["is_mastered"]
    ][:5]

    return {
        "current_level":        level_upper,
        "next_level":           next_level,
        "gatekeepers_total":    total,
        "gatekeepers_mastered": mastered_count,
        "progress_to_next":     progress_pct,
        "top_clusters":         top_clusters,
        "study_targets":        study_targets,
        "gatekeeper_detail":    sorted(skill_gaps, key=lambda x: x["gap"], reverse=True),
    }
