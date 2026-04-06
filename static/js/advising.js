// static/js/advising.js
// Advising module — three-tab interface: Profile, Vocabulary, Phrases.
// Exports default init(container, actionsBar) for the index.html router.

const API_BASE = "http://localhost:5000/api";

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

let _container    = null;
let _activeTab    = "profile";
let _students     = [];
let _selectedId   = null;   // currently selected student id
let _vocabItems   = [];
let _profileData  = {};

// ─────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function loadStudents() {
  _students = await apiFetch("/students").catch(() => []);
}

async function loadProfile() {
  if (!_selectedId) return;
  const data = await apiFetch(`/advising/${_selectedId}/profile`).catch(() => null);
  _profileData = data?.profile ?? {};
}

async function loadVocab() {
  if (!_selectedId) return;
  _vocabItems = await apiFetch(`/advising/${_selectedId}/vocab`).catch(() => []);
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById("adv-styles")) return;
  const s = document.createElement("style");
  s.id = "adv-styles";
  s.textContent = `
    /* ── Shell ───────────────────────────────────────────── */
    .adv-root { display: flex; flex-direction: column; gap: 0; }

    /* ── Student selector bar ────────────────────────────── */
    .adv-selector-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #E2DDD6);
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
    }
    .adv-selector-label {
      font-family: var(--font-mono, monospace);
      font-size: 0.68rem;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--text-muted, #A09890);
      white-space: nowrap;
    }
    .adv-student-select {
      flex: 1;
      max-width: 320px;
      padding: 7px 11px;
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 8px;
      font-family: var(--font-body, sans-serif);
      font-size: 0.875rem;
      color: var(--text-primary, #1A1714);
      background: var(--bg, #F7F5F0);
      outline: none;
      cursor: pointer;
      transition: border-color 140ms;
    }
    .adv-student-select:focus { border-color: var(--accent, #2D5BE3); }

    /* ── Tab bar ─────────────────────────────────────────── */
    .adv-tabs {
      display: flex;
      gap: 2px;
      border-bottom: 2px solid var(--border, #E2DDD6);
      margin-bottom: 24px;
    }
    .adv-tab {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 10px 18px;
      font-family: var(--font-body, sans-serif);
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-muted, #A09890);
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      cursor: pointer;
      margin-bottom: -2px;
      transition: color 140ms, border-color 140ms;
      white-space: nowrap;
    }
    .adv-tab:hover { color: var(--text-primary, #1A1714); }
    .adv-tab.active {
      color: var(--accent, #2D5BE3);
      border-bottom-color: var(--accent, #2D5BE3);
    }
    .adv-tab-icon { font-size: 0.95rem; }

    /* ── Panel ───────────────────────────────────────────── */
    .adv-panel { animation: advFadeUp 0.25s ease both; }
    @keyframes advFadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── No-student placeholder ──────────────────────────── */
    .adv-placeholder {
      text-align: center;
      padding: 60px 24px;
      color: var(--text-muted, #A09890);
    }
    .adv-placeholder-icon { font-size: 2rem; margin-bottom: 12px; opacity: .35; }
    .adv-placeholder p { font-size: 0.875rem; }

    /* ── Profile form ────────────────────────────────────── */
    .adv-form-card {
      background: var(--surface, #fff);
      border: 1px solid var(--border, #E2DDD6);
      border-radius: 14px;
      padding: 24px 28px;
      box-shadow: 0 2px 8px rgba(0,0,0,.05);
      max-width: 680px;
    }
    .adv-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .adv-form-full { grid-column: 1 / -1; }
    .adv-field { display: flex; flex-direction: column; gap: 6px; }
    .adv-label {
      font-family: var(--font-mono, monospace);
      font-size: 0.65rem;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--text-secondary, #6B6560);
    }
    .adv-input, .adv-select, .adv-textarea {
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
    .adv-input:focus, .adv-select:focus, .adv-textarea:focus {
      border-color: var(--accent, #2D5BE3);
      box-shadow: 0 0 0 3px var(--accent-light, #EEF2FD);
      background: #fff;
    }
    .adv-textarea { resize: vertical; min-height: 80px; }
    .adv-select { cursor: pointer; }

    /* Checkboxes */
    .adv-checkboxes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 2px;
    }
    .adv-checkbox-label {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 100px;
      font-size: 0.8rem;
      color: var(--text-secondary, #6B6560);
      cursor: pointer;
      transition: border-color 140ms, background 140ms, color 140ms;
      user-select: none;
    }
    .adv-checkbox-label:has(input:checked) {
      border-color: var(--accent, #2D5BE3);
      background: var(--accent-light, #EEF2FD);
      color: var(--accent, #2D5BE3);
    }
    .adv-checkbox-label input { display: none; }

    /* Form actions */
    .adv-form-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border, #E2DDD6);
    }

    /* ── Buttons ─────────────────────────────────────────── */
    .adv-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 18px;
      border-radius: 8px;
      font-family: var(--font-body, sans-serif);
      font-size: 0.8125rem;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: opacity 140ms, transform 140ms, background 140ms;
    }
    .adv-btn:active { transform: scale(0.97); }
    .adv-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .adv-btn--primary { background: var(--accent, #2D5BE3); color: #fff; }
    .adv-btn--primary:hover { opacity: .88; }
    .adv-btn--ghost {
      background: transparent;
      color: var(--text-secondary, #6B6560);
      border: 1.5px solid var(--border, #E2DDD6);
    }
    .adv-btn--ghost:hover { background: var(--bg, #F7F5F0); }
    .adv-btn--danger {
      background: #FEF2F2;
      color: #B91C1C;
      border: 1.5px solid #FECACA;
      padding: 4px 10px;
      font-size: 0.75rem;
    }
    .adv-btn--danger:hover { background: #FEE2E2; }
    .adv-btn--sm { padding: 5px 12px; font-size: 0.75rem; }

    /* ── Feedback messages ───────────────────────────────── */
    .adv-msg {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.8125rem;
      margin-top: 12px;
    }
    .adv-msg--success {
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      color: #166534;
    }
    .adv-msg--error {
      background: #FEF2F2;
      border: 1px solid #FECACA;
      color: #B91C1C;
    }
    .adv-msg--info {
      background: var(--accent-light, #EEF2FD);
      border: 1px solid #BFCFEF;
      color: var(--accent, #2D5BE3);
    }

    /* ── Vocab list ──────────────────────────────────────── */
    .adv-vocab-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .adv-vocab-count {
      font-family: var(--font-mono, monospace);
      font-size: 0.7rem;
      color: var(--text-muted, #A09890);
      margin-left: auto;
    }
    .adv-vocab-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
    }
    .adv-vocab-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #E2DDD6);
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
      transition: box-shadow 140ms;
      animation: advFadeUp 0.2s ease both;
    }
    .adv-vocab-item:hover { box-shadow: 0 3px 10px rgba(0,0,0,.07); }
    .adv-vocab-term {
      font-family: var(--font-display, serif);
      font-size: 0.9375rem;
      color: var(--text-primary, #1A1714);
      flex: 1;
      min-width: 0;
    }
    .adv-vocab-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .adv-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 100px;
      font-family: var(--font-mono, monospace);
      font-size: 0.62rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: var(--bg, #F7F5F0);
      color: var(--text-muted, #A09890);
      border: 1px solid var(--border, #E2DDD6);
    }
    .adv-chip--accent {
      background: var(--accent-light, #EEF2FD);
      color: var(--accent, #2D5BE3);
      border-color: #BFCFEF;
    }
    .adv-chip--green {
      background: #F0FDF4;
      color: #166534;
      border-color: #BBF7D0;
    }
    .adv-vocab-weight {
      font-family: var(--font-mono, monospace);
      font-size: 0.7rem;
      color: var(--text-muted, #A09890);
      width: 32px;
      text-align: right;
      flex-shrink: 0;
    }

    /* ── Add vocab form ──────────────────────────────────── */
    .adv-add-form {
      background: var(--surface, #fff);
      border: 1.5px dashed var(--border, #E2DDD6);
      border-radius: 12px;
      padding: 20px 22px;
      margin-bottom: 8px;
    }
    .adv-add-form-title {
      font-family: var(--font-display, serif);
      font-size: 0.95rem;
      color: var(--text-primary, #1A1714);
      margin-bottom: 14px;
    }
    .adv-add-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .adv-add-row {
      display: grid;
      grid-template-columns: 1fr 1fr 120px 80px;
      gap: 10px;
      margin-bottom: 10px;
    }

    /* ── CSV import result ───────────────────────────────── */
    .adv-csv-result {
      background: var(--surface, #fff);
      border: 1px solid var(--border, #E2DDD6);
      border-radius: 10px;
      padding: 16px 18px;
      margin-top: 12px;
    }
    .adv-csv-stats {
      display: flex;
      gap: 20px;
      margin-bottom: 8px;
    }
    .adv-csv-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .adv-csv-stat-num {
      font-family: var(--font-display, serif);
      font-size: 1.5rem;
      line-height: 1;
    }
    .adv-csv-stat-num--green { color: #166534; }
    .adv-csv-stat-num--yellow { color: #92400E; }
    .adv-csv-stat-num--red { color: #B91C1C; }
    .adv-csv-stat-label {
      font-family: var(--font-mono, monospace);
      font-size: 0.6rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted, #A09890);
    }
    .adv-csv-detail {
      font-size: 0.75rem;
      color: var(--text-secondary, #6B6560);
      margin-top: 8px;
    }
    .adv-csv-detail summary { cursor: pointer; font-weight: 500; }
    .adv-csv-detail ul { margin: 6px 0 0 16px; }
    .adv-csv-detail li { margin-bottom: 3px; font-family: var(--font-mono, monospace); font-size: 0.7rem; }

    /* ── Phrases placeholder ─────────────────────────────── */
    .adv-phrases-placeholder {
      text-align: center;
      padding: 72px 24px;
      color: var(--text-muted, #A09890);
      border: 1.5px dashed var(--border, #E2DDD6);
      border-radius: 14px;
    }
    .adv-phrases-placeholder .icon { font-size: 2rem; margin-bottom: 12px; opacity: .3; }
    .adv-phrases-placeholder p { font-size: 0.875rem; max-width: 300px; margin: 0 auto; }

    /* ── Loading ─────────────────────────────────────────── */
    .adv-loading {
      display: flex; align-items: center; justify-content: center;
      gap: 10px; padding: 40px; color: var(--text-muted, #A09890);
      font-size: 0.8rem; font-family: var(--font-mono, monospace);
    }
    .adv-spinner {
      width: 18px; height: 18px;
      border: 2px solid var(--border, #E2DDD6);
      border-top-color: var(--accent, #2D5BE3);
      border-radius: 50%;
      animation: advSpin 0.7s linear infinite;
    }
    @keyframes advSpin { to { transform: rotate(360deg); } }

    @media (max-width: 640px) {
      .adv-form-grid, .adv-add-grid, .adv-add-row { grid-template-columns: 1fr; }
      .adv-form-full { grid-column: 1; }
    }
  `;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────
// Render helpers
// ─────────────────────────────────────────────────────────────

function studentSelector() {
  const opts = _students.length
    ? _students.map(s =>
        `<option value="${s.id}"${s.id === _selectedId ? " selected" : ""}>${s.name}</option>`
      ).join("")
    : `<option disabled>No students found</option>`;

  return `
    <div class="adv-selector-bar">
      <span class="adv-selector-label">Student</span>
      <select class="adv-student-select" id="adv-student-select" onchange="ADV.selectStudent(this.value)">
        <option value="" disabled${!_selectedId ? " selected" : ""}>Select a student…</option>
        ${opts}
      </select>
    </div>`;
}

function tabBar() {
  const tabs = [
    { id: "profile",    icon: "👤", label: "Context Profile" },
    { id: "vocab",      icon: "📚", label: "Vocabulary" },
    { id: "phrases",    icon: "💬", label: "Phrases" },
  ];
  return `
    <div class="adv-tabs">
      ${tabs.map(t => `
        <button class="adv-tab${_activeTab === t.id ? " active" : ""}"
          onclick="ADV.setTab('${t.id}')">
          <span class="adv-tab-icon">${t.icon}</span>
          ${t.label}
        </button>`).join("")}
    </div>`;
}

function noStudentPlaceholder() {
  return `
    <div class="adv-placeholder">
      <div class="adv-placeholder-icon">👤</div>
      <p>Select a student above to view and edit their advising data.</p>
    </div>`;
}

// ── Profile tab ───────────────────────────────────────────────

function profilePanel() {
  const p = _profileData;
  const envOptions = ["Phone", "Zoom", "In-person", "International"];
  const selectedEnvs = (p.speaking_environments || "").split(",").map(s => s.trim());
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];

  const envCheckboxes = envOptions.map(env => `
    <label class="adv-checkbox-label">
      <input type="checkbox" value="${env}"
        ${selectedEnvs.includes(env) ? "checked" : ""}
        onchange="ADV.onEnvChange()">
      ${env}
    </label>`).join("");

  return `
    <div class="adv-panel" id="adv-profile-panel">
      <div class="adv-form-card">
        <div class="adv-form-grid">

          <div class="adv-field">
            <label class="adv-label">Job Title</label>
            <input id="adv-job-title" class="adv-input" type="text"
              placeholder="e.g. Software Engineer"
              value="${p.job_title ?? ""}">
          </div>

          <div class="adv-field">
            <label class="adv-label">Target Level</label>
            <select id="adv-target-level" class="adv-select">
              <option value="">— not set —</option>
              ${levels.map(l =>
                `<option value="${l}"${p.target_level === l ? " selected" : ""}>${l}</option>`
              ).join("")}
            </select>
          </div>

          <div class="adv-field adv-form-full">
            <label class="adv-label">Typical Tasks</label>
            <textarea id="adv-typical-tasks" class="adv-textarea"
              placeholder="e.g. Leads weekly stand-ups, writes technical specs, presents to stakeholders…"
              rows="3">${p.typical_tasks ?? ""}</textarea>
          </div>

          <div class="adv-field adv-form-full">
            <label class="adv-label">Speaking Environments</label>
            <div class="adv-checkboxes" id="adv-envs">
              ${envCheckboxes}
            </div>
          </div>

          <div class="adv-field">
            <label class="adv-label">Target Date</label>
            <input id="adv-target-date" class="adv-input" type="date"
              value="${p.target_date ? p.target_date.slice(0,10) : ""}">
          </div>

          <div class="adv-field">
            <label class="adv-label">Test Purpose</label>
            <input id="adv-test-purpose" class="adv-input" type="text"
              placeholder="e.g. IELTS Academic 7.0"
              value="${p.test_purpose ?? ""}">
          </div>

          <div class="adv-field">
            <label class="adv-label">Accent Constraints</label>
            <input id="adv-accent" class="adv-input" type="text"
              placeholder="e.g. Must be understood by North American clients"
              value="${p.accent_constraints ?? ""}">
          </div>

        </div>

        <div class="adv-form-actions">
          <button id="adv-save-profile" class="adv-btn adv-btn--primary"
            onclick="ADV.saveProfile()">Save Profile</button>
          <span id="adv-profile-msg"></span>
        </div>
      </div>
    </div>`;
}

// ── Vocabulary tab ────────────────────────────────────────────

function vocabPanel() {
  const listHTML = _vocabItems.length
    ? _vocabItems.map(item => `
        <div class="adv-vocab-item" id="adv-vocab-${item.id}">
          <div class="adv-vocab-term">${item.term}</div>
          <div class="adv-vocab-meta">
            ${item.domain    ? `<span class="adv-chip adv-chip--accent">${item.domain}</span>` : ""}
            ${item.subdomain ? `<span class="adv-chip">${item.subdomain}</span>` : ""}
            ${item.situation ? `<span class="adv-chip">${item.situation}</span>` : ""}
            ${item.is_multiword ? `<span class="adv-chip adv-chip--green">multiword</span>` : ""}
          </div>
          <span class="adv-vocab-weight" title="Priority weight">${item.priority_weight.toFixed(1)}</span>
          <button class="adv-btn adv-btn--danger"
            onclick="ADV.deleteVocab(${item.id}, '${item.term.replace(/'/g,"\\'")}')">✕</button>
        </div>`).join("")
    : `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:.875rem;">
        No vocabulary items yet. Add one below or import a CSV.
       </div>`;

  return `
    <div class="adv-panel" id="adv-vocab-panel">

      <div class="adv-vocab-toolbar">
        <span class="adv-vocab-count">${_vocabItems.length} item${_vocabItems.length !== 1 ? "s" : ""}</span>
      </div>

      <div class="adv-vocab-list" id="adv-vocab-list">
        ${listHTML}
      </div>

      <!-- Add new item form -->
      <div class="adv-add-form">
        <div class="adv-add-form-title">Add Vocabulary Item</div>
        <div id="adv-add-msg"></div>
        <div class="adv-add-grid">
          <div class="adv-field">
            <label class="adv-label">Term <span style="color:#C0392B">*</span></label>
            <input id="adv-new-term" class="adv-input" type="text"
              placeholder="e.g. pull request" />
          </div>
          <div class="adv-field">
            <label class="adv-label">Domain</label>
            <input id="adv-new-domain" class="adv-input" type="text"
              placeholder="e.g. technology" />
          </div>
          <div class="adv-field">
            <label class="adv-label">Subdomain</label>
            <input id="adv-new-subdomain" class="adv-input" type="text"
              placeholder="e.g. software" />
          </div>
        </div>
        <div class="adv-add-row">
          <div class="adv-field">
            <label class="adv-label">Situation</label>
            <input id="adv-new-situation" class="adv-input" type="text"
              placeholder="e.g. code review meetings" />
          </div>
          <div class="adv-field">
            <label class="adv-label">Priority</label>
            <input id="adv-new-weight" class="adv-input" type="number"
              min="0.1" max="3" step="0.1" value="1.0" />
          </div>
          <div class="adv-field" style="justify-content:flex-end;padding-bottom:1px;">
            <label class="adv-label">Multiword?</label>
            <label class="adv-checkbox-label" style="width:fit-content;">
              <input type="checkbox" id="adv-new-multiword"> Yes
            </label>
          </div>
          <div class="adv-field" style="justify-content:flex-end;">
            <label class="adv-label">&nbsp;</label>
            <button id="adv-add-btn" class="adv-btn adv-btn--primary"
              onclick="ADV.addVocab()">Add</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Phrases tab ───────────────────────────────────────────────

function phrasesPanel() {
  return `
    <div class="adv-panel">
      <div class="adv-phrases-placeholder">
        <div class="icon">💬</div>
        <p>Phrase bank coming soon. This module will suggest high-frequency collocations and functional phrases based on the student's professional context.</p>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Render pipeline
// ─────────────────────────────────────────────────────────────

function render() {
  if (!_container) return;

  let panelHTML = "";
  if (!_selectedId) {
    panelHTML = noStudentPlaceholder();
  } else {
    switch (_activeTab) {
      case "profile":  panelHTML = profilePanel();  break;
      case "vocab":    panelHTML = vocabPanel();     break;
      case "phrases":  panelHTML = phrasesPanel();   break;
    }
  }

  _container.innerHTML = `
    <div class="adv-root">
      ${studentSelector()}
      ${tabBar()}
      ${panelHTML}
    </div>`;
}

function showLoading(target) {
  const el = document.getElementById(target);
  if (el) el.innerHTML = `<div class="adv-loading"><div class="adv-spinner"></div> Loading…</div>`;
}

function showMsg(targetId, type, text) {
  const el = document.getElementById(targetId);
  if (el) el.innerHTML = `<div class="adv-msg adv-msg--${type}">${text}</div>`;
  if (type === "success") setTimeout(() => { if (el) el.innerHTML = ""; }, 3000);
}

// ─────────────────────────────────────────────────────────────
// Public API (window.ADV for inline handlers)
// ─────────────────────────────────────────────────────────────

window.ADV = {

  async selectStudent(val) {
    _selectedId = val ? parseInt(val) : null;
    _profileData = {};
    _vocabItems  = [];
    render();

    if (!_selectedId) return;

    if (_activeTab === "profile") {
      showLoading("adv-profile-panel");
      await loadProfile();
    } else if (_activeTab === "vocab") {
      showLoading("adv-vocab-panel");
      await loadVocab();
    }
    render();
  },

  async setTab(tab) {
    _activeTab = tab;
    render();
    if (!_selectedId) return;

    if (tab === "profile" && !Object.keys(_profileData).length) {
      showLoading("adv-profile-panel");
      await loadProfile();
      render();
    } else if (tab === "vocab") {
      showLoading("adv-vocab-panel");
      await loadVocab();
      render();
    }
  },

  onEnvChange() {
    // No-op: checkboxes are read directly on save
  },

  async saveProfile() {
    const btn = document.getElementById("adv-save-profile");
    btn.disabled = true;
    btn.textContent = "Saving…";

    const envChecked = [...document.querySelectorAll("#adv-envs input:checked")]
      .map(cb => cb.value).join(", ");

    const payload = {
      job_title:             document.getElementById("adv-job-title")?.value.trim()    || null,
      typical_tasks:         document.getElementById("adv-typical-tasks")?.value.trim() || null,
      speaking_environments: envChecked || null,
      accent_constraints:    document.getElementById("adv-accent")?.value.trim()       || null,
      target_level:          document.getElementById("adv-target-level")?.value        || null,
      target_date:           document.getElementById("adv-target-date")?.value         || null,
      test_purpose:          document.getElementById("adv-test-purpose")?.value.trim() || null,
    };

    // Remove null values so API doesn't overwrite existing data with null
    const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== null && v !== ""));

    try {
      await apiFetch(`/advising/${_selectedId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
      });
      _profileData = { ..._profileData, ...clean };
      showMsg("adv-profile-msg", "success", "✓ Profile saved");
    } catch (err) {
      showMsg("adv-profile-msg", "error", `✕ ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Profile";
    }
  },

  async addVocab() {
    const term     = document.getElementById("adv-new-term")?.value.trim();
    const domain   = document.getElementById("adv-new-domain")?.value.trim()    || undefined;
    const subdomain= document.getElementById("adv-new-subdomain")?.value.trim() || undefined;
    const situation= document.getElementById("adv-new-situation")?.value.trim() || undefined;
    const weight   = parseFloat(document.getElementById("adv-new-weight")?.value || "1.0");
    const multiword= document.getElementById("adv-new-multiword")?.checked ?? false;
    const btn      = document.getElementById("adv-add-btn");

    if (!term) {
      showMsg("adv-add-msg", "error", "Term is required.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Adding…";

    try {
      const item = await apiFetch(`/advising/${_selectedId}/vocab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term,
          domain,
          subdomain,
          situation,
          priority_weight: weight,
          is_multiword: multiword,
        }),
      });
      _vocabItems.unshift(item);
      render();
    } catch (err) {
      showMsg("adv-add-msg", "error", `✕ ${err.message}`);
      btn.disabled = false;
      btn.textContent = "Add";
    }
  },

  async deleteVocab(itemId, term) {
    if (!confirm(`Remove "${term}" from the vocabulary list?`)) return;
    try {
      await apiFetch(`/advising/${_selectedId}/vocab/${itemId}`, { method: "DELETE" });
      _vocabItems = _vocabItems.filter(i => i.id !== itemId);
      render();
    } catch (err) {
      alert(`Failed to remove: ${err.message}`);
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Module entry point
// ─────────────────────────────────────────────────────────────

export default async function init(container, actionsBar) {
  _container   = container;
  _activeTab   = "profile";
  _selectedId  = null;
  _profileData = {};
  _vocabItems  = [];

  injectStyles();
  container.innerHTML = `<div class="adv-loading"><div class="adv-spinner"></div> Loading students…</div>`;

  await loadStudents();
  render();
}
