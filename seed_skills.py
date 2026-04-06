"""
seed_skills.py
Popula o banco com SkillNodes cobrindo grammar, vocabulary, phonology e discourse
nos níveis A1, A2, B1 e B2.

Uso:
    python seed_skills.py
"""

from app import app
from extensions import db
from models import SkillNode

# ---------------------------------------------------------------------------
# Definição dos nós
# Campos: skill_id, skill_domain, cefr_target, difficulty_weight, examples
# ---------------------------------------------------------------------------

SKILL_NODES = [

    # ════════════════════════════════════════════════════════════
    # GRAMMAR — A1
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "GRAM_VERB_TO_BE_A1",
        "skill_domain": "grammar",
        "cefr_target": "A1",
        "difficulty_weight": 0.8,
        "examples": "She is a teacher.; They are from Brazil.",
    },
    {
        "skill_id": "GRAM_PRESENT_SIMPLE_A1",
        "skill_domain": "grammar",
        "cefr_target": "A1",
        "difficulty_weight": 1.0,
        "examples": "He works every day.; I drink coffee in the morning.",
    },
    {
        "skill_id": "GRAM_ARTICLES_A1",
        "skill_domain": "grammar",
        "cefr_target": "A1",
        "difficulty_weight": 0.9,
        "examples": "I have a dog.; The sun rises in the east.",
    },
    {
        "skill_id": "GRAM_PRONOUNS_A1",
        "skill_domain": "grammar",
        "cefr_target": "A1",
        "difficulty_weight": 0.8,
        "examples": "She likes tea.; We go to school by bus.",
    },
    {
        "skill_id": "GRAM_PLURAL_NOUNS_A1",
        "skill_domain": "grammar",
        "cefr_target": "A1",
        "difficulty_weight": 0.9,
        "examples": "There are three cats.; The children play outside.",
    },

    # ════════════════════════════════════════════════════════════
    # GRAMMAR — A2
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "GRAM_PAST_SIMPLE_A2",
        "skill_domain": "grammar",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "She visited London last year.; We played football yesterday.",
    },
    {
        "skill_id": "GRAM_PRESENT_CONTINUOUS_A2",
        "skill_domain": "grammar",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "He is reading a book right now.; They are cooking dinner.",
    },
    {
        "skill_id": "GRAM_COMPARATIVES_A2",
        "skill_domain": "grammar",
        "cefr_target": "A2",
        "difficulty_weight": 1.1,
        "examples": "This bag is heavier than that one.; She is taller than her brother.",
    },
    {
        "skill_id": "GRAM_MODAL_CAN_A2",
        "skill_domain": "grammar",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "Can you help me?; I can swim but I can't drive.",
    },
    {
        "skill_id": "GRAM_PREPOSITIONS_TIME_A2",
        "skill_domain": "grammar",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "The meeting is at 3 p.m.; She was born in July.",
    },

    # ════════════════════════════════════════════════════════════
    # GRAMMAR — B1
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "GRAM_PRESENT_PERFECT_B1",
        "skill_domain": "grammar",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "I have never eaten sushi.; She has just finished her report.",
    },
    {
        "skill_id": "GRAM_PASSIVE_VOICE_B1",
        "skill_domain": "grammar",
        "cefr_target": "B1",
        "difficulty_weight": 1.3,
        "examples": "The letter was written by her.; This bridge was built in 1990.",
    },
    {
        "skill_id": "GRAM_CONDITIONALS_ZERO_FIRST_B1",
        "skill_domain": "grammar",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "If you heat ice, it melts.; If it rains, I will stay home.",
    },
    {
        "skill_id": "GRAM_REPORTED_SPEECH_B1",
        "skill_domain": "grammar",
        "cefr_target": "B1",
        "difficulty_weight": 1.3,
        "examples": "She said she was tired.; He told me he had finished the task.",
    },
    {
        "skill_id": "GRAM_RELATIVE_CLAUSES_B1",
        "skill_domain": "grammar",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "The book that I read was fascinating.; She is the woman who called yesterday.",
    },

    # ════════════════════════════════════════════════════════════
    # GRAMMAR — B2
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "GRAM_CONDITIONALS_SECOND_THIRD_B2",
        "skill_domain": "grammar",
        "cefr_target": "B2",
        "difficulty_weight": 1.4,
        "examples": "If I were rich, I would travel the world.; If she had studied harder, she would have passed.",
    },
    {
        "skill_id": "GRAM_INVERSION_B2",
        "skill_domain": "grammar",
        "cefr_target": "B2",
        "difficulty_weight": 1.5,
        "examples": "Never have I seen such a mess.; Rarely does she arrive late.",
    },
    {
        "skill_id": "GRAM_PARTICIPLE_CLAUSES_B2",
        "skill_domain": "grammar",
        "cefr_target": "B2",
        "difficulty_weight": 1.4,
        "examples": "Having finished the report, he left the office.; Tired of waiting, she decided to go home.",
    },
    {
        "skill_id": "GRAM_MIXED_MODALS_B2",
        "skill_domain": "grammar",
        "cefr_target": "B2",
        "difficulty_weight": 1.3,
        "examples": "She must have forgotten the appointment.; He can't have been there at that time.",
    },
    {
        "skill_id": "GRAM_CLEFT_SENTENCES_B2",
        "skill_domain": "grammar",
        "cefr_target": "B2",
        "difficulty_weight": 1.4,
        "examples": "It was John who broke the window.; What I need is a good night's sleep.",
    },

    # ════════════════════════════════════════════════════════════
    # VOCABULARY — A1
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "VOCAB_NUMBERS_A1",
        "skill_domain": "vocabulary",
        "cefr_target": "A1",
        "difficulty_weight": 0.8,
        "examples": "There are twenty students in my class.; I live on the fifth floor.",
    },
    {
        "skill_id": "VOCAB_COLORS_SHAPES_A1",
        "skill_domain": "vocabulary",
        "cefr_target": "A1",
        "difficulty_weight": 0.8,
        "examples": "The sky is blue.; Draw a circle on the paper.",
    },
    {
        "skill_id": "VOCAB_FAMILY_A1",
        "skill_domain": "vocabulary",
        "cefr_target": "A1",
        "difficulty_weight": 0.8,
        "examples": "My sister is twelve years old.; His grandfather is a retired doctor.",
    },
    {
        "skill_id": "VOCAB_DAILY_ROUTINES_A1",
        "skill_domain": "vocabulary",
        "cefr_target": "A1",
        "difficulty_weight": 0.9,
        "examples": "I brush my teeth twice a day.; She wakes up at seven o'clock.",
    },

    # ════════════════════════════════════════════════════════════
    # VOCABULARY — A2
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "VOCAB_FOOD_DRINK_A2",
        "skill_domain": "vocabulary",
        "cefr_target": "A2",
        "difficulty_weight": 0.9,
        "examples": "I prefer grilled chicken to fried fish.; Could I have a glass of sparkling water?",
    },
    {
        "skill_id": "VOCAB_TRAVEL_TRANSPORT_A2",
        "skill_domain": "vocabulary",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "The departure gate is number twelve.; I missed the last train home.",
    },
    {
        "skill_id": "VOCAB_WORK_JOBS_A2",
        "skill_domain": "vocabulary",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "She works as an accountant in a law firm.; He was promoted to senior engineer.",
    },
    {
        "skill_id": "VOCAB_HEALTH_BODY_A2",
        "skill_domain": "vocabulary",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "I have a headache and a sore throat.; The doctor prescribed antibiotics.",
    },

    # ════════════════════════════════════════════════════════════
    # VOCABULARY — B1
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "VOCAB_PHRASAL_VERBS_B1",
        "skill_domain": "vocabulary",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "Can you look after my dog this weekend?; He gave up smoking last year.",
    },
    {
        "skill_id": "VOCAB_COLLOCATIONS_B1",
        "skill_domain": "vocabulary",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "She made a significant contribution to the project.; He took responsibility for the mistake.",
    },
    {
        "skill_id": "VOCAB_OPINION_HEDGING_B1",
        "skill_domain": "vocabulary",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "In my opinion, the results are promising.; It seems to me that more research is needed.",
    },
    {
        "skill_id": "VOCAB_ENVIRONMENT_B1",
        "skill_domain": "vocabulary",
        "cefr_target": "B1",
        "difficulty_weight": 1.1,
        "examples": "Carbon emissions are a major cause of climate change.; Recycling helps reduce waste.",
    },

    # ════════════════════════════════════════════════════════════
    # VOCABULARY — B2
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "VOCAB_ACADEMIC_WORDS_B2",
        "skill_domain": "vocabulary",
        "cefr_target": "B2",
        "difficulty_weight": 1.4,
        "examples": "The study indicates a significant correlation between diet and health.; His analysis revealed several inconsistencies.",
    },
    {
        "skill_id": "VOCAB_IDIOMS_B2",
        "skill_domain": "vocabulary",
        "cefr_target": "B2",
        "difficulty_weight": 1.3,
        "examples": "She hit the nail on the head with her assessment.; The project is back on track after the delay.",
    },
    {
        "skill_id": "VOCAB_REGISTER_FORMAL_B2",
        "skill_domain": "vocabulary",
        "cefr_target": "B2",
        "difficulty_weight": 1.4,
        "examples": "I would like to enquire about the vacancy.; We regret to inform you that your application was unsuccessful.",
    },
    {
        "skill_id": "VOCAB_NUANCE_SYNONYMS_B2",
        "skill_domain": "vocabulary",
        "cefr_target": "B2",
        "difficulty_weight": 1.3,
        "examples": "The lecture was informative, though somewhat lengthy.; Her response was curt rather than merely brief.",
    },
    {
        "skill_id": "VOCAB_DISCOURSE_MARKERS_B2",
        "skill_domain": "vocabulary",
        "cefr_target": "B2",
        "difficulty_weight": 1.3,
        "examples": "Nevertheless, the outcome exceeded expectations.; Furthermore, the data supports this conclusion.",
    },

    # ════════════════════════════════════════════════════════════
    # PHONOLOGY — A1
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "PHON_VOWEL_BASIC_A1",
        "skill_domain": "phonology",
        "cefr_target": "A1",
        "difficulty_weight": 0.9,
        "examples": "Minimal pair: ship / sheep.; Minimal pair: hat / hot.",
    },
    {
        "skill_id": "PHON_CONSONANT_BASIC_A1",
        "skill_domain": "phonology",
        "cefr_target": "A1",
        "difficulty_weight": 0.9,
        "examples": "Minimal pair: pat / bat.; Minimal pair: fan / van.",
    },
    {
        "skill_id": "PHON_STRESS_WORD_A1",
        "skill_domain": "phonology",
        "cefr_target": "A1",
        "difficulty_weight": 1.0,
        "examples": "TAble (stress on first syllable).; toDAY (stress on second syllable).",
    },

    # ════════════════════════════════════════════════════════════
    # PHONOLOGY — A2
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "PHON_INTONATION_QUESTIONS_A2",
        "skill_domain": "phonology",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "Rising intonation: Are you coming?; Falling intonation: Where do you live?",
    },
    {
        "skill_id": "PHON_WEAK_FORMS_A2",
        "skill_domain": "phonology",
        "cefr_target": "A2",
        "difficulty_weight": 1.1,
        "examples": "'And' reduced to /ən/ in fast speech: fish and chips.; 'Can' reduced to /kən/: I can do it.",
    },
    {
        "skill_id": "PHON_LINKING_A2",
        "skill_domain": "phonology",
        "cefr_target": "A2",
        "difficulty_weight": 1.1,
        "examples": "Turn off → /tɜːn ɒf/ spoken as /tɜːnɒf/.; Not at all → sounds like /nɒtətɔːl/.",
    },
    {
        "skill_id": "PHON_TH_SOUNDS_A2",
        "skill_domain": "phonology",
        "cefr_target": "A2",
        "difficulty_weight": 1.2,
        "examples": "Voiced /ð/: this, that, the.; Voiceless /θ/: think, three, tooth.",
    },

    # ════════════════════════════════════════════════════════════
    # PHONOLOGY — B1
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "PHON_STRESS_SENTENCE_B1",
        "skill_domain": "phonology",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "I NEVER said she STOLE the money (stress shifts meaning).; She gave the book to HIM, not to me.",
    },
    {
        "skill_id": "PHON_ELISION_B1",
        "skill_domain": "phonology",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "'Next day' → /nekˈdeɪ/ (t dropped).; 'Last night' → /lɑːsˈnaɪt/.",
    },
    {
        "skill_id": "PHON_ASSIMILATION_B1",
        "skill_domain": "phonology",
        "cefr_target": "B1",
        "difficulty_weight": 1.3,
        "examples": "'Good boy' → /ɡʊb bɔɪ/ (d assimilates to b).; 'Ten minutes' → /tem ˈmɪnɪts/.",
    },
    {
        "skill_id": "PHON_NUCLEAR_STRESS_B1",
        "skill_domain": "phonology",
        "cefr_target": "B1",
        "difficulty_weight": 1.3,
        "examples": "I didn't say HE did it (someone else did).; I didn't SAY he did it (I implied it).",
    },

    # ════════════════════════════════════════════════════════════
    # PHONOLOGY — B2
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "PHON_DISCOURSE_INTONATION_B2",
        "skill_domain": "phonology",
        "cefr_target": "B2",
        "difficulty_weight": 1.4,
        "examples": "Fall-rise tone to signal reservation: It's quite GOOD (but not great).; High fall for strong agreement: ABsolutely.",
    },
    {
        "skill_id": "PHON_RHYTHM_IAMBIC_B2",
        "skill_domain": "phonology",
        "cefr_target": "B2",
        "difficulty_weight": 1.4,
        "examples": "English rhythm compresses unstressed syllables: 'I WANT to GO to the SHOPS'.; Tonic syllables carry primary information.",
    },
    {
        "skill_id": "PHON_ACCENT_AWARENESS_B2",
        "skill_domain": "phonology",
        "cefr_target": "B2",
        "difficulty_weight": 1.3,
        "examples": "RP 'bath' /bɑːθ/ vs. General American /bæθ/.; Scottish English: 'loch' with /x/ fricative.",
    },

    # ════════════════════════════════════════════════════════════
    # DISCOURSE — A1
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "DISC_GREETINGS_A1",
        "skill_domain": "discourse",
        "cefr_target": "A1",
        "difficulty_weight": 0.8,
        "examples": "Hello! My name is Ana. Nice to meet you.; Goodbye! See you tomorrow.",
    },
    {
        "skill_id": "DISC_BASIC_CONNECTORS_A1",
        "skill_domain": "discourse",
        "cefr_target": "A1",
        "difficulty_weight": 0.9,
        "examples": "I like coffee and tea.; She is tired but happy.",
    },
    {
        "skill_id": "DISC_TURN_TAKING_A1",
        "skill_domain": "discourse",
        "cefr_target": "A1",
        "difficulty_weight": 0.9,
        "examples": "Can I say something?; Sorry, could you repeat that, please?",
    },

    # ════════════════════════════════════════════════════════════
    # DISCOURSE — A2
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "DISC_SEQUENCING_A2",
        "skill_domain": "discourse",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "First, I wake up. Then I have breakfast. Finally, I go to work.; After that, we visited the museum.",
    },
    {
        "skill_id": "DISC_CLARIFICATION_A2",
        "skill_domain": "discourse",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "What do you mean by that?; Could you explain that in a different way?",
    },
    {
        "skill_id": "DISC_SHORT_RESPONSES_A2",
        "skill_domain": "discourse",
        "cefr_target": "A2",
        "difficulty_weight": 0.9,
        "examples": "So do I.; Neither do I.",
    },
    {
        "skill_id": "DISC_TOPIC_INTRO_A2",
        "skill_domain": "discourse",
        "cefr_target": "A2",
        "difficulty_weight": 1.0,
        "examples": "The thing is, I forgot my keys.; Actually, I changed my mind.",
    },

    # ════════════════════════════════════════════════════════════
    # DISCOURSE — B1
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "DISC_COHERENCE_B1",
        "skill_domain": "discourse",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "However, the results were different from what we expected.; On the other hand, some participants disagreed.",
    },
    {
        "skill_id": "DISC_NARRATIVE_B1",
        "skill_domain": "discourse",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "It all started when I missed the bus.; Suddenly, everything went quiet.",
    },
    {
        "skill_id": "DISC_OPINION_STRUCTURE_B1",
        "skill_domain": "discourse",
        "cefr_target": "B1",
        "difficulty_weight": 1.2,
        "examples": "I think that technology has both advantages and disadvantages.; As far as I'm concerned, the benefits outweigh the risks.",
    },
    {
        "skill_id": "DISC_REPAIR_STRATEGIES_B1",
        "skill_domain": "discourse",
        "cefr_target": "B1",
        "difficulty_weight": 1.1,
        "examples": "What I mean is… let me rephrase that.; Sorry, I lost my train of thought — where was I?",
    },

    # ════════════════════════════════════════════════════════════
    # DISCOURSE — B2
    # ════════════════════════════════════════════════════════════
    {
        "skill_id": "DISC_ARGUMENT_STRUCTURE_B2",
        "skill_domain": "discourse",
        "cefr_target": "B2",
        "difficulty_weight": 1.4,
        "examples": "To begin with, the evidence suggests…; Having established the context, I will now examine the implications.",
    },
    {
        "skill_id": "DISC_HEDGING_B2",
        "skill_domain": "discourse",
        "cefr_target": "B2",
        "difficulty_weight": 1.3,
        "examples": "This might suggest that confidence plays a role.; It could be argued that the policy was premature.",
    },
    {
        "skill_id": "DISC_COHESION_ADVANCED_B2",
        "skill_domain": "discourse",
        "cefr_target": "B2",
        "difficulty_weight": 1.4,
        "examples": "The former approach prioritises efficiency; the latter emphasises equity.; Such considerations notwithstanding, the plan moved forward.",
    },
    {
        "skill_id": "DISC_REGISTER_SHIFT_B2",
        "skill_domain": "discourse",
        "cefr_target": "B2",
        "difficulty_weight": 1.5,
        "examples": "Shifting from formal to informal: 'We need to utilise resources' vs. 'We need to use what we've got'.; Adapting tone to audience in a presentation.",
    },
    {
        "skill_id": "DISC_STANCE_MARKING_B2",
        "skill_domain": "discourse",
        "cefr_target": "B2",
        "difficulty_weight": 1.4,
        "examples": "Interestingly, the control group showed no improvement.; Surprisingly, costs actually decreased.",
    },
]


# ---------------------------------------------------------------------------
# Execução
# ---------------------------------------------------------------------------

def seed():
    with app.app_context():
        inserted = 0
        skipped = 0

        for node_data in SKILL_NODES:
            exists = SkillNode.query.get(node_data["skill_id"])
            if exists:
                print(f"  [skip]   {node_data['skill_id']}")
                skipped += 1
                continue

            node = SkillNode(
                skill_id=node_data["skill_id"],
                skill_domain=node_data["skill_domain"],
                cefr_target=node_data["cefr_target"],
                difficulty_weight=node_data["difficulty_weight"],
                examples=node_data["examples"],
            )
            db.session.add(node)
            print(f"  [insert] {node_data['skill_id']}")
            inserted += 1

        db.session.commit()
        print(f"\n✓ Seed concluído — {inserted} inseridos, {skipped} ignorados (já existiam).")
        print(f"  Total de nós definidos: {len(SKILL_NODES)}")


if __name__ == "__main__":
    seed()
