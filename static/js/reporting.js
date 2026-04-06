// static/js/reporting.js
// Quick Capture interface for the Reporting module.
// Exports default init(container, actionsBar) for the index.html router.

const API_BASE = "http://localhost:5000/api";

// ─────────────────────────────────────────────────────────────
// Configuration: event types
// ─────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  {
    id:          "mispronunciation",
    label:       "Mispronunciation",
    source_type: "grammar_flag",
    icon:        "🔊",
    color:       "#E0572A",
    colorLight:  "#FDF1EC",
    description: "Phonological error in production",
    polarity:    -1,
  },
  {
    id:          "dictation_mistake",
    label:       "Dictation Mistake",
    source_type: "test_response",
    icon:        "✏️",
    color:       "#B45309",
    colorLight:  "#FFFBEB",
    description: "Error transcribing spoken input",
    polarity:    -1,
  },
  {
    id:          "grammar_flag",
    label:       "Grammar Flag",
    source_type: "grammar_flag",
    icon:        "⚑",
    color:       "#1C3F8F",
    colorLight:  "#EBF0FB",
    description: "Grammatical structure error",
    polarity:    -1,
  },
  {
    id:          "writing_flag",
    label:       "Writing Flag",
    source_type: "free_note",
    icon:        "📝",
    color:       "#5B21B6",
    colorLight:  "#F5F3FF",
    description: "Written production issue",
    polarity:    -1,
  },
  {
    id:          "listening_breakdown",
    label:       "Listening Breakdown",
    source_type: "test_response",
    icon:        "👂",
    color:       "#0E7490",
    colorLight:  "#ECFEFF",
    description: "Comprehension failure in listening task",
    polarity:    -1,
  },
  {
    id:          "reading_friction",
    label:       "Reading Friction",
    source_type: "test_response",
    icon:        "📖",
    color:       "#065F46",
    colorLight:  "#ECFDF5",
    description: "Difficulty processing written text",
    polarity:    -1,
  },
  {
    id:          "avoidance_behavior",
    label:       "Avoidance Behavior",
    source_type: "free_note",
    icon:        "↩",
    color:       "#9D174D",
    colorLight:  "#FFF1F2",
    description: "Student circumvents target structure",
    polarity:    -1,
  },
];

// ─────────────────────────────────────────────────────────────
// Grammar structures for the GrammarFlag select
// ─────────────────────────────────────────────────────────────

const GRAMMAR_STRUCTURES = [
  { value: "present simple",                  label: "Present Simple" },
  { value: "present continuous",              label: "Present Continuous" },
  { value: "past simple",                     label: "Past Simple" },
  { value: "past continuous",                 label: "Past Continuous" },
  { value: "present perfect simple",          label: "Present Perfect Simple" },
  { value: "present perfect continuous",      label: "Present Perfect Continuous" },
  { value: "past perfect",                    label: "Past Perfect" },
  { value: "future will",                     label: "Future: will" },
  { value: "future going to",                 label: "Future: going to" },
  { value: "zero conditional",                label: "Zero Conditional" },
  { value: "first conditional",               label: "First Conditional" },
  { value: "second conditional",              label: "Second Conditional" },
  { value: "third conditional",               label: "Third Conditional" },
  { value: "passive voice",                   label: "Passive Voice" },
  { value: "reported speech",                 label: "Reported Speech" },
  { value: "relative clauses",                label: "Relative Clauses" },
  { value: "modal verbs obligation",          label: "Modal Verbs: Obligation (must/have to)" },
  { value: "modal verbs ability",             label: "Modal Verbs: Ability (can/could)" },
  { value: "modal verbs probability",         label: "Modal Verbs: Probability (might/may)" },
  { value: "articles definite indefinite",    label: "Articles: Definite & Indefinite" },
  { value: "prepositions of time",            label: "Prepositions of Time (at/on/in)" },
  { value: "prepositions of place",           label: "Prepositions of Place" },
  { value: "subject verb agreement",          label: "Subject-Verb Agreement" },
  { value: "countable uncountable nouns",     label: "Countable & Uncountable Nouns" },
  { value: "comparatives superlatives",       label: "Comparatives & Superlatives" },
  { value: "gerunds infinitives",             label: "Gerunds vs Infinitives" },
  { value: "phrasal verbs",                   label: "Phrasal Verbs" },
  { value: "question formation",              label: "Question Formation" },
  { value: "inversion formal",                label: "Inversion (Formal / Emphatic)" },
  { value: "participle clauses",              label: "Participle Clauses" },
];

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

let _container   = null;
let _activeType  = null;   // id of the currently open event type
let _students    = [];     // cached student list for the selector

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function fetchStudents() {
  try {
    const res = await fetch(`${API_BASE}/students`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function studentOptions(students) {
  if (!students.length) {
    return `<option value="" disabled>No students found</option>`;
  }
  return students.map(s =>
    `<option value="${s.id}">${s.name}</option>`
  ).join("");
}

function severityButtons() {
  return `
    <div class="qc-severity">
      <span class="qc-field-label">Severity</span>
      <div class="qc-severity-group">
        ${[1, 2, 3].map(n => `
          <button type="button"
            class="qc-sev-btn${n === 1 ? " active" : ""}"
            data-sev="${n}"
            onclick="QC.setSeverity(${n})">
            ${"●".repeat(n)}${"○".repeat(3 - n)}
            <span>${["Low", "Medium", "High"][n - 1]}</span>
          </button>
        `).join("")}
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Form builders per event type
// ─────────────────────────────────────────────────────────────

function buildMispronunciationForm(type, students) {
  return `
    <div class="qc-field">
      <label class="qc-field-label">What was mispronounced? <span class="req">*</span></label>
      <input id="qc-raw" class="qc-input" type="text"
        placeholder="e.g. she said /θɪŋk/ as /tɪŋk/" autocomplete="off" />
    </div>
    <div class="qc-field">
      <label class="qc-field-label">Context (optional)</label>
      <input id="qc-context" class="qc-input" type="text"
        placeholder="e.g. Reading aloud task" />
    </div>`;
}

function buildGrammarFlagForm(type, students) {
  const options = GRAMMAR_STRUCTURES.map(s =>
    `<option value="${s.value}">${s.label}</option>`
  ).join("");
  return `
    <div class="qc-field">
      <label class="qc-field-label">Grammar structure <span class="req">*</span></label>
      <select id="qc-raw" class="qc-input qc-select">
        <option value="" disabled selected>Select a structure…</option>
        ${options}
      </select>
    </div>
    <div class="qc-field">
      <label class="qc-field-label">What the student said (optional)</label>
      <input id="qc-context" class="qc-input" type="text"
        placeholder="e.g. She don't like coffee" />
    </div>`;
}

function buildGenericForm(type, students) {
  return `
    <div class="qc-field">
      <label class="qc-field-label">Observation <span class="req">*</span></label>
      <textarea id="qc-raw" class="qc-input qc-textarea"
        placeholder="Describe what you observed…" rows="3"></textarea>
    </div>
    <div class="qc-field">
      <label class="qc-field-label">Context (optional)</label>
      <input id="qc-context" class="qc-input" type="text"
        placeholder="e.g. Listening task, track 4" />
    </div>`;
}

const FORM_BUILDERS = {
  mispronunciation:    buildMispronunciationForm,
  grammar_flag:        buildGrammarFlagForm,
  dictation_mistake:   buildGenericForm,
  writing_flag:        buildGenericForm,
  listening_breakdown: buildGenericForm,
  reading_friction:    buildGenericForm,
  avoidance_behavior:  buildGenericForm,
};

// ─────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────

function renderGrid() {
  const grid = _container.querySelector("#qc-grid");
  if (!grid) return;

  grid.innerHTML = EVENT_TYPES.map((type, i) => `
    <button
      class="qc-type-btn${_activeType === type.id ? " active" : ""}"
      data-id="${type.id}"
      style="
        --type-color: ${type.color};
        --type-bg: ${type.colorLight};
        animation-delay: ${i * 40}ms;
      "
      onclick="QC.selectType('${type.id}')">
      <span class="qc-type-icon">${type.icon}</span>
      <span class="qc-type-label">${type.label}</span>
      <span class="qc-type-desc">${type.description}</span>
    </button>
  `).join("");
}

function renderForm(type) {
  const panel = _container.querySelector("#qc-panel");
  if (!panel) return;

  if (!type) {
    panel.innerHTML = `
      <div class="qc-empty">
        <p>Select an event type to begin capturing.</p>
      </div>`;
    return;
  }

  const builder  = FORM_BUILDERS[type.id] || buildGenericForm;
  const formHTML = builder(type, _students);

  panel.innerHTML = `
    <div class="qc-form" style="--type-color: ${type.color}; --type-bg: ${type.colorLight};">
      <div class="qc-form-header">
        <span class="qc-form-icon">${type.icon}</span>
        <div>
          <div class="qc-form-title">${type.label}</div>
          <div class="qc-form-subtitle">${type.description}</div>
        </div>
      </div>

      <div id="qc-form-error" class="qc-msg qc-msg--error" style="display:none"></div>

      <div class="qc-field">
        <label class="qc-field-label">Student <span class="req">*</span></label>
        <select id="qc-student" class="qc-input qc-select">
          <option value="" disabled selected>Select student…</option>
          ${studentOptions(_students)}
        </select>
      </div>

      ${formHTML}
      ${severityButtons()}

      <div class="qc-form-actions">
        <button class="qc-btn qc-btn--ghost" onclick="QC.cancel()">Cancel</button>
        <button id="qc-submit" class="qc-btn qc-btn--primary"
          style="background: var(--type-color);"
          onclick="QC.submit('${type.id}')">
          Capture Event
        </button>
      </div>
    </div>`;
}

function showSuccess(tags) {
  const panel = _container.querySelector("#qc-panel");
  if (!panel) return;

  const tagHTML = tags.length
    ? tags.map(t => `
        <span class="qc-tag">
          ${t.skill_id}
          <span class="qc-tag-score">${Math.round(t.confidence_score * 100)}%</span>
        </span>`).join("")
    : `<span class="qc-tag-none">No skill tags matched — consider tagging manually.</span>`;

  panel.innerHTML = `
    <div class="qc-success">
      <div class="qc-success-icon">✓</div>
      <div class="qc-success-title">Event captured</div>
      <div class="qc-success-label">Auto-tagged skills</div>
      <div class="qc-tags">${tagHTML}</div>
    </div>`;

  // Reset after 3 seconds
  setTimeout(() => {
    _activeType = null;
    renderGrid();
    renderForm(null);
  }, 3000);
}

// ─────────────────────────────────────────────────────────────
// Public API (attached to window.QC for onclick handlers)
// ─────────────────────────────────────────────────────────────

window.QC = {

  selectType(id) {
    _activeType = _activeType === id ? null : id;
    renderGrid();
    const type = EVENT_TYPES.find(t => t.id === id);
    renderForm(_activeType ? type : null);
    if (_activeType) {
      const panel = _container.querySelector("#qc-panel");
      panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => _container.querySelector("#qc-raw")?.focus(), 200);
    }
  },

  setSeverity(n) {
    document.querySelectorAll(".qc-sev-btn").forEach(btn => {
      btn.classList.toggle("active", parseInt(btn.dataset.sev) === n);
    });
  },

  cancel() {
    _activeType = null;
    renderGrid();
    renderForm(null);
  },

  async submit(typeId) {
    const type       = EVENT_TYPES.find(t => t.id === typeId);
    const rawInput   = document.getElementById("qc-raw")?.value?.trim();
    const context    = document.getElementById("qc-context")?.value?.trim();
    const studentId  = document.getElementById("qc-student")?.value;
    const severity   = parseInt(
      document.querySelector(".qc-sev-btn.active")?.dataset.sev ?? "1"
    );
    const errBox     = document.getElementById("qc-form-error");
    const submitBtn  = document.getElementById("qc-submit");

    // Client-side validation
    const errs = [];
    if (!studentId) errs.push("Please select a student.");
    if (!rawInput)  errs.push("The observation field is required.");
    if (errs.length) {
      errBox.style.display = "flex";
      errBox.textContent   = errs.join(" ");
      return;
    }

    errBox.style.display = "none";
    submitBtn.disabled   = true;
    submitBtn.textContent = "Saving…";

    try {
      const payload = {
        student_id:  parseInt(studentId),
        source_type: type.source_type,
        raw_input:   rawInput,
        polarity:    type.polarity,
        severity,
        context:     context || undefined,
      };

      const res = await fetch(`${API_BASE}/reporting/event`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      showSuccess(data.skill_tags || []);

    } catch (err) {
      errBox.style.display = "flex";
      errBox.textContent   = `Failed to save: ${err.message}`;
      submitBtn.disabled   = false;
      submitBtn.textContent = "Capture Event";
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Styles (injected once into <head>)
// ─────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById("qc-styles")) return;
  const style = document.createElement("style");
  style.id = "qc-styles";
  style.textContent = `
    /* ── Layout ──────────────────────────────────────────── */
    .qc-root {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 28px;
      align-items: start;
    }
    @media (max-width: 860px) {
      .qc-root { grid-template-columns: 1fr; }
    }

    /* ── Type grid ───────────────────────────────────────── */
    #qc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
      gap: 12px;
    }

    .qc-type-btn {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding: 18px 16px;
      background: var(--surface, #fff);
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 14px;
      cursor: pointer;
      text-align: left;
      transition: border-color 140ms, box-shadow 140ms, transform 140ms, background 140ms;
      animation: fadeUp 0.35s ease both;
    }
    .qc-type-btn:hover {
      border-color: var(--type-color);
      background: var(--type-bg);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,.08);
    }
    .qc-type-btn.active {
      border-color: var(--type-color);
      background: var(--type-bg);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--type-color) 18%, transparent);
    }
    .qc-type-icon {
      font-size: 1.5rem;
      line-height: 1;
    }
    .qc-type-label {
      font-family: var(--font-body, sans-serif);
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-primary, #1A1714);
      line-height: 1.2;
    }
    .qc-type-desc {
      font-size: 0.7rem;
      color: var(--text-muted, #A09890);
      line-height: 1.4;
    }

    /* ── Panel ───────────────────────────────────────────── */
    #qc-panel {
      position: sticky;
      top: calc(var(--header-h, 64px) + 24px);
    }
    .qc-empty {
      padding: 48px 24px;
      text-align: center;
      color: var(--text-muted, #A09890);
      font-size: 0.875rem;
      border: 1.5px dashed var(--border, #E2DDD6);
      border-radius: 14px;
    }

    /* ── Form ────────────────────────────────────────────── */
    .qc-form {
      background: var(--surface, #fff);
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 16px;
      padding: 22px 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,.07);
      animation: fadeUp 0.25s ease both;
    }
    .qc-form-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border, #E2DDD6);
    }
    .qc-form-icon { font-size: 1.75rem; line-height: 1; }
    .qc-form-title {
      font-family: var(--font-display, serif);
      font-size: 1.1rem;
      color: var(--type-color);
    }
    .qc-form-subtitle {
      font-size: 0.75rem;
      color: var(--text-muted, #A09890);
      margin-top: 2px;
    }

    /* ── Fields ──────────────────────────────────────────── */
    .qc-field { margin-bottom: 14px; }
    .qc-field-label {
      display: block;
      font-family: var(--font-mono, monospace);
      font-size: 0.65rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-secondary, #6B6560);
      margin-bottom: 6px;
    }
    .req { color: #C0392B; }
    .qc-input {
      width: 100%;
      padding: 8px 11px;
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 8px;
      font-family: var(--font-body, sans-serif);
      font-size: 0.875rem;
      color: var(--text-primary, #1A1714);
      background: var(--bg, #F7F5F0);
      outline: none;
      transition: border-color 140ms, box-shadow 140ms;
    }
    .qc-input:focus {
      border-color: var(--type-color, #2D5BE3);
      box-shadow: 0 0 0 3px var(--type-bg, #EEF2FD);
      background: #fff;
    }
    .qc-select { cursor: pointer; }
    .qc-textarea { resize: vertical; min-height: 72px; }

    /* ── Severity ────────────────────────────────────────── */
    .qc-severity { margin-bottom: 18px; }
    .qc-severity-group {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }
    .qc-sev-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 8px 4px;
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 8px;
      font-size: 0.75rem;
      color: var(--text-muted, #A09890);
      background: var(--bg, #F7F5F0);
      cursor: pointer;
      transition: all 140ms;
    }
    .qc-sev-btn:hover  { border-color: var(--type-color); color: var(--type-color); }
    .qc-sev-btn.active {
      border-color: var(--type-color);
      background: var(--type-bg);
      color: var(--type-color);
      font-weight: 600;
    }
    .qc-sev-btn span { font-size: 0.65rem; letter-spacing: 0.04em; }

    /* ── Actions ─────────────────────────────────────────── */
    .qc-form-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid var(--border, #E2DDD6);
    }
    .qc-btn {
      display: inline-flex; align-items: center;
      padding: 8px 18px;
      border-radius: 8px;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 140ms, transform 140ms;
      border: none;
    }
    .qc-btn:active { transform: scale(0.97); }
    .qc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .qc-btn--primary { color: #fff; }
    .qc-btn--primary:hover { opacity: 0.88; }
    .qc-btn--ghost {
      background: transparent;
      color: var(--text-secondary, #6B6560);
      border: 1.5px solid var(--border, #E2DDD6);
    }
    .qc-btn--ghost:hover { background: var(--bg, #F7F5F0); }

    /* ── Messages ────────────────────────────────────────── */
    .qc-msg {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 0.8125rem;
      margin-bottom: 14px;
    }
    .qc-msg--error {
      background: #FEF2F2;
      border: 1px solid #FECACA;
      color: #B91C1C;
    }

    /* ── Success ─────────────────────────────────────────── */
    .qc-success {
      padding: 32px 24px;
      text-align: center;
      background: var(--surface, #fff);
      border: 1.5px solid #BBF7D0;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,.07);
      animation: fadeUp 0.3s ease both;
    }
    .qc-success-icon {
      width: 48px; height: 48px;
      background: #ECFDF5;
      color: #166534;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem;
      margin: 0 auto 12px;
    }
    .qc-success-title {
      font-family: var(--font-display, serif);
      font-size: 1.2rem;
      color: #166534;
      margin-bottom: 16px;
    }
    .qc-success-label {
      font-family: var(--font-mono, monospace);
      font-size: 0.65rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-muted, #A09890);
      margin-bottom: 10px;
    }
    .qc-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
    }
    .qc-tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      background: #ECFDF5;
      border: 1px solid #BBF7D0;
      border-radius: 100px;
      font-family: var(--font-mono, monospace);
      font-size: 0.7rem;
      color: #166534;
    }
    .qc-tag-score {
      background: #BBF7D0;
      border-radius: 100px;
      padding: 1px 5px;
      font-size: 0.6rem;
      color: #14532D;
    }
    .qc-tag-none {
      font-size: 0.8rem;
      color: var(--text-muted, #A09890);
      font-style: italic;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────
// Module entry point
// ─────────────────────────────────────────────────────────────

export default async function init(container, actionsBar) {
  _container  = container;
  _activeType = null;

  injectStyles();

  // Scaffold layout immediately
  container.innerHTML = `
    <div class="qc-root">
      <div id="qc-grid"></div>
      <div id="qc-panel">
        <div class="qc-empty">
          <p>Select an event type to begin capturing.</p>
        </div>
      </div>
    </div>`;

  renderGrid();

  // Load students in background — re-render form if one is open
  _students = await fetchStudents();
  if (_activeType) {
    const type = EVENT_TYPES.find(t => t.id === _activeType);
    renderForm(type);
  }
}
