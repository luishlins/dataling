# DataLing Demo Video Script
## Duration: 4–5 minutes

---

### SCENE 1 — Opening (0:00–0:30)

**Screen:** App homepage / student list (empty or with 1–2 existing students)

**Narration:**
> "Most English teachers carry their students entirely in their heads — who struggles with conditionals, who's B1 on grammar but A2 under pressure. The moment a student changes teachers or returns after a break, that knowledge is gone. DataLing is a lightweight tool that fixes this. It runs locally, needs no cloud account, and gives a teacher a living record of every student's proficiency — updated in real time, exportable as a PDF report. Let me show you how it works."

---

### SCENE 2 — Adding a Student (0:30–1:00)

**Screen:** Click "Novo Aluno" button → student creation form fills in

**Action:** Fill in:
- Name: João Silva
- Email: joao@empresa.com
- Job Title: Sales Manager
- Target Test: Business English
- Target Level: B2

**Narration:**
> "We start by creating a student profile. Beyond the basics — name and email — we record what matters pedagogically: the student's job, their speaking environments, the test or level they're targeting. DataLing uses this context throughout the system to prioritize the right vocabulary and skills."

**Screen:** Click Save → student card appears in the list → click to open student modal

---

### SCENE 3 — Reporting a Session (1:00–1:45)

**Screen:** Student modal → click "Reporting" tab

**Narration:**
> "After every lesson, the teacher logs what happened. This is the core of the system — every observation becomes an evidence event that updates the student's mastery scores."

**Action:** Click "Nova Sessão" → fill in:
- Topic: Reported Speech
- Duration: 60 min
- Notes: "Struggled with reported questions. Good vocabulary around negotiation."

**Screen:** Grammar error checklist appears

**Action:** Tag 2 grammar errors: "reported speech — questions" (severity 3), "indirect questions" (severity 2)

**Screen:** Fluency rating sliders appear

**Action:** Rate fluency: 3/5, pronunciation: 4/5

**Narration:**
> "The teacher tags specific grammar errors and rates fluency on a checklist. Each entry carries a severity weight. Under the hood, a weighted delta model updates mastery scores immediately — a single severe negative observation moves a skill down by 0.3 points; ten mild ones have the same effect. Recency also matters: observations from three months ago decay to half their original weight."

**Action:** Click "Salvar Sessão" → success toast appears

---

### SCENE 4 — Proficiency Test (1:45–3:00)

**Screen:** Student modal → click "Testes" tab

**Narration:**
> "Now let's run an adaptive reading test. DataLing uses a simplified Computer Adaptive Test — the difficulty adjusts in real time based on how the student answers."

**Action:** Click "Iniciar Leitura"

**Screen:** First item appears at B1 level — short reading passage with multiple choice

**Narration:**
> "The first item is chosen based on the student's estimated level and a relevance score that factors in their skill gaps and the vocabulary the teacher has flagged as high-priority for this student's professional context."

**Action:** Select correct answer → green feedback → progress bar increments → level badge updates to "B1+"

**Narration:**
> "Correct. The level estimate ticks up half a step. Watch the badge in the top right."

**Action:** Next item appears (harder, B2 level) → select wrong answer → red feedback → level drops back to "B1"

**Narration:**
> "Wrong — and the system immediately serves a B1 item. This continues for up to ten items, converging on the student's true level rather than just averaging across a fixed set."

**Action:** Complete 4–5 more items at varying difficulty → "Resultado" screen appears

**Screen:** Summary shows: "CAT Estimate: B1+", score, breakdown by skill

**Narration:**
> "At the end, the teacher sees a CAT-derived level estimate alongside an item-by-item breakdown. This result is automatically written back into the student's evidence history."

---

### SCENE 5 — Student Profile Modal (3:00–3:30)

**Screen:** Student modal → "Perfil" tab

**Narration:**
> "The Profile tab gives a full picture of where the student stands. Each macro-skill — grammar, vocabulary, phonology, discourse, reading — has its own CEFR estimate derived from the accumulated evidence."

**Screen:** Scroll through skill bars, gap list, weekly activity chart

**Narration:**
> "The gap analysis highlights which skills are furthest from the target level, weighted so no single domain monopolizes the priority list. The weekly activity chart shows how consistently the student has been practicing — useful context for any teacher picking up this student mid-program."

**Screen:** Override Level button visible

**Action:** Click it → select B1 from dropdown → confirm

**Narration:**
> "And if the teacher's professional judgement disagrees with the algorithm, they can override the level directly. The system treats this as a high-weight evidence event rather than hard-coding a number."

---

### SCENE 6 — Analytics & Gap Analysis (3:30–4:00)

**Screen:** Student modal → "Analytics" tab

**Narration:**
> "The Analytics tab surfaces actionable next steps. The gap analyzer computes how far each skill cluster is from the target level, then ranks them. This becomes the basis for lesson planning."

**Screen:** Domain mastery chart → recommended topics list

**Narration:**
> "A teacher managing ten students can open each profile, see the top three gaps, and plan ten differentiated lessons in under fifteen minutes — without carrying any of it in their head."

---

### SCENE 7 — Export PDF Report (4:00–4:30)

**Screen:** Student modal → "Perfil" tab → "Exportar Relatório PDF" button visible

**Action:** Click button → new window opens with formatted HTML report

**Screen:** Report shows: student info, weekly activity table, domain mastery table, resolved gaps, study recommendations

**Narration:**
> "Finally, any student profile can be exported as a PDF. The report pulls weekly activity, domain mastery, resolved gaps, and study recommendations into a single printable page — ready to share with the student or file for the next teacher."

**Action:** Browser print dialog appears → cancel (no need to actually print)

---

### SCENE 8 — Closing (4:30–5:00)

**Screen:** Return to student list — show cards for 2–3 students

**Narration:**
> "DataLing runs entirely on a local machine — no cloud account, no subscription, no data leaving the building. The stack is Flask, SQLite, and vanilla JavaScript. It's open source. If you're a language teacher who's ever lost a student's history between sessions, this was built for you."

**Screen:** GitHub URL visible: github.com/luishlins/dataling

**Narration:**
> "The repository is linked below. Issues, pull requests, and questions are all welcome."

---

## Production Notes

- Record at 1920×1080, browser zoom at 110% for readability
- Use a demo database with 2–3 pre-seeded students so the list doesn't look empty at the start
- Pre-seed João Silva with ~15 evidence events so the Analytics tab shows populated charts
- Import at least 20 test items (CSV) before the demo so the CAT has items to choose from
- Scene 4 (proficiency test) is the longest — consider cutting to 3–4 items if pacing feels slow
- Total narration word count: ~680 words ≈ 4:30 at 150 wpm
