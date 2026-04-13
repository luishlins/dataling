# Building DataLing: An Adaptive Language Assessment Platform for English Teachers

*How a Flask + SQLite stack, a scikit-learn CEFR classifier, and a simplified knowledge-tracing engine became a practical tool for one-on-one language instruction.*

---

## The Problem Nobody Talks About

Walk into any language school and you will find the same scene: a teacher sitting across from a student, making mental notes. *She struggles with conditionals. He sounds fluent but confuses register in business emails. This one is B1 on grammar but A2 on speaking under pressure.* The teacher carries all of this in their head.

The moment a student is absent for three weeks, reassigned to a different teacher, or just returns after a holiday, that accumulated knowledge evaporates. There is no system of record. Progress is anecdotal. Lesson plans are rebuilt from scratch.

This is the problem DataLing was built to solve. Not for a school district, not for an LMS vendor — for a single teacher running a boutique one-on-one English program for Brazilian professionals. The product needed to be lightweight, offline-capable, immediately useful, and extensible enough to grow into something more sophisticated later.

---

## Architecture: Choosing Boring Technology Intentionally

The first decision was deliberately conservative: **Flask + SQLite**. The reasons were pragmatic.

SQLite is the right choice when the deployment target is a single machine and the expected concurrent load is one teacher at a time. There is no need for a connection pool, no configuration overhead, and backups are a single file copy. SQLAlchemy abstracts it well enough that a later migration to PostgreSQL would touch only the connection string.

Flask was chosen over FastAPI primarily because the frontend needed to be served from the same process. DataLing's UI is a single HTML file with vanilla JavaScript modules — no build step, no Node toolchain. Flask's `send_from_directory` does this cleanly. The API and the static assets live in one `flask run`.

The data model reflects the domain directly. A `Student` has a profile (job title, speaking environments, target test). `EvidenceEvent` is the central fact table: every teaching observation — a grammar error noted during a call, a checklist from a speaking assessment, a test result — becomes an evidence event with a `polarity` (positive or negative) and a `severity` (1–5). `SkillNode` defines the competency graph, where each node belongs to a CEFR level and a domain (grammar, vocabulary, phonology, discourse, listening, reading, writing). Everything else — mastery scores, level estimates, gap analyses — is computed from these primitives.

The schema is deliberately normalized. Denormalized caches (like `StudentSkillState`) exist for performance but are always recomputable from the raw evidence. This means you can replay history, audit decisions, and eventually train a model on real teaching data.

---

## Simplified Knowledge Tracing

True Bayesian Knowledge Tracing (BKT) requires a Hidden Markov Model with per-skill parameters estimated from large datasets. For DataLing's context — a teacher with perhaps ten students and hundreds of observations — full BKT would be overfit and untrustworthy.

Instead, DataLing uses a **weighted delta model** that captures the intuition behind BKT without its data requirements.

When an evidence event arrives, the system calls `update_mastery(student_id, skill_id, polarity, severity, db_session)`. The core update is:

```
delta = polarity × severity × 0.1 × recency_weight
mastery_score = clip(mastery_score + delta, 0.05, 0.95)
```

`recency_weight` decays from 1.0 (today) to 0.5 (≥ 90 days), encoding the forgetting curve without requiring a separate model. The `0.1` scaling factor means a single severe positive observation moves mastery by 0.5 points; ten mild observations are needed to achieve the same effect.

The mastery bounds (0.05, 0.95) prevent a student from ever appearing to have zero knowledge of something they've studied, or perfect mastery of something they've only demonstrated once. These are epistemic guardrails, not hard constraints.

**Level estimation** aggregates mastery scores across all skills for a given CEFR level using a weighted average:

```
fit_score(level) = Σ(mastery_score × difficulty_weight) / Σ(difficulty_weight)
```

The estimated CEFR level is the highest level with `fit_score > 0.6`. Confidence is `min(1.0, total_evidence_events / 20)`, reflecting that early estimates are unreliable by construction.

---

## The CEFR Text Classifier

One of the more technically interesting pieces is `services/cefr_classifier.py`, which classifies English text into CEFR levels (A1–C2) using a serialized scikit-learn pipeline stored in `models/cefr_classifier.pkl`.

The pipeline uses TF-IDF vectorization followed by a multiclass classifier (a Naive Bayes or SVM variant, depending on the training run). Training data was sourced from publicly available CEFR-annotated corpora, with each document labeled with its assessed level.

The classifier is loaded lazily — the `.pkl` file is deserialized on first call and kept in memory for the process lifetime. This is the singleton pattern without a framework:

```python
_model = None

def _load_model():
    global _model
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    return _model
```

The classifier is used in two places: when a teacher creates a test item without specifying its target CEFR level (the content is classified automatically), and as a supporting signal when processing free-text evidence from the reporting module.

A short-text guard (`len(text.split()) < 20`) returns early with a `"texto_muito_curto"` flag. The classifier degrades gracefully on insufficient input rather than producing a low-confidence but still-surfaced prediction.

---

## Adaptive Testing: A Simplified CAT

DataLing's reading proficiency module implements a basic **Computer Adaptive Test (CAT)**. Classical CAT requires Item Response Theory (IRT) parameter estimation and a real-time ability estimation algorithm like Maximum Likelihood Estimation. DataLing approximates this with a rule-based level adjustment:

- Current level estimate is tracked at half-CEFR granularity: A1, A1+, A2, A2+, B1, B1+, and so on up to C2.
- A correct answer increments by 0.5 sub-levels; an incorrect answer decrements by 0.5.
- The next item is selected from TestItems whose `target_cefr` matches the adjusted level, ranked by a composite `relevance_score`.

`relevance_score` is itself a multi-signal function:

```
relevance = gap_score × recency_penalty + advising_bonus
```

Where:
- `gap_score` is the average skill gap (1 − mastery) across skills tagged to the item
- `recency_penalty` is 0.5 if the item was seen in the last 7 days, 0.8 if last 30 days, 1.0 otherwise
- `advising_bonus` is +0.2 if any vocab target in the item matches a high-priority (`priority_weight > 1.0`) advised vocabulary term for this student

This ensures the test is not just level-appropriate but also pedagogically targeted: items covering vocabulary the teacher has flagged as important for this student's professional context rise to the top.

The live level estimate is displayed as a badge that updates after each answer, giving the teacher real-time insight into where the student is landing.

---

## What Five Phases of Development Taught Us

DataLing was built in five explicit phases over several weeks:

**Phase 1** established the data model and Flask skeleton. The key decision here was to model `EvidenceEvent` as a generic fact rather than a typed table per observation type. This generality cost some type safety but gained enormous flexibility — adding a new assessment type (a dictation task, a video comprehension exercise) requires no schema migration.

**Phase 2** built the Reporting module: the teacher can log a session, tag grammar errors, rate fluency on a checklist, and have mastery scores update automatically. The UI feedback loop here was critical — teachers need to see that their observations are "registering."

**Phase 3** introduced the Advising module (vocabulary profiling) and the Analytics dashboard (gap analysis, next-level distance). The gap analyzer's `compute_aspect_gaps` distributes skill gaps across macro-skills using domain-membership fractions, which prevents a single domain (like grammar) from monopolizing the priority list.

**Phase 4** added the proficiency testing system: item bank management, CSV import, the CEFR classifier, and the four-skill test flow. The speaking assessment uses a teacher-completed checklist (72 items across 9 dimensions) rather than automated speech recognition — a pragmatic choice given the B2B single-teacher context.

**Phase 5** — the current phase — completed the CAT engine, IRT metadata fields, item calibration, and the PDF report export. The report pulls weekly activity data, domain mastery, resolved gaps, and study recommendations into a printable HTML page.

---

## Next Steps

The current system is a functional prototype that delivers real value. The path to a more rigorous product runs through three areas:

**1. BERT fine-tuning for the CEFR classifier.** The current TF-IDF + classifier pipeline is fast and interpretable but caps out around 75–80% accuracy on nuanced B1/B2 distinctions. Fine-tuning a multilingual BERT or RoBERTa model on CEFR-annotated data (the Cambridge Learner Corpus, LOCNESS, or similar) could push this into the 85–90% range, with the added benefit of contextualized representations that handle idiomatic use better.

**2. Full IRT implementation.** The current calibration endpoint computes `empirical_difficulty = 1 − p_correct` as a starting point. A complete 2-Parameter Logistic model (`a` for discrimination, `b` for difficulty) would allow Maximum Likelihood ability estimation during the CAT, replacing the rule-based ±0.5 adjustment with a principled estimate. This requires accumulating response data from real administrations — the schema and calibration route are already in place.

**3. Mobile teacher companion.** The current UI is a desktop web app. The single highest-value mobile feature would be a voice-memo-to-evidence pipeline: a teacher records a 30-second note after a session ("João struggled with reported speech, nailed the vocabulary around negotiation"), which is transcribed and parsed into evidence events automatically. The Advising module's vocabulary extraction is already a sketch of this pipeline.

DataLing is open-source and the code tells an honest story: real architectural trade-offs, real scope constraints, and a genuine attempt to solve a real problem for a real user. That is usually more interesting than a polished demo.

---

*The repository is at github.com/luishlins/dataling. The stack: Flask 3, SQLAlchemy, SQLite, scikit-learn, vanilla JS (no bundler). Tests: pytest. Total Python: ~3 500 lines across models, services, and routes.*
