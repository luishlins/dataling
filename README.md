# DataLing

![Tests](https://img.shields.io/badge/tests-67%20passing-brightgreen)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Flask](https://img.shields.io/badge/flask-3.0-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

A teacher-facing tool that tracks English language learners' CEFR levels by converting classroom observations into structured skill evidence, then inferring each student's proficiency profile automatically.

---

## The Problem

Language teachers accumulate rich knowledge about each student — grammar errors spotted during conversation, vocabulary gaps noticed in written work, pronunciation patterns — but this knowledge lives in handwritten notes or memory. It is rarely aggregated, rarely compared against a learning standard, and almost never used to generate a personalised study plan.

DataLing closes that gap. Every observation a teacher enters (a grammar flag, a free note, a test score) is automatically tagged to one or more skills in a CEFR taxonomy, fed into a knowledge-tracing model that updates each skill's mastery estimate, and surfaced as a CEFR level inference and gap analysis — all without requiring the teacher to think in terms of A1/B2/C1.

---

## Features

### Reporting
Teachers log evidence events from the classroom in real time. A single POST to `/api/reporting/event` accepts free-form text (`raw_input`) plus metadata (`source_type`, `polarity`, `severity`). An auto-tagger maps the text to relevant `SkillNode` entries using token overlap against each skill's `examples` corpus. A BKT-inspired knowledge tracer then updates the student's `mastery_score` for every matched skill.

Supported source types: `grammar_flag`, `free_note`, `test_response`, `ListeningBreakdown`, `WritingSample`.

### Advising
The advising module surfaces vocabulary items and checklist tasks aligned with the student's current level, so teachers can prioritise what to work on next in each lesson.

### Testing — Proficiency Test
The built-in proficiency test (EFSET-inspired) presents 4-skill assessments (Listening, Speaking, Reading, Writing) composed of items drawn from the skill taxonomy at the student's estimated level. Results are persisted as `TestSession` records and flow back into the knowledge-tracing pipeline, raising or lowering mastery scores in bulk.

### CEFR Inference Engine
Given a student's `StudentSkillState` vector, the inference engine computes a `fit_score` for each CEFR level (A1–C2), picks the level with the best fit, and reports:

- **Overall level** with confidence score
- **Per-skill breakdown** by domain (grammar, vocabulary, discourse, phonology…)
- **Evidence coverage meter** — flags Listening / Speaking / Reading / Writing as `covered`, `stale`, or `missing`
- **Gap analysis** — top 5 skills with the highest difficulty-weighted gap, aspect-level gap totals, and percentage distance to the next level
- **Level override** — teachers can manually set a level with a justification note; the override is logged with a timestamp and visible in the student's history

---

## Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Web framework | Flask 3.0 |
| ORM + migrations | Flask-SQLAlchemy 3.1 + Flask-Migrate (Alembic) |
| Database | SQLite (file: `dataling.db`) |
| ML classifier | scikit-learn 1.5 — TF-IDF + Logistic Regression |
| NLP / tagging | NLTK, custom token-overlap scorer |
| Frontend | Vanilla JS (no framework), single `index.html` |
| Styling | CSS custom properties, DM Sans / DM Serif / DM Mono |
| Testing | pytest 8.2 + pytest-flask |

### Folder Structure

```
dataling/
├── app.py                   # Application factory, blueprint registration
├── extensions.py            # SQLAlchemy + Migrate singletons
├── seed_skills.py           # Seeds SkillNode taxonomy (A1–C2, 6 domains)
├── build_dataset.py         # Builds data/cefr_texts.csv from corpora
├── train_classifier.py      # Trains models/cefr_classifier.pkl
│
├── models/
│   ├── student.py           # Student (id, name, start_date)
│   ├── skill_node.py        # SkillNode (skill_id, domain, cefr_target, examples)
│   ├── student_skill_state.py  # Mastery + streaks per student/skill
│   ├── evidence_event.py    # Raw evidence log + skill tag association table
│   ├── test_session.py      # Proficiency test session + per-skill scores
│   └── ...
│
├── routes/
│   ├── students.py          # CRUD, /level-estimate, /gap-analysis, /level-override
│   ├── reporting.py         # POST /reporting/event
│   ├── testing.py           # Proficiency test endpoints
│   ├── advising.py          # Vocab + checklist advising
│   └── analytics.py         # Cohort-level analytics
│
├── services/
│   ├── auto_tagger.py       # raw_input → SkillNode candidates with confidence
│   ├── knowledge_tracing.py # BKT-inspired mastery update per evidence event
│   ├── level_estimator.py   # Skill states → CEFR level + evidence coverage
│   ├── gap_analyzer.py      # Gap scores, aspect totals, next-level distance
│   └── cefr_classifier.py   # Text → CEFR level using trained sklearn pipeline
│
├── static/
│   ├── html/index.html      # Single-page app shell
│   ├── css/main.css         # Design system (DataLing palette, CSS variables)
│   └── js/
│       ├── students.js      # Student list, profile modal, level override
│       ├── reporting.js     # Evidence event form
│       ├── testing.js       # Proficiency test builder UI
│       ├── advising.js      # Advising tab
│       └── analytics.js     # Cohort analytics SVG charts
│
├── tests/
│   ├── conftest.py          # Shared fixtures (in-memory SQLite)
│   ├── test_integration.py  # End-to-end: create student → events → level → gap
│   ├── test_students.py     # Student CRUD routes
│   ├── test_reporting.py    # Evidence event ingestion + validation
│   ├── test_knowledge_tracing.py  # Mastery update logic
│   └── test_gap_analyzer.py # Gap computation + aspect aggregation
│
├── migrations/              # Alembic migration history
├── data/                    # Generated training data (cefr_texts.csv)
└── callan_pdfs/             # Callan Method PDFs (not committed — see Dataset)
```

### Key API Endpoints

```
GET  /                                     → SPA index.html

# Students
GET  /api/students                         → list all students
POST /api/students                         → create student
GET  /api/students/<id>                    → get student
PUT  /api/students/<id>                    → update student
DELETE /api/students/<id>                  → delete student
GET  /api/students/<id>/level-estimate     → CEFR inference + evidence coverage
GET  /api/students/<id>/gap-analysis       → gap scores + next-level distance
POST /api/students/<id>/level-override     → manual level override with note

# Reporting
POST /api/reporting/event                  → ingest evidence event

# Testing
GET  /api/testing/items                    → list test items
POST /api/testing/session                  → create test session
PATCH /api/testing/session/<id>            → submit session results

# Analytics
GET  /api/analytics/cohort                 → cohort-level stats
```

---

## Installation

**Requirements:** Python 3.11+

```bash
# 1. Clone the repository
git clone https://github.com/your-org/dataling.git
cd dataling

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up the database
flask db upgrade

# 5. Seed the CEFR skill taxonomy (~300 SkillNodes across A1–C2)
python seed_skills.py

# 6. Start the development server
flask run
```

Open `http://localhost:5000` in your browser.

> **Environment variables** — copy `.env.example` to `.env` and set `SECRET_KEY` before deploying to production. The default `dev-key-mude-isso` must not be used in production.

---

## How to Use

### Basic workflow

1. **Add a student** — go to the *Students* tab and fill in the student's name and start date. DataLing creates a blank skill profile.

2. **Log evidence (Reporting tab)** — after each lesson, enter what you observed: a grammar error (`grammar_flag`), a general note (`free_note`), or a test response (`test_response`). Set polarity (`+1` correct / `-1` error) and severity (1–3). DataLing auto-tags the input to relevant CEFR skills and updates the student's mastery scores.

3. **Run the Proficiency Test** — click *Proficiency Test* in the student's profile to launch a structured 4-skill assessment. Items are generated from the skill taxonomy. Submitting the session updates mastery scores in bulk.

4. **View the student profile** — click the student's card to open the profile modal:
   - **Overall CEFR level** with confidence, derived from accumulated skill evidence
   - **Per-skill breakdown** for Listening, Speaking, Reading, Writing
   - **Evidence coverage meter** — highlights skills with no recent evidence (`stale` / `missing`)
   - **Gap analysis** — the 5 skills with the largest gap to full mastery, plus distance to the next CEFR level
   - **Override level** — manually set a level if you disagree with the inference; the system logs the original estimate, your override, and your justification note

5. **Analytics tab** — cohort view showing CEFR distribution across all students, progress trends, and inactivity alerts.

---

## Dataset

The CEFR text classifier (`models/cefr_classifier.pkl`) is a TF-IDF + Logistic Regression pipeline trained on two corpora:

| Corpus | Levels | Notes |
|---|---|---|
| [OneStopEnglish](https://github.com/nishkalavallabhi/OneStopEnglishCorpus) | B1 / B2 / C1 | Automatically downloaded from GitHub during `build_dataset.py` |
| Callan Method PDFs | A1–C2 | Books 1–2 → A1, 3–4 → A2, 5–6 → B1, 7–8 → B2, 9–10 → C1, 11–12 → C2 |

The Callan PDFs are **not included** in this repository due to copyright. Place them in `callan_pdfs/` before running the dataset builder.

### Rebuilding the classifier

```bash
# Step 1 — extract and label text passages from both corpora
python build_dataset.py          # writes data/cefr_texts.csv

# Step 2 — train and evaluate the classifier
python train_classifier.py       # writes models/cefr_classifier.pkl
```

`train_classifier.py` prints a per-class classification report and saves the fitted `sklearn.pipeline.Pipeline` with joblib. The resulting `.pkl` file is loaded at runtime by `services/cefr_classifier.py`.

---

## Running Tests

```bash
pytest tests/ -v
```

The suite runs against an in-memory SQLite database and covers student CRUD, evidence ingestion + validation, knowledge-tracing mastery updates, gap analysis arithmetic, and full end-to-end integration flows.

```
67 passed in ~5s
```
