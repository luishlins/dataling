// static/js/testing.js
// Testing module — Item Bank and Sessions tabs.
// Exports default init(container, actionsBar) for the index.html router.

const API_BASE = "http://localhost:5000/api";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SESSION_TYPES = [
  { id: "ReadingMCQ",        icon: "📖", label: "Reading MCQ",        desc: "Multiple-choice comprehension" },
  { id: "VideoUnderstanding",icon: "🎬", label: "Video Understanding", desc: "Listening via video input" },
  { id: "PronunciationTask", icon: "🔊", label: "Pronunciation Task",  desc: "Controlled phonological production" },
  { id: "FreeSpeaking",      icon: "🗣", label: "Free Speaking",       desc: "Unscripted oral production" },
  { id: "WritingTask",       icon: "✍️", label: "Writing Task",        desc: "Written production assessment" },
  { id: "Dictation",         icon: "🎧", label: "Dictation",           desc: "Transcription under listening conditions" },
];

const CEFR_LEVELS  = ["A1", "A2", "B1", "B2", "C1", "C2"];
const ITEM_TYPES   = ["ReadingMCQ", "VideoUnderstanding", "PronunciationTask",
                      "FreeSpeaking", "WritingTask", "Dictation"];

// ─────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────

let _container   = null;
let _activeTab   = "items";
let _students    = [];
let _items       = [];
let _sessions    = [];
let _selectedStudent = null;
let _filterType  = "";
let _filterCefr  = "";
let _modalOpen   = false;

// ─────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res  = await fetch(`${API_BASE}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function loadStudents() {
  _students = await apiFetch("/students").catch(() => []);
}

async function loadItems() {
  const params = new URLSearchParams();
  if (_filterType) params.set("type", _filterType);
  if (_filterCefr) params.set("cefr", _filterCefr);
  const qs = params.toString() ? `?${params}` : "";
  _items = await apiFetch(`/testing/items${qs}`).catch(() => []);
}

async function loadSessions() {
  if (!_selectedStudent) { _sessions = []; return; }
  _sessions = await apiFetch(`/testing/sessions/${_selectedStudent}`).catch(() => []);
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById("tst-styles")) return;
  const s = document.createElement("style");
  s.id = "tst-styles";
  s.textContent = `
    /* ── Shell ───────────────────────────────────────────── */
    .tst-root { display: flex; flex-direction: column; gap: 0; }

    /* ── Tab bar ─────────────────────────────────────────── */
    .tst-tabs {
      display: flex;
      gap: 2px;
      border-bottom: 2px solid var(--border, #E2DDD6);
      margin-bottom: 24px;
    }
    .tst-tab {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 10px 18px;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-muted, #A09890);
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      cursor: pointer;
      margin-bottom: -2px;
      transition: color 140ms, border-color 140ms;
    }
    .tst-tab:hover  { color: var(--text-primary, #1A1714); }
    .tst-tab.active { color: var(--accent, #2D5BE3); border-bottom-color: var(--accent, #2D5BE3); }

    /* ── Toolbar ─────────────────────────────────────────── */
    .tst-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .tst-select {
      padding: 7px 11px;
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 8px;
      font-family: var(--font-body, sans-serif);
      font-size: 0.8125rem;
      color: var(--text-secondary, #6B6560);
      background: var(--bg, #F7F5F0);
      outline: none;
      cursor: pointer;
      transition: border-color 140ms;
    }
    .tst-select:focus { border-color: var(--accent, #2D5BE3); }
    .tst-count {
      font-family: var(--font-mono, monospace);
      font-size: 0.7rem;
      color: var(--text-muted, #A09890);
      margin-left: auto;
    }

    /* ── Buttons ─────────────────────────────────────────── */
    .tst-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.8125rem;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: opacity 140ms, transform 140ms;
    }
    .tst-btn:active  { transform: scale(0.97); }
    .tst-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .tst-btn--primary { background: var(--accent, #2D5BE3); color: #fff; }
    .tst-btn--primary:hover { opacity: .88; }
    .tst-btn--ghost {
      background: transparent;
      color: var(--text-secondary, #6B6560);
      border: 1.5px solid var(--border, #E2DDD6);
    }
    .tst-btn--ghost:hover { background: var(--bg, #F7F5F0); }
    .tst-btn--danger {
      background: #FEF2F2;
      color: #B91C1C;
      border: 1.5px solid #FECACA;
      padding: 4px 10px;
      font-size: 0.72rem;
    }
    .tst-btn--danger:hover { background: #FEE2E2; }
    .tst-btn--sm { padding: 5px 11px; font-size: 0.75rem; }

    /* ── Item cards ──────────────────────────────────────── */
    .tst-item-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .tst-item-card {
      background: var(--surface, #fff);
      border: 1px solid var(--border, #E2DDD6);
      border-radius: 10px;
      padding: 14px 18px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
      animation: tstFade 0.2s ease both;
      transition: box-shadow 140ms;
    }
    .tst-item-card:hover { box-shadow: 0 3px 12px rgba(0,0,0,.07); }
    .tst-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .tst-item-id {
      font-family: var(--font-mono, monospace);
      font-size: 0.62rem;
      color: var(--text-muted, #A09890);
    }
    .tst-item-content {
      font-size: 0.8125rem;
      color: var(--text-secondary, #6B6560);
      line-height: 1.5;
      max-height: 56px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .tst-item-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: space-between;
      gap: 8px;
    }

    /* ── Chips / badges ──────────────────────────────────── */
    .tst-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 100px;
      font-family: var(--font-mono, monospace);
      font-size: 0.62rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .tst-chip--blue  { background: var(--accent-light, #EEF2FD); color: var(--accent, #2D5BE3); }
    .tst-chip--gray  { background: var(--bg, #F7F5F0); color: var(--text-muted, #A09890); border: 1px solid var(--border, #E2DDD6); }
    .tst-chip--green { background: #F0FDF4; color: #166534; }

    /* ── Empty / loading ─────────────────────────────────── */
    .tst-empty {
      text-align: center;
      padding: 60px 24px;
      color: var(--text-muted, #A09890);
      border: 1.5px dashed var(--border, #E2DDD6);
      border-radius: 14px;
    }
    .tst-empty-icon { font-size: 1.75rem; margin-bottom: 10px; opacity: .3; }
    .tst-empty p    { font-size: 0.875rem; }
    .tst-loading {
      display: flex; align-items: center; justify-content: center;
      gap: 10px; padding: 48px;
      color: var(--text-muted, #A09890);
      font-family: var(--font-mono, monospace);
      font-size: 0.75rem;
    }
    .tst-spinner {
      width: 18px; height: 18px;
      border: 2px solid var(--border, #E2DDD6);
      border-top-color: var(--accent, #2D5BE3);
      border-radius: 50%;
      animation: tstSpin 0.7s linear infinite;
    }

    /* ── Session cards ───────────────────────────────────── */
    .tst-session-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .tst-session-card {
      background: var(--surface, #fff);
      border: 1px solid var(--border, #E2DDD6);
      border-radius: 12px;
      padding: 16px 18px;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
      animation: tstFade 0.25s ease both;
      transition: box-shadow 140ms, transform 140ms;
    }
    .tst-session-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,.08); transform: translateY(-2px); }
    .tst-session-icon  { font-size: 1.5rem; margin-bottom: 8px; }
    .tst-session-type  { font-family: var(--font-display, serif); font-size: 1rem; color: var(--text-primary, #1A1714); margin-bottom: 6px; }
    .tst-session-meta  { font-size: 0.75rem; color: var(--text-muted, #A09890); font-family: var(--font-mono, monospace); }
    .tst-session-notes { font-size: 0.8rem; color: var(--text-secondary, #6B6560); margin-top: 8px; font-style: italic; }

    /* ── Modal ───────────────────────────────────────────── */
    .tst-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.35);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 500;
      animation: tstFadeIn 0.15s ease both;
    }
    .tst-modal {
      background: var(--surface, #fff);
      border-radius: 16px;
      padding: 28px 32px;
      width: 100%;
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,.2);
      animation: tstSlideUp 0.2s ease both;
    }
    .tst-modal-title {
      font-family: var(--font-display, serif);
      font-size: 1.3rem;
      color: var(--text-primary, #1A1714);
      margin-bottom: 20px;
    }
    .tst-modal-field   { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .tst-modal-label {
      font-family: var(--font-mono, monospace);
      font-size: 0.65rem;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--text-secondary, #6B6560);
    }
    .tst-modal-input, .tst-modal-select, .tst-modal-textarea {
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
    .tst-modal-input:focus, .tst-modal-select:focus, .tst-modal-textarea:focus {
      border-color: var(--accent, #2D5BE3);
      box-shadow: 0 0 0 3px var(--accent-light, #EEF2FD);
      background: #fff;
    }
    .tst-modal-textarea { resize: vertical; min-height: 72px; }

    /* Session type picker */
    .tst-type-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 6px;
    }
    .tst-type-opt {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 10px 6px;
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 10px;
      cursor: pointer;
      text-align: center;
      transition: border-color 140ms, background 140ms;
      background: var(--bg, #F7F5F0);
    }
    .tst-type-opt:hover { border-color: var(--accent, #2D5BE3); background: var(--accent-light, #EEF2FD); }
    .tst-type-opt.selected { border-color: var(--accent, #2D5BE3); background: var(--accent-light, #EEF2FD); }
    .tst-type-opt-icon  { font-size: 1.25rem; }
    .tst-type-opt-label { font-size: 0.68rem; font-weight: 500; color: var(--text-primary, #1A1714); line-height: 1.2; }
    .tst-type-opt-desc  { font-size: 0.6rem; color: var(--text-muted, #A09890); line-height: 1.2; }

    .tst-modal-actions {
      display: flex; gap: 10px; justify-content: flex-end;
      margin-top: 20px; padding-top: 16px;
      border-top: 1px solid var(--border, #E2DDD6);
    }
    .tst-modal-error {
      background: #FEF2F2;
      border: 1px solid #FECACA;
      color: #B91C1C;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 0.8125rem;
      margin-bottom: 12px;
      display: none;
    }

    /* ── Add item form ────────────────────────────────────── */
    .tst-add-form {
      background: var(--surface, #fff);
      border: 1.5px dashed var(--border, #E2DDD6);
      border-radius: 12px;
      padding: 20px 22px;
      margin-bottom: 20px;
      display: none;
    }
    .tst-add-form.open { display: block; animation: tstFade 0.2s ease both; }
    .tst-add-form-title { font-family: var(--font-display, serif); font-size: 0.95rem; margin-bottom: 14px; }
    .tst-add-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .tst-add-full { grid-column: 1 / -1; }
    .tst-add-field { display: flex; flex-direction: column; gap: 5px; }
    .tst-add-label { font-family: var(--font-mono, monospace); font-size: 0.63rem; letter-spacing: .08em; text-transform: uppercase; color: var(--text-secondary, #6B6560); }
    .tst-add-input, .tst-add-select, .tst-add-textarea {
      padding: 7px 10px;
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 7px;
      font-family: var(--font-body, sans-serif);
      font-size: 0.8125rem;
      background: var(--bg, #F7F5F0);
      outline: none;
      transition: border-color 140ms;
    }
    .tst-add-input:focus, .tst-add-select:focus, .tst-add-textarea:focus { border-color: var(--accent, #2D5BE3); }
    .tst-add-textarea { resize: vertical; min-height: 72px; }
    .tst-add-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
    .tst-add-msg { font-size: 0.8rem; margin-bottom: 8px; padding: 7px 10px; border-radius: 7px; display: none; }
    .tst-add-msg--error   { background: #FEF2F2; color: #B91C1C; display: block; }
    .tst-add-msg--success { background: #F0FDF4; color: #166534; display: block; }

    /* ── Checklist Session ───────────────────────────────── */
    .checklist-session {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      text-align: center;
    }

    .checklist-progress {
      position: relative;
      width: 100%;
      height: 8px;
      background: var(--border, #E2DDD6);
      border-radius: 4px;
      margin-bottom: 30px;
      overflow: hidden;
    }

    .checklist-progress-bar {
      height: 100%;
      background: var(--accent, #2D5BE3);
      transition: width 0.3s ease;
    }

    .checklist-counter {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-primary, #1A1714);
    }

    .checklist-item {
      margin-bottom: 40px;
    }

    .checklist-item-text {
      font-size: 48px;
      font-weight: 600;
      line-height: 1.2;
      color: var(--text-primary, #1A1714);
      margin-bottom: 20px;
      word-wrap: break-word;
    }

    .checklist-item-meta {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin-bottom: 30px;
    }

    .checklist-category, .checklist-dimension {
      font-size: 0.875rem;
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 500;
    }

    .checklist-category {
      background: var(--bg-secondary, #F0EDE6);
      color: var(--text-secondary, #6B6560);
    }

    .checklist-dimension {
      background: var(--accent-light, #EBF0FB);
      color: var(--accent, #2D5BE3);
    }

    .checklist-buttons {
      display: flex;
      justify-content: center;
      gap: 40px;
    }

    .checklist-btn {
      padding: 20px 40px;
      border: none;
      border-radius: 16px;
      font-size: 1.25rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 160px;
    }

    .checklist-btn:active {
      transform: scale(0.95);
    }

    .checklist-btn--yes {
      background: #10B981;
      color: white;
    }

    .checklist-btn--yes:hover {
      background: #059669;
    }

    .checklist-btn--no {
      background: #EF4444;
      color: white;
    }

    .checklist-btn--no:hover {
      background: #DC2626;
    }

    .checklist-btn--primary {
      background: var(--accent, #2D5BE3);
      color: white;
      padding: 15px 30px;
      font-size: 1.1rem;
    }

    .checklist-btn--primary:hover {
      background: #1E40AF;
    }

    .checklist-summary {
      text-align: center;
    }

    .checklist-summary h2 {
      font-size: 2rem;
      margin-bottom: 30px;
      color: var(--text-primary, #1A1714);
    }

    .checklist-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .checklist-summary-item {
      background: var(--bg, #F7F5F0);
      padding: 20px;
      border-radius: 12px;
      border: 1px solid var(--border, #E2DDD6);
    }

    .checklist-summary-dimension {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary, #1A1714);
      margin-bottom: 10px;
    }

    .checklist-summary-stats {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .checklist-summary-percentage {
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent, #2D5BE3);
    }

    .checklist-summary-count {
      font-size: 0.875rem;
      color: var(--text-secondary, #6B6560);
    }

    .checklist-actions {
      display: flex;
      justify-content: center;
    }

    /* ── Pronunciation Session ───────────────────────────── */
    .pronunciation-session {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .pronunciation-item {
      font-size: 48px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 60px;
      color: #1A1714;
      line-height: 1.2;
      word-wrap: break-word;
      max-width: 90vw;
    }

    .pronunciation-buttons {
      display: flex;
      gap: 20px;
      width: 90vw;
      max-width: 800px;
    }

    .pronunciation-btn {
      flex: 1;
      width: 45%;
      padding: 25px;
      border: none;
      border-radius: 16px;
      font-size: 1.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .pronunciation-btn:active {
      transform: scale(0.95);
    }

    .pronunciation-btn--correct {
      background: #10B981;
      color: white;
    }

    .pronunciation-btn--correct:hover {
      background: #059669;
    }

    .pronunciation-btn--incorrect {
      background: #EF4444;
      color: white;
    }

    .pronunciation-btn--incorrect:hover {
      background: #DC2626;
    }

    .pronunciation-summary {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }

    .pronunciation-summary h2 {
      font-size: 2.5rem;
      margin-bottom: 40px;
      color: #1A1714;
    }

    .pronunciation-results {
      display: flex;
      gap: 40px;
      width: 90vw;
      max-width: 1000px;
    }

    .pronunciation-column {
      flex: 1;
      background: #F7F5F0;
      border-radius: 16px;
      padding: 30px;
      border: 2px solid #E2DDD6;
    }

    .pronunciation-column h3 {
      font-size: 1.5rem;
      margin-bottom: 20px;
      text-align: center;
      color: #1A1714;
    }

    .pronunciation-column--correct h3 {
      color: #10B981;
    }

    .pronunciation-column--incorrect h3 {
      color: #EF4444;
    }

    .pronunciation-items-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .pronunciation-item-result {
      font-size: 24px;
      padding: 12px 20px;
      background: white;
      border-radius: 8px;
      border: 1px solid #E2DDD6;
      text-align: center;
      font-weight: 500;
    }

    .pronunciation-actions {
      margin-top: 40px;
      display: flex;
      gap: 20px;
    }

    .pronunciation-btn--primary {
      background: #2D5BE3;
      color: white;
      padding: 15px 30px;
      border: none;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .pronunciation-btn--primary:hover {
      background: #1E40AF;
    }

    @media (max-width: 768px) {
      .pronunciation-item {
        font-size: 36px;
        margin-bottom: 40px;
      }

      .pronunciation-buttons {
        flex-direction: column;
        gap: 15px;
      }

      .pronunciation-btn {
        width: 100%;
      }

      .pronunciation-results {
        flex-direction: column;
        gap: 20px;
      }

      .pronunciation-column {
        padding: 20px;
      }

      .pronunciation-item-result {
        font-size: 20px;
      }
    }

    /* ── Animations ──────────────────────────────────────── */
    @keyframes tstFade    { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    @keyframes tstFadeIn  { from { opacity:0; } to { opacity:1; } }
    @keyframes tstSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes tstSpin    { to { transform:rotate(360deg); } }

    @media (max-width: 600px) {
      .tst-type-grid { grid-template-columns: repeat(2,1fr); }
      .tst-add-grid  { grid-template-columns: 1fr; }
      .tst-add-full  { grid-column: 1; }
    }
  `;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────
// Tab bar
// ─────────────────────────────────────────────────────────────

function renderTabs() {
  return `
    <div class="tst-tabs">
      <button class="tst-tab${_activeTab === "items"    ? " active" : ""}" onclick="TST.setTab('items')">
        📋 Item Bank
      </button>
      <button class="tst-tab${_activeTab === "sessions" ? " active" : ""}" onclick="TST.setTab('sessions')">
        🧪 Sessions
      </button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Item Bank panel
// ─────────────────────────────────────────────────────────────

function renderItemCard(item) {
  const preview = item.content.replace(/\n/g, " ").slice(0, 120);
  const typeInfo = SESSION_TYPES.find(t => t.id === item.item_type);
  return `
    <div class="tst-item-card">
      <div>
        <div class="tst-item-header">
          <span class="tst-item-id">#${item.id}</span>
          <span class="tst-chip tst-chip--blue">${item.item_type}</span>
          <span class="tst-chip tst-chip--gray">${item.target_cefr}</span>
        </div>
        <div class="tst-item-content">${preview}…</div>
      </div>
      <div class="tst-item-actions">
        <button class="tst-btn tst-btn--danger" onclick="TST.deleteItem(${item.id})">✕</button>
      </div>
    </div>`;
}

function renderItemsPanel() {
  const typeOpts = ["", ...ITEM_TYPES].map(t =>
    `<option value="${t}"${_filterType === t ? " selected" : ""}>${t || "All types"}</option>`
  ).join("");
  const cefrOpts = ["", ...CEFR_LEVELS].map(c =>
    `<option value="${c}"${_filterCefr === c ? " selected" : ""}>${c || "All levels"}</option>`
  ).join("");

  const listHTML = _items.length
    ? _items.map(renderItemCard).join("")
    : `<div class="tst-empty"><div class="tst-empty-icon">📋</div><p>No items found. Add one below or import a CSV.</p></div>`;

  return `
    <div id="tst-items-panel">
      <div class="tst-toolbar">
        <select class="tst-select" onchange="TST.setFilterType(this.value)">${typeOpts}</select>
        <select class="tst-select" onchange="TST.setFilterCefr(this.value)">${cefrOpts}</select>
        <button class="tst-btn tst-btn--ghost tst-btn--sm" onclick="TST.toggleAddForm()">+ Add Item</button>
        <button class="tst-btn tst-btn--ghost tst-btn--sm" onclick="TST.triggerCSV()">⬆ Import CSV</button>
        <input type="file" id="tst-csv-input" accept=".csv" style="display:none" onchange="TST.importCSV(this)">
        <span class="tst-count">${_items.length} item${_items.length !== 1 ? "s" : ""}</span>
      </div>

      <!-- Add item form -->
      <div class="tst-add-form" id="tst-add-form">
        <div class="tst-add-form-title">Add Item Manually</div>
        <div id="tst-add-msg" class="tst-add-msg"></div>
        <div class="tst-add-grid">
          <div class="tst-add-field">
            <label class="tst-add-label">Type <span style="color:#C0392B">*</span></label>
            <select id="tst-new-type" class="tst-add-select">
              ${ITEM_TYPES.map(t => `<option value="${t}">${t}</option>`).join("")}
            </select>
          </div>
          <div class="tst-add-field">
            <label class="tst-add-label">CEFR Level <span style="color:#C0392B">*</span></label>
            <select id="tst-new-cefr" class="tst-add-select">
              ${CEFR_LEVELS.map(l => `<option value="${l}">${l}</option>`).join("")}
            </select>
          </div>
          <div class="tst-add-field tst-add-full">
            <label class="tst-add-label">Content <span style="color:#C0392B">*</span></label>
            <textarea id="tst-new-content" class="tst-add-textarea"
              placeholder="Paste the item text, question, or prompt…" rows="4"></textarea>
          </div>
          <div class="tst-add-field">
            <label class="tst-add-label">Options (JSON array) <span style="color:#C0392B">*</span></label>
            <input id="tst-new-options" class="tst-add-input" type="text"
              placeholder='["A) ...", "B) ...", "C) ..."]' />
          </div>
          <div class="tst-add-field">
            <label class="tst-add-label">Correct Answer <span style="color:#C0392B">*</span></label>
            <input id="tst-new-answer" class="tst-add-input" type="text" placeholder="e.g. A" />
          </div>
          <div class="tst-add-field tst-add-full">
            <label class="tst-add-label">Vocab Targets (JSON array) <span style="color:#C0392B">*</span></label>
            <input id="tst-new-vocab" class="tst-add-input" type="text"
              placeholder='["present simple", "third person"]' />
          </div>
          <div class="tst-add-field tst-add-full">
            <label class="tst-add-label">Distractor Rationale (optional)</label>
            <input id="tst-new-rationale" class="tst-add-input" type="text"
              placeholder="Why are the wrong options plausible?" />
          </div>
        </div>
        <div class="tst-add-actions">
          <button class="tst-btn tst-btn--ghost tst-btn--sm" onclick="TST.toggleAddForm()">Cancel</button>
          <button id="tst-add-btn" class="tst-btn tst-btn--primary tst-btn--sm" onclick="TST.addItem()">Save Item</button>
        </div>
      </div>

      <div id="tst-csv-result"></div>
      <div class="tst-item-list">${listHTML}</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Sessions panel
// ─────────────────────────────────────────────────────────────

function sessionIcon(type) {
  return SESSION_TYPES.find(t => t.id === type)?.icon ?? "🧪";
}

function renderSessionCard(s) {
  const date = s.applied_at
    ? new Date(s.applied_at).toLocaleDateString("en-US", { year:"numeric", month:"short", day:"numeric" })
    : "—";
  return `
    <div class="tst-session-card">
      <div class="tst-session-icon">${sessionIcon(s.session_type)}</div>
      <div class="tst-session-type">${s.session_type}</div>
      <div class="tst-session-meta">#${s.id} · ${date}</div>
      ${s.notes ? `<div class="tst-session-notes">${s.notes}</div>` : ""}
    </div>`;
}

function renderSessionsPanel() {
  const studentOpts = _students.map(s =>
    `<option value="${s.id}"${s.id === _selectedStudent ? " selected" : ""}>${s.name}</option>`
  ).join("");

  const listHTML = !_selectedStudent
    ? `<div class="tst-empty"><div class="tst-empty-icon">👤</div><p>Select a student to view their sessions.</p></div>`
    : _sessions.length
      ? `<div class="tst-session-grid">${_sessions.map(renderSessionCard).join("")}</div>`
      : `<div class="tst-empty"><div class="tst-empty-icon">🧪</div><p>No sessions yet for this student.</p></div>`;

  return `
    <div id="tst-sessions-panel">
      <div class="tst-toolbar">
        <select class="tst-select" onchange="TST.selectStudent(this.value)">
          <option value="" disabled${!_selectedStudent ? " selected" : ""}>Select student…</option>
          ${studentOpts}
        </select>
        <button class="tst-btn tst-btn--primary tst-btn--sm" onclick="TST.openModal()">+ New Session</button>
        <span class="tst-count">${_sessions.length} session${_sessions.length !== 1 ? "s" : ""}</span>
      </div>
      ${listHTML}
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// New Session Modal
// ─────────────────────────────────────────────────────────────

function renderModal() {
  const studentOpts = _students.map(s =>
    `<option value="${s.id}"${s.id === _selectedStudent ? " selected" : ""}>${s.name}</option>`
  ).join("");

  const typeCards = SESSION_TYPES.map(t => `
    <div class="tst-type-opt" data-type="${t.id}" onclick="TST.selectSessionType('${t.id}')">
      <span class="tst-type-opt-icon">${t.icon}</span>
      <span class="tst-type-opt-label">${t.label}</span>
      <span class="tst-type-opt-desc">${t.desc}</span>
    </div>`).join("");

  return `
    <div class="tst-modal-overlay" id="tst-modal-overlay" onclick="TST.closeModalOnBg(event)">
      <div class="tst-modal">
        <div class="tst-modal-title">New Session</div>
        <div id="tst-modal-error" class="tst-modal-error"></div>

        <div class="tst-modal-field">
          <label class="tst-modal-label">Student <span style="color:#C0392B">*</span></label>
          <select id="tst-modal-student" class="tst-modal-select">
            <option value="" disabled${!_selectedStudent ? " selected" : ""}>Select student…</option>
            ${studentOpts}
          </select>
        </div>

        <div class="tst-modal-field">
          <label class="tst-modal-label">Session Type <span style="color:#C0392B">*</span></label>
          <div class="tst-type-grid">${typeCards}</div>
          <input type="hidden" id="tst-modal-type" value="">
        </div>

        <div class="tst-modal-field">
          <label class="tst-modal-label">Notes (optional)</label>
          <textarea id="tst-modal-notes" class="tst-modal-textarea"
            placeholder="Any relevant context for this session…" rows="2"></textarea>
        </div>

        <div class="tst-modal-actions">
          <button class="tst-btn tst-btn--ghost" onclick="TST.closeModal()">Cancel</button>
          <button id="tst-modal-save" class="tst-btn tst-btn--primary" onclick="TST.createSession()">Create Session</button>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Render pipeline
// ─────────────────────────────────────────────────────────────

function render() {
  if (!_container) return;
  let panel = _activeTab === "items" ? renderItemsPanel() : renderSessionsPanel();
  _container.innerHTML = `<div class="tst-root">${renderTabs()}${panel}</div>`;
  if (_modalOpen) document.body.insertAdjacentHTML("beforeend", renderModal());
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

window.TST = {

  async setTab(tab) {
    _activeTab = tab;
    render();
    if (tab === "items" && !_items.length) {
      document.getElementById("tst-items-panel").innerHTML =
        `<div class="tst-loading"><div class="tst-spinner"></div> Loading items…</div>`;
      await loadItems();
      render();
    } else if (tab === "sessions") {
      if (_selectedStudent) {
        document.getElementById("tst-sessions-panel").innerHTML =
          `<div class="tst-loading"><div class="tst-spinner"></div> Loading sessions…</div>`;
        await loadSessions();
        render();
      }
    }
  },

  async setFilterType(val) {
    _filterType = val;
    document.getElementById("tst-items-panel").innerHTML =
      `<div class="tst-loading"><div class="tst-spinner"></div> Filtering…</div>`;
    await loadItems();
    render();
  },

  async setFilterCefr(val) {
    _filterCefr = val;
    document.getElementById("tst-items-panel").innerHTML =
      `<div class="tst-loading"><div class="tst-spinner"></div> Filtering…</div>`;
    await loadItems();
    render();
  },

  toggleAddForm() {
    const form = document.getElementById("tst-add-form");
    if (!form) return;
    form.classList.toggle("open");
    if (form.classList.contains("open")) {
      setTimeout(() => form.querySelector("select")?.focus(), 100);
    }
  },

  async addItem() {
    const type     = document.getElementById("tst-new-type")?.value;
    const cefr     = document.getElementById("tst-new-cefr")?.value;
    const content  = document.getElementById("tst-new-content")?.value.trim();
    const optRaw   = document.getElementById("tst-new-options")?.value.trim();
    const answer   = document.getElementById("tst-new-answer")?.value.trim();
    const vocabRaw = document.getElementById("tst-new-vocab")?.value.trim();
    const rationale= document.getElementById("tst-new-rationale")?.value.trim();
    const msgEl    = document.getElementById("tst-add-msg");
    const btn      = document.getElementById("tst-add-btn");

    const showErr = (msg) => {
      msgEl.className = "tst-add-msg tst-add-msg--error";
      msgEl.textContent = msg;
    };

    if (!content) return showErr("Content is required.");
    if (!answer)  return showErr("Correct answer is required.");

    let options, vocabTargets;
    try { options = JSON.parse(optRaw); } catch { return showErr("Options must be a valid JSON array."); }
    try { vocabTargets = JSON.parse(vocabRaw); } catch { return showErr("Vocab Targets must be a valid JSON array."); }

    btn.disabled = true; btn.textContent = "Saving…";
    try {
      const item = await apiFetch("/testing/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: type, target_cefr: cefr, content, options, correct_answer: answer, vocab_targets: vocabTargets, distractor_rationale: rationale || undefined }),
      });
      _items.unshift(item);
      render();
    } catch (err) {
      showErr(`✕ ${err.message}`);
      btn.disabled = false; btn.textContent = "Save Item";
    }
  },

  async deleteItem(id) {
    if (!confirm(`Delete item #${id}?`)) return;
    try {
      await apiFetch(`/testing/items/${id}`, { method: "DELETE" });
      _items = _items.filter(i => i.id !== id);
      render();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  },

  triggerCSV() {
    document.getElementById("tst-csv-input")?.click();
  },

  async importCSV(input) {
    const file = input.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    input.value = "";

    const box = document.getElementById("tst-csv-result");
    if (box) box.innerHTML = `<div class="tst-loading"><div class="tst-spinner"></div> Importing…</div>`;

    try {
      const res  = await fetch(`${API_BASE}/testing/items/import-csv`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const errList = data.errors?.length
        ? `<details style="margin-top:8px;font-size:.75rem;color:var(--text-secondary)">
            <summary style="cursor:pointer">${data.errors.length} error(s)</summary>
            <ul style="margin:6px 0 0 16px">${data.errors.map(e => `<li>Row ${e.row}: ${e.reason}</li>`).join("")}</ul>
           </details>` : "";

      if (box) box.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;gap:24px;align-items:center">
          <span style="font-family:var(--font-display);font-size:1.5rem;color:#166534">${data.imported}</span>
          <span style="font-size:.75rem;color:var(--text-muted)">imported</span>
          ${data.errors?.length ? `<span style="font-family:var(--font-display);font-size:1.5rem;color:#B91C1C">${data.errors.length}</span><span style="font-size:.75rem;color:var(--text-muted)">errors</span>` : ""}
          ${errList}
        </div>`;

      if (data.imported > 0) { await loadItems(); render(); }
    } catch (err) {
      if (box) box.innerHTML = `<div class="tst-add-msg tst-add-msg--error" style="display:block;margin-bottom:12px">✕ ${err.message}</div>`;
    }
  },

  // ── Sessions ──────────────────────────────────────────────

  async selectStudent(val) {
    _selectedStudent = val ? parseInt(val) : null;
    render();
    if (_selectedStudent) {
      await loadSessions();
      render();
    }
  },

  openModal() {
    _modalOpen = true;
    render();
  },

  closeModal() {
    _modalOpen = false;
    document.getElementById("tst-modal-overlay")?.remove();
  },

  closeModalOnBg(e) {
    if (e.target.id === "tst-modal-overlay") TST.closeModal();
  },

  selectSessionType(type) {
    document.querySelectorAll(".tst-type-opt").forEach(el => {
      el.classList.toggle("selected", el.dataset.type === type);
    });
    const input = document.getElementById("tst-modal-type");
    if (input) input.value = type;
  },

  async createSession() {
    const studentId = document.getElementById("tst-modal-student")?.value;
    const type      = document.getElementById("tst-modal-type")?.value;
    const notes     = document.getElementById("tst-modal-notes")?.value.trim();
    const errEl     = document.getElementById("tst-modal-error");
    const btn       = document.getElementById("tst-modal-save");

    const showErr = (msg) => { errEl.style.display = "block"; errEl.textContent = msg; };

    if (!studentId) return showErr("Please select a student.");
    if (!type)      return showErr("Please select a session type.");

    btn.disabled = true; btn.textContent = "Creating…";
    errEl.style.display = "none";

    try {
      const session = await apiFetch("/testing/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: parseInt(studentId), session_type: type, notes: notes || undefined }),
      });

      // Update state and re-render
      _selectedStudent = parseInt(studentId);
      _modalOpen = false;
      document.getElementById("tst-modal-overlay")?.remove();

      if (_activeTab === "sessions") {
        await loadSessions();
        render();
      } else {
        _activeTab = "sessions";
        await loadSessions();
        render();
      }
    } catch (err) {
      showErr(`✕ ${err.message}`);
      btn.disabled = false; btn.textContent = "Create Session";
    }
  },

  showPronunciationSession(sessionId, items) {
    showPronunciationSession(sessionId, items);
  },

  handleChecklistResponse(index, response) {
    const state = window._checklistState;
    const item = state.recommended[index];
    
    state.responses.push({
      item_id: item.id,
      response: response,
      timestamp: Date.now()
    });
    
    state.currentIndex++;
    
    // Avançar automaticamente após 300ms
    setTimeout(() => {
      showChecklistNextItem();
    }, 300);
  },

  async submitChecklistResults(sessionId) {
    try {
      const state = window._checklistState;
      const results = {
        session_id: sessionId,
        responses: state.responses,
        duration: Date.now() - state.startTime
      };

      await apiFetch('/testing/checklist/results', {
        method: 'POST',
        body: JSON.stringify(results)
      });

      alert("Resultados enviados com sucesso!");
      render(); // Voltar para a tela inicial

    } catch (error) {
      alert(`Erro ao enviar resultados: ${error.message}`);
    }
  },

  handlePronunciationResponse(index, correct) {
    const state = window._pronunciationState;
    const item = state.items[index];
    
    state.responses.push({
      item_id: item.id,
      correct: correct,
      timestamp: Date.now()
    });
    
    state.currentIndex++;
    
    // Avançar automaticamente após 300ms
    setTimeout(() => {
      showPronunciationNextItem();
    }, 300);
  },

  async submitPronunciationResults(sessionId) {
    try {
      const state = window._pronunciationState;
      const results = {
        session_id: sessionId,
        responses: state.responses,
        duration: Date.now() - state.startTime
      };

      await apiFetch('/testing/pronunciation/results', {
        method: 'POST',
        body: JSON.stringify(results)
      });

      alert("Resultados enviados com sucesso!");
      render(); // Voltar para a tela inicial

    } catch (error) {
      alert(`Erro ao enviar resultados: ${error.message}`);
    }
  },

// ─────────────────────────────────────────────────────────────
// Module entry point
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Checklist Session
// ─────────────────────────────────────────────────────────────

async function showChecklistSession(sessionId, studentId) {
  try {
    // 1. Buscar itens recomendados
    const recommended = await apiFetch(`/testing/checklist/recommended/${studentId}`);
    if (!recommended.length) {
      alert("Nenhum item recomendado encontrado para este aluno.");
      return;
    }

    // Estado da sessão
    window._checklistState = {
      recommended,
      responses: [],
      startTime: Date.now(),
      currentIndex: 0,
      sessionId
    };

    // Iniciar primeira pergunta
    showChecklistNextItem();

  } catch (error) {
    alert(`Erro ao carregar checklist: ${error.message}`);
    render();
  }
}

function showChecklistNextItem() {
  const { recommended, currentIndex } = window._checklistState;
  
  if (currentIndex >= recommended.length) {
    showChecklistSummary();
    return;
  }

  const item = recommended[currentIndex];
  _container.innerHTML = `
    <div class="checklist-session">
      <div class="checklist-progress">
        <div class="checklist-progress-bar" style="width: ${(currentIndex / recommended.length) * 100}%"></div>
        <span class="checklist-counter">${currentIndex + 1} / ${recommended.length}</span>
      </div>

      <div class="checklist-item">
        <div class="checklist-item-text">${item.item_text}</div>
        <div class="checklist-item-meta">
          <span class="checklist-category">${item.category}</span>
          <span class="checklist-dimension">${item.dimension}</span>
        </div>
      </div>

      <div class="checklist-buttons">
        <button class="checklist-btn checklist-btn--no" onclick="TST.handleChecklistResponse(${currentIndex}, false)">
          ❌ Não
        </button>
        <button class="checklist-btn checklist-btn--yes" onclick="TST.handleChecklistResponse(${currentIndex}, true)">
          ✅ Sim
        </button>
      </div>
    </div>
  `;
}

function showChecklistSummary() {
  const { responses, recommended, sessionId } = window._checklistState;
  
  // Calcular estatísticas por dimensão
  const stats = {};
  responses.forEach(resp => {
    const item = recommended.find(r => r.id === resp.item_id);
    if (!stats[item.dimension]) {
      stats[item.dimension] = { total: 0, yes: 0 };
    }
    stats[item.dimension].total++;
    if (resp.response) stats[item.dimension].yes++;
  });

  const summaryHTML = Object.entries(stats).map(([dimension, data]) => {
    const percentage = Math.round((data.yes / data.total) * 100);
    return `
      <div class="checklist-summary-item">
        <div class="checklist-summary-dimension">${dimension}</div>
        <div class="checklist-summary-stats">
          <span class="checklist-summary-percentage">${percentage}%</span>
          <span class="checklist-summary-count">(${data.yes}/${data.total})</span>
        </div>
      </div>
    `;
  }).join('');

  _container.innerHTML = `
    <div class="checklist-session">
      <div class="checklist-summary">
        <h2>Resumo da Sessão</h2>
        <div class="checklist-summary-grid">
          ${summaryHTML}
        </div>
        <div class="checklist-actions">
          <button class="checklist-btn checklist-btn--primary" onclick="TST.submitChecklistResults(${sessionId})">
            Enviar Resultados
          </button>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// Pronunciation Session
// ─────────────────────────────────────────────────────────────

function showPronunciationSession(sessionId, items) {
  if (!items || !items.length) {
    alert("Nenhum item de pronúncia fornecido.");
    return;
  }

  // Estado da sessão
  window._pronunciationState = {
    items,
    responses: [],
    startTime: Date.now(),
    currentIndex: 0,
    sessionId
  };

  // Adicionar event listeners para atalhos de teclado
  document.addEventListener('keydown', handlePronunciationKeydown);

  // Iniciar primeiro item
  showPronunciationNextItem();
}

function showPronunciationNextItem() {
  const { items, currentIndex } = window._pronunciationState;
  
  if (currentIndex >= items.length) {
    showPronunciationSummary();
    return;
  }

  const item = items[currentIndex];
  document.body.innerHTML = `
    <div class="pronunciation-session">
      <div class="pronunciation-item">${item.item_text}</div>
      <div class="pronunciation-buttons">
        <button class="pronunciation-btn pronunciation-btn--correct" onclick="TST.handlePronunciationResponse(${currentIndex}, true)">
          Correta
        </button>
        <button class="pronunciation-btn pronunciation-btn--incorrect" onclick="TST.handlePronunciationResponse(${currentIndex}, false)">
          Incorreta
        </button>
      </div>
    </div>
  `;
}

function showPronunciationSummary() {
  const { responses, items, sessionId } = window._pronunciationState;
  
  // Separar itens corretos e incorretos
  const correctItems = responses
    .filter(r => r.correct)
    .map(r => items.find(i => i.id === r.item_id));
    
  const incorrectItems = responses
    .filter(r => !r.correct)
    .map(r => items.find(i => i.id === r.item_id));

  // Remover event listener de teclado
  document.removeEventListener('keydown', handlePronunciationKeydown);

  document.body.innerHTML = `
    <div class="pronunciation-summary">
      <h2>Resumo da Sessão de Pronúncia</h2>
      <div class="pronunciation-results">
        <div class="pronunciation-column pronunciation-column--correct">
          <h3>Corretas (${correctItems.length})</h3>
          <div class="pronunciation-items-list">
            ${correctItems.map(item => `<div class="pronunciation-item-result">${item.item_text}</div>`).join('')}
          </div>
        </div>
        <div class="pronunciation-column pronunciation-column--incorrect">
          <h3>Incorretas (${incorrectItems.length})</h3>
          <div class="pronunciation-items-list">
            ${incorrectItems.map(item => `<div class="pronunciation-item-result">${item.item_text}</div>`).join('')}
          </div>
        </div>
      </div>
      <div class="pronunciation-actions">
        <button class="pronunciation-btn--primary" onclick="TST.submitPronunciationResults(${sessionId})">
          Enviar Resultados
        </button>
      </div>
    </div>
  `;
}

function handlePronunciationKeydown(event) {
  if (!window._pronunciationState) return;
  
  const { currentIndex } = window._pronunciationState;
  
  if (event.key.toLowerCase() === 'c') {
    event.preventDefault();
    TST.handlePronunciationResponse(currentIndex, true);
  } else if (event.key.toLowerCase() === 'e') {
    event.preventDefault();
    TST.handlePronunciationResponse(currentIndex, false);
  }
}

export default async function init(container, actionsBar) {
  _container       = container;
  _activeTab       = "items";
  _items           = [];
  _sessions        = [];
  _selectedStudent = null;
  _filterType      = "";
  _filterCefr      = "";
  _modalOpen       = false;

  injectStyles();
  container.innerHTML = `<div class="tst-loading"><div class="tst-spinner"></div> Loading…</div>`;

  await Promise.all([loadStudents(), loadItems()]);
  render();
}
