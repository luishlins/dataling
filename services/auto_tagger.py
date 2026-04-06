"""
services/auto_tagger.py

Serviço de auto-tagging: recebe texto bruto do professor e o tipo de entrada,
e retorna uma lista ranqueada de SkillNodes candidatos com confidence_score.

source_types suportados:
  - "grammar_flag"   : erro gramatical observado pelo professor
  - "free_note"      : anotação livre de texto
  - "test_response"  : resposta de um teste do aluno

Uso:
    from services.auto_tagger import auto_tag

    results = auto_tag("she don't use third person", "grammar_flag")
    # [{"skill_id": "GRAM_PRESENT_SIMPLE_A1", "skill_domain": "grammar",
    #   "cefr_target": "A1", "confidence_score": 0.87}, ...]
"""

from __future__ import annotations

import re
from typing import Literal

from extensions import db
from models import SkillNode

# ─────────────────────────────────────────────────────────────
# Tipos aceitos
# ─────────────────────────────────────────────────────────────

SourceType = Literal["grammar_flag", "free_note", "test_response"]

VALID_SOURCE_TYPES: set[str] = {"grammar_flag", "free_note", "test_response"}

# ─────────────────────────────────────────────────────────────
# Stopwords — palavras que não contribuem para o matching
# ─────────────────────────────────────────────────────────────

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would",
    "can", "could", "should", "may", "might", "shall",
    "i", "you", "he", "she", "it", "we", "they",
    "in", "on", "at", "to", "for", "of", "with", "by",
    "and", "or", "but", "not", "no",
    "this", "that", "these", "those",
}

# ─────────────────────────────────────────────────────────────
# Helpers internos
# ─────────────────────────────────────────────────────────────

def _tokenize(text: str) -> list[str]:
    """
    Converte texto para minúsculas, remove pontuação e filtra stopwords.
    Retorna lista de tokens significativos com pelo menos 3 caracteres.
    """
    text = text.lower()
    tokens = re.findall(r"[a-z']+", text)
    return [t for t in tokens if len(t) >= 3 and t not in _STOPWORDS]


def _score_example_match(tokens: list[str], examples: str | None) -> float:
    """
    Calcula um score de 0–1 baseado na proporção de tokens do input
    encontrados no campo examples do SkillNode.

    Lógica:
      - Cada token encontrado nos examples contribui com 1 ponto.
      - Score = pontos / total de tokens (proporção de cobertura).
      - Aplicamos sqrt para suavizar: correspondências parciais ainda
        recebem score razoável sem precisar acertar todos os tokens.
    """
    if not examples or not tokens:
        return 0.0

    examples_lower = examples.lower()
    hits = sum(1 for t in tokens if t in examples_lower)

    if hits == 0:
        return 0.0

    raw_score = hits / len(tokens)
    # sqrt suaviza a curva: 0.25 → 0.5, 0.5 → 0.71, 1.0 → 1.0
    return round(raw_score ** 0.5, 4)


def _score_skill_id_match(tokens: list[str], skill_id: str) -> float:
    """
    Verifica se algum token aparece como substring no skill_id.
    Usado exclusivamente para grammar_flag, onde o professor frequentemente
    menciona construções gramaticais pelo nome (ex: "passive voice").
    Retorna 0.3 fixo por match (bônus, não score principal).
    """
    skill_id_lower = skill_id.lower().replace("_", " ")
    for token in tokens:
        if token in skill_id_lower:
            return 0.3
    return 0.0


def _score_domain_match(tokens: list[str], skill_domain: str) -> float:
    """
    Verifica se algum token é o próprio nome do domínio.
    Ex: "grammar" no input → bônus para skills de domínio grammar.
    Retorna 0.2 fixo por match.
    """
    if skill_domain in tokens:
        return 0.2
    return 0.0


def _clamp(value: float) -> float:
    """Garante que o score fique no intervalo [0.0, 1.0]."""
    return max(0.0, min(1.0, round(value, 4)))


# ─────────────────────────────────────────────────────────────
# Queries por source_type
# ─────────────────────────────────────────────────────────────

def _query_candidates_grammar_flag(tokens: list[str]) -> list[SkillNode]:
    """
    Para grammar_flag buscamos mais amplamente:
      - examples LIKE qualquer token
      - OU skill_id LIKE qualquer token
      - OU skill_domain == qualquer token que seja um domínio válido

    Retorna todos os candidatos sem filtrar — o scoring faz a triagem.
    """
    if not tokens:
        return []

    valid_domains = {"grammar", "vocabulary", "phonology", "discourse"}
    domain_tokens = [t for t in tokens if t in valid_domains]

    conditions = []

    # examples contém algum token
    for token in tokens:
        conditions.append(SkillNode.examples.ilike(f"%{token}%"))

    # skill_id contém algum token (ex: "passive" → GRAM_PASSIVE_VOICE_B1)
    for token in tokens:
        conditions.append(SkillNode.skill_id.ilike(f"%{token}%"))

    # domínio explicitamente mencionado
    for domain in domain_tokens:
        conditions.append(SkillNode.skill_domain == domain)

    from sqlalchemy import or_
    return SkillNode.query.filter(or_(*conditions)).all()


def _query_candidates_general(tokens: list[str]) -> list[SkillNode]:
    """
    Para free_note e test_response buscamos apenas em examples.
    Mais conservador — reduz ruído para anotações genéricas.
    """
    if not tokens:
        return []

    from sqlalchemy import or_
    conditions = [SkillNode.examples.ilike(f"%{token}%") for token in tokens]
    return SkillNode.query.filter(or_(*conditions)).all()


# ─────────────────────────────────────────────────────────────
# Função principal
# ─────────────────────────────────────────────────────────────

def auto_tag(
    raw_input: str,
    source_type: SourceType,
    min_confidence: float = 0.15,
    max_results: int = 10,
) -> list[dict]:
    """
    Recebe texto do professor e o tipo de entrada; retorna lista ranqueada
    de SkillNodes candidatos com confidence_score.

    Parâmetros:
        raw_input       : texto bruto digitado pelo professor
        source_type     : "grammar_flag" | "free_note" | "test_response"
        min_confidence  : score mínimo para incluir na resposta (padrão 0.15)
        max_results     : número máximo de resultados (padrão 10)

    Retorna:
        Lista de dicts ordenada por confidence_score DESC:
        [
            {
                "skill_id":        "GRAM_PRESENT_SIMPLE_A1",
                "skill_domain":    "grammar",
                "cefr_target":     "A1",
                "confidence_score": 0.87,
            },
            ...
        ]

    Raises:
        ValueError: se source_type não for um dos valores válidos
        ValueError: se raw_input for vazio ou apenas whitespace
    """

    # ── Validação de entrada ──────────────────────────────────
    if not raw_input or not raw_input.strip():
        raise ValueError("raw_input não pode ser vazio.")

    if source_type not in VALID_SOURCE_TYPES:
        raise ValueError(
            f"source_type inválido: '{source_type}'. "
            f"Valores aceitos: {', '.join(sorted(VALID_SOURCE_TYPES))}."
        )

    # ── Tokenização ───────────────────────────────────────────
    tokens = _tokenize(raw_input)

    if not tokens:
        # Input continha apenas stopwords ou pontuação — sem tokens úteis
        return []

    # ── Query ao banco ────────────────────────────────────────
    if source_type == "grammar_flag":
        candidates = _query_candidates_grammar_flag(tokens)
    else:
        # free_note e test_response usam a query geral
        candidates = _query_candidates_general(tokens)

    if not candidates:
        return []

    # ── Scoring ───────────────────────────────────────────────
    results = []

    for skill in candidates:
        # Score base: qualidade do match nos examples
        score = _score_example_match(tokens, skill.examples)

        # Bônus exclusivos para grammar_flag
        if source_type == "grammar_flag":
            score += _score_skill_id_match(tokens, skill.skill_id)
            score += _score_domain_match(tokens, skill.skill_domain)

        score = _clamp(score)

        if score >= min_confidence:
            results.append({
                "skill_id":         skill.skill_id,
                "skill_domain":     skill.skill_domain,
                "cefr_target":      skill.cefr_target,
                "confidence_score": score,
            })

    # ── Ordenação e limite ────────────────────────────────────
    results.sort(key=lambda x: x["confidence_score"], reverse=True)
    return results[:max_results]
