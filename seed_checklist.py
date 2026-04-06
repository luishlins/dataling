"""
seed_checklist.py
Insere os 72 itens do checklist de avaliação de fala do DataLing.

check_id prefixes:
  FL  — Fluency (10 items)
  CO  — Coherence (10 items)
  GA  — GrammarAccuracy (10 items)
  GR  — GrammarRange (10 items)
  LR  — LexicalRange (8 items)
  LP  — LexicalPrecision (7 items)
  PS  — PronunciationSound (5 items)
  PP  — PronunciationProsody (5 items)
  IN  — Interaction (7 items)

Uso:
    python seed_checklist.py
"""

from app import app
from extensions import db
from models.checklist_item import ChecklistItem

CHECKLIST_ITEMS = [

    # ── Fluency (FL) ──────────────────────────────────────────
    {
        "check_id": "FL_001",
        "dimension": "Fluency",
        "question_text": "Did the student speak continuously without long silent pauses (>3 seconds) more than twice?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "FL_002",
        "dimension": "Fluency",
        "question_text": "Did the student avoid frequent restarting of sentences (false starts) that disrupted communication?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "FL_003",
        "dimension": "Fluency",
        "question_text": "Did the student maintain a generally steady speaking pace (not extremely slow or rushed)?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "FL_004",
        "dimension": "Fluency",
        "question_text": "Did the student avoid excessive filler use (\"uh\", \"um\", \"like\") that distracted from meaning?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "FL_005",
        "dimension": "Fluency",
        "question_text": "Did the student complete most sentences without abandoning them midway?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "FL_006",
        "dimension": "Fluency",
        "question_text": "Did the student avoid repeating the same phrase multiple times to buy time?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "FL_007",
        "dimension": "Fluency",
        "question_text": "Did the student speak in multi-sentence stretches (not only isolated short answers) when the prompt required it?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "FL_008",
        "dimension": "Fluency",
        "question_text": "Did the student show improvement in fluency after the first 10–15 seconds (warm-up effect)?",
        "weight": 0.8,
        "typical_cefr_floor": None,
    },
    {
        "check_id": "FL_009",
        "dimension": "Fluency",
        "question_text": "Did the student self-correct smoothly without losing the thread of the message?",
        "weight": 1.0,
        "typical_cefr_floor": "B2",
    },
    {
        "check_id": "FL_010",
        "dimension": "Fluency",
        "question_text": "Did the student use pausing mostly for planning ideas rather than searching for basic words/grammar? (Yes = good)",
        "weight": 1.0,
        "typical_cefr_floor": "B2",
    },

    # ── Coherence (CO) ────────────────────────────────────────
    {
        "check_id": "CO_001",
        "dimension": "Coherence",
        "question_text": "Did the student organize ideas in a clear order (beginning → middle → end) for this prompt?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "CO_002",
        "dimension": "Coherence",
        "question_text": "Did the student use basic linking words appropriately (and, but, because, so)?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "CO_003",
        "dimension": "Coherence",
        "question_text": "Did the student use higher-level discourse markers when needed (however, therefore, on the other hand)?",
        "weight": 1.0,
        "typical_cefr_floor": "B2",
    },
    {
        "check_id": "CO_004",
        "dimension": "Coherence",
        "question_text": "Did the student make the main point easy to identify within the first 20–30 seconds?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "CO_005",
        "dimension": "Coherence",
        "question_text": "Did the student keep the answer on-topic without drifting into unrelated details?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "CO_006",
        "dimension": "Coherence",
        "question_text": "Did the student support opinions with at least one reason or example when required?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "CO_007",
        "dimension": "Coherence",
        "question_text": "Did the student avoid \"jumpiness\" (sudden topic changes without transition)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "CO_008",
        "dimension": "Coherence",
        "question_text": "Did the student use referencing (this/that/these/those, it, they) clearly so the listener could follow?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "CO_009",
        "dimension": "Coherence",
        "question_text": "Did the student conclude or wrap up the response instead of stopping abruptly?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "CO_010",
        "dimension": "Coherence",
        "question_text": "Did the student use clarification phrases to maintain coherence when stuck (e.g., \"What I mean is…\")?",
        "weight": 1.0,
        "typical_cefr_floor": "B2",
    },

    # ── GrammarAccuracy (GA) ──────────────────────────────────
    {
        "check_id": "GA_001",
        "dimension": "GrammarAccuracy",
        "question_text": "Were basic sentence patterns mostly accurate (subject–verb agreement, basic word order)?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "GA_002",
        "dimension": "GrammarAccuracy",
        "question_text": "Did the student avoid frequent tense errors that changed the intended time meaning?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "GA_003",
        "dimension": "GrammarAccuracy",
        "question_text": "Did the student generally form questions correctly (auxiliary use, inversion) when asking questions?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "GA_004",
        "dimension": "GrammarAccuracy",
        "question_text": "Did the student generally form negatives correctly (don't/doesn't/didn't; not placement)?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "GA_005",
        "dimension": "GrammarAccuracy",
        "question_text": "Did articles (a/an/the) appear appropriate most of the time for the student's level?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "GA_006",
        "dimension": "GrammarAccuracy",
        "question_text": "Were prepositions mostly accurate in common phrases (in/on/at; to/for; interested in)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "GA_007",
        "dimension": "GrammarAccuracy",
        "question_text": "Did pronouns refer clearly and correctly (he/she/they; him/her/them)?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "GA_008",
        "dimension": "GrammarAccuracy",
        "question_text": "Did the student avoid frequent missing verbs (e.g., \"He happy\" instead of \"He is happy\")?",
        "weight": 1.0,
        "typical_cefr_floor": "A1",
    },
    {
        "check_id": "GA_009",
        "dimension": "GrammarAccuracy",
        "question_text": "Did the student avoid frequent missing subjects (e.g., \"Is raining\" instead of \"It's raining\") when that disrupts meaning?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "GA_010",
        "dimension": "GrammarAccuracy",
        "question_text": "When errors occurred, did they rarely block understanding? (Yes = good)",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },

    # ── GrammarRange (GR) ─────────────────────────────────────
    {
        "check_id": "GR_001",
        "dimension": "GrammarRange",
        "question_text": "Did the student use more than one tense/aspect appropriately within the response (when relevant)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "GR_002",
        "dimension": "GrammarRange",
        "question_text": "Did the student use at least some complex sentences (because/although/when/if) instead of only simple ones?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "GR_003",
        "dimension": "GrammarRange",
        "question_text": "Did the student attempt relative clauses (who/which/that) or similar elaboration strategies?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "GR_004",
        "dimension": "GrammarRange",
        "question_text": "Did the student show any control of modality (can/could/should/must/might) appropriate to meaning?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "GR_005",
        "dimension": "GrammarRange",
        "question_text": "Did the student show ability to express hypothetical or conditional meaning (if… would… / had… would have…) when relevant?",
        "weight": 1.0,
        "typical_cefr_floor": "B2",
    },
    {
        "check_id": "GR_006",
        "dimension": "GrammarRange",
        "question_text": "Did the student use comparatives/superlatives or comparison structures accurately when needed?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "GR_007",
        "dimension": "GrammarRange",
        "question_text": "Did the student use passive voice appropriately at least once when it fit the message (optional/advanced)?",
        "weight": 0.8,
        "typical_cefr_floor": "B2",
    },
    {
        "check_id": "GR_008",
        "dimension": "GrammarRange",
        "question_text": "Did the student use noun phrases with some complexity (e.g., \"the biggest problem in my job\") rather than only single nouns?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "GR_009",
        "dimension": "GrammarRange",
        "question_text": "Did the student avoid over-reliance on one \"default\" structure (e.g., only present simple) across the whole response?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "GR_010",
        "dimension": "GrammarRange",
        "question_text": "Did the student avoid clear avoidance behavior (e.g., refusing to answer any part that requires a certain structure)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },

    # ── LexicalRange (LR) ─────────────────────────────────────
    {
        "check_id": "LR_001",
        "dimension": "LexicalRange",
        "question_text": "Did the student use vocabulary beyond very basic/high-frequency words to express the intended meaning?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "LR_002",
        "dimension": "LexicalRange",
        "question_text": "Did the student vary word choice instead of repeating the same adjectives (good/nice/bad) where alternatives were needed?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "LR_003",
        "dimension": "LexicalRange",
        "question_text": "Did the student use topic-appropriate vocabulary for the prompt (travel, work, education, etc.)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "LR_004",
        "dimension": "LexicalRange",
        "question_text": "Did the student show ability to paraphrase when they didn't know a word?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "LR_005",
        "dimension": "LexicalRange",
        "question_text": "Did the student use at least some multiword expressions/chunks (e.g., \"in my opinion\", \"as far as I know\")?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "LR_006",
        "dimension": "LexicalRange",
        "question_text": "Did the student use at least one correct collocation or natural phrase (e.g., \"make a decision\", \"take a break\")?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "LR_007",
        "dimension": "LexicalRange",
        "question_text": "Did the student use some phrasal verbs or idiomatic phrasing appropriately for their level (optional/advanced)?",
        "weight": 0.8,
        "typical_cefr_floor": "B2",
    },
    {
        "check_id": "LR_008",
        "dimension": "LexicalRange",
        "question_text": "Did the student avoid frequent \"Portuguese-to-English literal translations\" that caused unnaturalness?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },

    # ── LexicalPrecision (LP) ─────────────────────────────────
    {
        "check_id": "LP_001",
        "dimension": "LexicalPrecision",
        "question_text": "Were key content words accurate (the word used matched the intended meaning)?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "LP_002",
        "dimension": "LexicalPrecision",
        "question_text": "Did the student avoid frequent wrong word choices that forced the listener to guess the meaning?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "LP_003",
        "dimension": "LexicalPrecision",
        "question_text": "Did the student use appropriate register (not overly informal for a formal scenario, if applicable)?",
        "weight": 1.0,
        "typical_cefr_floor": "B2",
    },
    {
        "check_id": "LP_004",
        "dimension": "LexicalPrecision",
        "question_text": "Did the student use quantifiers and degree words accurately (very, too, enough, a lot, a few)?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "LP_005",
        "dimension": "LexicalPrecision",
        "question_text": "Did the student keep vocabulary consistent with the scenario (e.g., not mixing unrelated domains)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "LP_006",
        "dimension": "LexicalPrecision",
        "question_text": "When the student used advanced vocabulary, was it mostly used correctly (not \"big words\" used inaccurately)?",
        "weight": 1.0,
        "typical_cefr_floor": "B2",
    },
    {
        "check_id": "LP_007",
        "dimension": "LexicalPrecision",
        "question_text": "Did the student show adequate vocabulary for describing processes, reasons, or steps (first/then/because)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },

    # ── PronunciationSound (PS) ───────────────────────────────
    {
        "check_id": "PS_001",
        "dimension": "PronunciationSound",
        "question_text": "Was the student generally understandable without frequent repetition requests?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "PS_002",
        "dimension": "PronunciationSound",
        "question_text": "Did the student articulate consonants/vowels clearly enough that key words were identifiable?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "PS_003",
        "dimension": "PronunciationSound",
        "question_text": "Did mispronunciations rarely change the word into another word (minimal-pair confusion)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "PS_004",
        "dimension": "PronunciationSound",
        "question_text": "Did the student avoid systematically dropping important endings (plural -s, past -ed) in a way that hurts meaning?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "PS_005",
        "dimension": "PronunciationSound",
        "question_text": "Did the student handle consonant clusters reasonably (e.g., \"tests\", \"skills\") for their level?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },

    # ── PronunciationProsody (PP) ─────────────────────────────
    {
        "check_id": "PP_001",
        "dimension": "PronunciationProsody",
        "question_text": "Was word stress generally correct on common multi-syllable words (e.g., imPORtant vs IMportant)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "PP_002",
        "dimension": "PronunciationProsody",
        "question_text": "Did sentence stress highlight important information (not monotone throughout)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "PP_003",
        "dimension": "PronunciationProsody",
        "question_text": "Did intonation patterns support meaning (e.g., rising in questions, appropriate emphasis)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "PP_004",
        "dimension": "PronunciationProsody",
        "question_text": "Did connected speech features (linking/reductions) not prevent understanding (either in production or clarity)?",
        "weight": 1.0,
        "typical_cefr_floor": "B2",
    },
    {
        "check_id": "PP_005",
        "dimension": "PronunciationProsody",
        "question_text": "Did the student avoid a rhythm so syllable-by-syllable that it severely impacted naturalness? (Yes = good)",
        "weight": 1.0,
        "typical_cefr_floor": "B2",
    },

    # ── Interaction (IN) ──────────────────────────────────────
    {
        "check_id": "IN_001",
        "dimension": "Interaction",
        "question_text": "When asked follow-up questions, did the student respond directly and appropriately?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "IN_002",
        "dimension": "Interaction",
        "question_text": "Did the student ask for clarification when needed (\"Could you repeat that?\") instead of freezing?",
        "weight": 1.0,
        "typical_cefr_floor": "A2",
    },
    {
        "check_id": "IN_003",
        "dimension": "Interaction",
        "question_text": "Did the student repair communication breakdowns effectively (rephrasing, giving examples)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "IN_004",
        "dimension": "Interaction",
        "question_text": "Did the student use turn-taking signals appropriately (e.g., \"Let me think…\", \"Can I add…\")?",
        "weight": 1.0,
        "typical_cefr_floor": "B2",
    },
    {
        "check_id": "IN_005",
        "dimension": "Interaction",
        "question_text": "Did the student show active listening behaviors in interaction tasks (short acknowledgements, relevant responses)?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "IN_006",
        "dimension": "Interaction",
        "question_text": "Did the student manage politeness appropriately (requests, disagreement) for the scenario?",
        "weight": 1.0,
        "typical_cefr_floor": "B1",
    },
    {
        "check_id": "IN_007",
        "dimension": "Interaction",
        "question_text": "Overall: did the student accomplish the communicative goal of the prompt? (Yes/No)",
        "weight": 1.5,
        "typical_cefr_floor": None,
    },
]


def seed():
    with app.app_context():
        inserted = 0
        skipped  = 0

        for item_data in CHECKLIST_ITEMS:
            exists = ChecklistItem.query.filter_by(check_id=item_data["check_id"]).first()
            if exists:
                print(f"  [skip]   {item_data['check_id']}")
                skipped += 1
                continue

            item = ChecklistItem(**item_data)
            db.session.add(item)
            print(f"  [insert] {item_data['check_id']}  {item_data['dimension']}")
            inserted += 1

        db.session.commit()
        print(f"\n✓ Seed concluído — {inserted} inseridos, {skipped} ignorados.")
        print(f"  Total definido: {len(CHECKLIST_ITEMS)}")


if __name__ == "__main__":
    seed()
