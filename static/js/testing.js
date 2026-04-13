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
let _readingState   = null;  // state for active reading MCQ session
let _speakingState  = null;  // state for active speaking checklist session
let _listeningErrors = [];   // errors collected for listening breakdown
let _sessionResults = {};    // { Reading: {...}, speaking: {...} }
let _actionsBar     = null;  // header actions bar element
let _testStartTime  = null;  // Date when first result was recorded this session

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

    /* ── Suggest-level chip ──────────────────────────────── */
    .tst-suggest-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
    .tst-suggest-btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 11px;
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 7px;
      font-size: 0.75rem; font-weight: 500;
      background: var(--bg, #F7F5F0);
      color: var(--text-secondary, #6B6560);
      cursor: pointer;
      transition: border-color 140ms, background 140ms;
      white-space: nowrap;
    }
    .tst-suggest-btn:hover { border-color: #001365; color: #001365; background: #eef1f9; }
    .tst-suggest-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .tst-level-chip {
      display: inline-flex; align-items: center;
      padding: 3px 10px;
      border-radius: 100px;
      font-family: var(--font-mono, monospace);
      font-size: 0.72rem; font-weight: 600;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: opacity 140ms, transform 140ms;
      user-select: none;
    }
    .tst-level-chip:hover { opacity: 0.85; transform: scale(1.04); }
    .tst-level-chip--found { background: #001365; color: #fff; }
    .tst-level-chip--short { background: #FEF2F2; color: #BF0D3E; border: 1px solid #FECACA; cursor: default; }
    .tst-level-chip--short:hover { opacity: 1; transform: none; }

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

    /* ── Reading MCQ Session ─────────────────────────────── */
    .reading-panel { display: flex; flex-direction: column; gap: 16px; }
    .reading-panel-header {
      font-family: var(--font-display, serif);
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text-primary, #1A1714);
    }
    .reading-start-card {
      background: var(--surface, #fff);
      border: 1px solid var(--border, #E2DDD6);
      border-radius: 14px;
      padding: 24px 28px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .reading-result-banner {
      background: var(--surface, #fff);
      border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 14px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .reading-result-score {
      font-family: var(--font-display, serif);
      font-size: 2.5rem;
      color: var(--accent, #2D5BE3);
      line-height: 1;
    }
    .reading-result-detail { display: flex; flex-direction: column; gap: 4px; }
    .reading-result-title { font-size: 0.875rem; font-weight: 600; color: var(--text-primary, #1A1714); }
    .reading-result-sub {
      font-size: 0.78rem;
      color: var(--text-muted, #A09890);
      font-family: var(--font-mono, monospace);
    }
    .reading-session { max-width: 720px; }
    .reading-progress { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
    .reading-progress-bar {
      flex: 1; height: 6px;
      background: var(--border, #E2DDD6);
      border-radius: 3px; overflow: hidden;
    }
    .reading-progress-fill {
      height: 100%;
      background: var(--accent, #2D5BE3);
      transition: width 0.3s ease;
    }
    .reading-progress-label {
      font-family: var(--font-mono, monospace);
      font-size: 0.7rem;
      color: var(--text-muted, #A09890);
      white-space: nowrap;
    }
    .reading-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
    .reading-base-text {
      background: var(--bg, #F7F5F0);
      border: 1px solid var(--border, #E2DDD6);
      border-radius: 10px;
      padding: 16px 20px;
      font-size: 0.875rem;
      line-height: 1.75;
      color: var(--text-primary, #1A1714);
      margin-bottom: 18px;
      white-space: pre-wrap;
      max-height: 240px;
      overflow-y: auto;
    }
    .reading-question {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary, #1A1714);
      margin-bottom: 16px;
      line-height: 1.4;
    }
    .reading-options { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
    .reading-option-btn {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 18px;
      border: 2px solid var(--border, #E2DDD6);
      border-radius: 10px;
      background: var(--surface, #fff);
      cursor: pointer;
      text-align: left;
      font-size: 0.875rem;
      font-family: var(--font-body, sans-serif);
      color: var(--text-primary, #1A1714);
      transition: border-color 140ms, background 140ms;
      line-height: 1.4;
      width: 100%;
    }
    .reading-option-btn:hover:not(:disabled) {
      border-color: var(--accent, #2D5BE3);
      background: var(--accent-light, #EEF2FD);
    }
    .reading-option-btn:disabled { cursor: default; }
    .reading-option-btn.correct { border-color: #10B981; background: #F0FDF4; }
    .reading-option-btn.wrong   { border-color: #EF4444; background: #FEF2F2; }
    .reading-option-letter {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--bg, #F7F5F0);
      border: 1.5px solid var(--border, #E2DDD6);
      font-family: var(--font-mono, monospace);
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-secondary, #6B6560);
      flex-shrink: 0;
    }
    .reading-option-btn.correct .reading-option-letter { background: #10B981; border-color: #10B981; color: #fff; }
    .reading-option-btn.wrong   .reading-option-letter { background: #EF4444; border-color: #EF4444; color: #fff; }
    .reading-summary { text-align: center; padding: 32px 0; }
    .reading-summary-score {
      font-family: var(--font-display, serif);
      font-size: 4rem;
      color: var(--accent, #2D5BE3);
      line-height: 1;
      margin-bottom: 8px;
    }
    .reading-summary-label { font-size: 1.1rem; color: var(--text-secondary, #6B6560); margin-bottom: 12px; }

    /* ── Speaking Checklist ──────────────────────────────── */
    .spk-panel { display: flex; flex-direction: column; gap: 16px; }
    .spk-panel-header {
      font-family: var(--font-display, serif);
      font-size: 1.05rem; font-weight: 600; color: var(--text-primary, #1A1714);
    }
    .spk-start-card {
      background: var(--surface, #fff); border: 1px solid var(--border, #E2DDD6);
      border-radius: 14px; padding: 24px 28px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .spk-result-banner {
      background: var(--surface, #fff); border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 14px; padding: 20px 24px;
      display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap;
    }
    .spk-checklist-header {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;
    }
    .spk-checklist-title {
      font-family: var(--font-display, serif); font-size: 1.05rem;
      color: var(--text-primary, #1A1714);
    }
    .spk-meta-label {
      font-family: var(--font-mono, monospace); font-size: 0.7rem;
      color: var(--text-muted, #A09890);
    }
    .spk-toggle-all {
      margin-left: auto; font-size: 0.75rem; font-family: var(--font-body, sans-serif);
      text-decoration: underline; color: var(--accent, #2D5BE3);
      cursor: pointer; border: none; background: none; padding: 0;
    }
    .spk-dim-section { margin-bottom: 20px; }
    .spk-dim-header {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 0; border-bottom: 1px solid var(--border, #E2DDD6); margin-bottom: 8px;
    }
    .spk-dim-name {
      font-family: var(--font-mono, monospace); font-size: 0.72rem;
      font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
      color: var(--text-secondary, #6B6560);
    }
    .spk-optional-tag {
      font-size: 0.6rem; font-family: var(--font-mono, monospace);
      text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--text-muted, #A09890); padding: 2px 6px;
      border: 1px dashed var(--border, #E2DDD6); border-radius: 4px;
    }
    .spk-dim-badge {
      display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 100px;
      font-family: var(--font-mono, monospace); font-size: 0.62rem; font-weight: 600;
      letter-spacing: 0.03em;
      background: var(--bg, #F7F5F0); color: var(--text-muted, #A09890);
      border: 1px solid var(--border, #E2DDD6); transition: background 200ms, color 200ms;
    }
    .spk-dim-badge--good { background: #F0FDF4; color: #166534; border-color: #86EFAC; }
    .spk-dim-badge--warn { background: #FEF9C3; color: #854D0E; border-color: #FDE047; }
    .spk-dim-badge--bad  { background: #FEF2F2; color: #991B1B; border-color: #FCA5A5; }
    .spk-dim-items { display: flex; flex-direction: column; gap: 5px; }
    .spk-item-row {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 9px 13px; border-radius: 8px;
      background: var(--surface, #fff); border: 1px solid var(--border, #E2DDD6);
      transition: background 120ms, border-color 120ms;
    }
    .spk-item-row.answered-yes { background: #F0FDF4; border-color: #86EFAC; }
    .spk-item-row.answered-no  { background: #FEF2F2; border-color: #FCA5A5; }
    .spk-item-id {
      font-family: var(--font-mono, monospace); font-size: 0.58rem;
      color: var(--text-muted, #A09890); min-width: 46px; padding-top: 2px;
    }
    .spk-item-text { flex: 1; font-size: 0.8125rem; line-height: 1.45; color: var(--text-primary, #1A1714); }
    .spk-item-btns { display: flex; gap: 5px; flex-shrink: 0; }
    .spk-yes-btn, .spk-no-btn {
      padding: 4px 11px; border-radius: 7px; font-size: 0.72rem;
      font-weight: 600; border: 1.5px solid; cursor: pointer; transition: all 120ms;
    }
    .spk-yes-btn { color: #166534; background: #F0FDF4; border-color: #86EFAC; }
    .spk-yes-btn:hover, .spk-yes-btn.active { background: #10B981; color: #fff; border-color: #10B981; }
    .spk-no-btn  { color: #991B1B; background: #FEF2F2; border-color: #FCA5A5; }
    .spk-no-btn:hover, .spk-no-btn.active  { background: #EF4444; color: #fff; border-color: #EF4444; }
    .spk-footer {
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
      padding-top: 16px; border-top: 1px solid var(--border, #E2DDD6); margin-top: 4px;
    }
    .spk-footer-progress { font-size: 0.8rem; color: var(--text-secondary, #6B6560); }
    .spk-summary-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px; margin-bottom: 24px;
    }
    .spk-summary-card {
      background: var(--bg, #F7F5F0); border: 1px solid var(--border, #E2DDD6);
      border-radius: 10px; padding: 14px 18px;
    }
    .spk-summary-dim { font-size: 0.8rem; font-weight: 600; color: var(--text-primary, #1A1714); margin-bottom: 6px; }
    .spk-summary-pct { font-family: var(--font-display, serif); font-size: 2rem; line-height: 1; }
    .spk-summary-pct--good { color: #10B981; }
    .spk-summary-pct--mid  { color: #F59E0B; }
    .spk-summary-pct--low  { color: #EF4444; }
    .spk-summary-count { font-size: 0.72rem; color: var(--text-muted, #A09890); font-family: var(--font-mono, monospace); }

    /* ── Listening Breakdown ─────────────────────────────── */
    .lst-panel { display: flex; flex-direction: column; gap: 16px; }
    .lst-panel-header {
      font-family: var(--font-display, serif);
      font-size: 1.05rem; font-weight: 600; color: var(--text-primary, #1A1714);
    }
    .lst-form-card {
      background: var(--surface, #fff); border: 1px solid var(--border, #E2DDD6);
      border-radius: 14px; padding: 20px 24px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .lst-form-row { display: flex; flex-direction: column; gap: 4px; }
    .lst-form-label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary, #6B6560); }
    .lst-input, .lst-select {
      padding: 8px 11px; border-radius: 8px; font-size: 0.83rem;
      border: 1px solid var(--border, #E2DDD6); background: var(--bg, #F7F5F0);
      color: var(--text-primary, #1A1714); font-family: inherit;
    }
    .lst-input:focus, .lst-select:focus { outline: 2px solid var(--accent, #2D5BE3); border-color: transparent; }
    .lst-add-btn {
      align-self: flex-start; padding: 8px 18px; border-radius: 8px;
      background: var(--accent, #2D5BE3); color: #fff; border: none;
      font-size: 0.83rem; font-weight: 600; cursor: pointer; transition: opacity 150ms;
    }
    .lst-add-btn:hover { opacity: 0.88; }
    .lst-list { display: flex; flex-direction: column; gap: 8px; }
    .lst-error-row {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 10px 14px; border-radius: 10px;
      background: var(--surface, #fff); border: 1px solid var(--border, #E2DDD6);
    }
    .lst-error-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .lst-error-phrase { font-size: 0.85rem; font-weight: 600; color: var(--text-primary, #1A1714); }
    .lst-error-meta { font-size: 0.72rem; color: var(--text-muted, #A09890); font-family: var(--font-mono, monospace); }
    .lst-remove-btn {
      background: none; border: none; cursor: pointer; font-size: 0.9rem;
      color: var(--text-muted, #A09890); padding: 2px 4px; border-radius: 4px;
      transition: color 120ms;
    }
    .lst-remove-btn:hover { color: #EF4444; }
    .lst-footer {
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
      padding-top: 16px; border-top: 1px solid var(--border, #E2DDD6);
    }
    .lst-result-banner {
      background: var(--surface, #fff); border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 14px; padding: 20px 24px;
      display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
    }

    /* ── Test Summary ────────────────────────────────────── */
    .sum-panel { display: flex; flex-direction: column; gap: 20px; max-width: 780px; margin: 0 auto; }
    .sum-header { text-align: center; padding: 8px 0 4px; }
    .sum-title {
      font-family: var(--font-display, serif); font-size: 1.35rem;
      color: var(--text-primary, #1A1714); margin-bottom: 6px;
    }
    .sum-meta { font-size: 0.75rem; color: var(--text-muted, #A09890); font-family: var(--font-mono, monospace); }
    .sum-skills-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
    }
    @media (max-width: 600px) { .sum-skills-grid { grid-template-columns: repeat(2, 1fr); } }
    .sum-skill-card {
      background: var(--surface, #fff); border: 1px solid var(--border, #E2DDD6);
      border-radius: 12px; padding: 16px 14px; text-align: center;
      display: flex; flex-direction: column; gap: 6px;
    }
    .sum-skill-label {
      font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--text-muted, #A09890);
      font-family: var(--font-mono, monospace);
    }
    .sum-skill-level {
      font-family: var(--font-display, serif); font-size: 1.8rem; line-height: 1;
      color: var(--accent, #2D5BE3);
    }
    .sum-skill-level--na { color: var(--text-muted, #A09890); font-size: 1.4rem; }
    .sum-skill-detail { font-size: 0.7rem; color: var(--text-secondary, #6B6560); font-family: var(--font-mono, monospace); }
    .sum-gaps-card {
      background: var(--surface, #fff); border: 1px solid var(--border, #E2DDD6);
      border-radius: 12px; padding: 20px 24px;
    }
    .sum-gaps-title {
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--text-muted, #A09890);
      font-family: var(--font-mono, monospace); margin-bottom: 14px;
    }
    .sum-gaps-list { display: flex; flex-direction: column; gap: 10px; }
    .sum-gap-row {
      display: flex; align-items: center; gap: 14px;
      padding: 10px 14px; border-radius: 8px;
      background: var(--bg, #F7F5F0); border: 1px solid var(--border, #E2DDD6);
    }
    .sum-gap-rank {
      min-width: 24px; height: 24px; border-radius: 50%;
      background: var(--accent, #2D5BE3); color: #fff;
      font-size: 0.7rem; font-weight: 700; font-family: var(--font-mono, monospace);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sum-gap-rank--2 { background: #6B7280; }
    .sum-gap-rank--3 { background: #9CA3AF; }
    .sum-gap-skill { font-size: 0.85rem; font-weight: 600; color: var(--text-primary, #1A1714); }
    .sum-gap-detail { font-size: 0.72rem; color: var(--text-muted, #A09890); font-family: var(--font-mono, monospace); }
    .sum-gap-source {
      margin-left: auto; font-size: 0.6rem; font-family: var(--font-mono, monospace);
      text-transform: uppercase; letter-spacing: 0.07em;
      padding: 2px 7px; border-radius: 100px;
      background: var(--border, #E2DDD6); color: var(--text-secondary, #6B6560);
    }
    .sum-no-gaps { font-size: 0.83rem; color: var(--text-muted, #A09890); font-style: italic; }
    .sum-actions {
      display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
      padding-top: 8px;
    }
    .sum-save-btn-area { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .sum-saving-note { font-size: 0.72rem; color: var(--text-muted, #A09890); font-family: var(--font-mono, monospace); }

    /* ── Writing Sample ──────────────────────────────────── */
    .wrt-panel { display: flex; flex-direction: column; gap: 16px; }
    .wrt-panel-header {
      font-family: var(--font-display, serif);
      font-size: 1.05rem; font-weight: 600; color: var(--text-primary, #1A1714);
    }
    .wrt-form-card {
      background: var(--surface, #fff); border: 1px solid var(--border, #E2DDD6);
      border-radius: 14px; padding: 20px 24px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .wrt-form-label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary, #6B6560); }
    .wrt-textarea {
      width: 100%; min-height: 120px; padding: 10px 12px;
      border-radius: 8px; font-size: 0.83rem; line-height: 1.5;
      border: 1px solid var(--border, #E2DDD6); background: var(--bg, #F7F5F0);
      color: var(--text-primary, #1A1714); font-family: inherit; resize: vertical; box-sizing: border-box;
    }
    .wrt-textarea:focus { outline: 2px solid var(--accent, #2D5BE3); border-color: transparent; }
    .wrt-flags { display: flex; flex-direction: column; gap: 8px; }
    .wrt-flag-item { display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .wrt-flag-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent, #2D5BE3); cursor: pointer; }
    .wrt-flag-label { font-size: 0.83rem; color: var(--text-primary, #1A1714); }
    .wrt-result-banner {
      background: var(--surface, #fff); border: 1.5px solid var(--border, #E2DDD6);
      border-radius: 14px; padding: 20px 24px;
      display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
    }
  `;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────
// Actions bar
// ─────────────────────────────────────────────────────────────

function _updateActionsBar() {
  if (!_actionsBar) return;
  const hasResult = Object.keys(_sessionResults).length > 0;
  if (_selectedStudent && hasResult) {
    const student = _students.find(s => s.id === _selectedStudent);
    const name = student ? student.name.split(" ")[0] : "aluno";
    _actionsBar.innerHTML = `
      <button class="tst-btn tst-btn--primary tst-btn--sm"
        style="font-size:0.8rem;padding:7px 16px"
        onclick="TST.showTestSummary()">
        📊 Finalizar Teste · ${name}
      </button>`;
  } else {
    _actionsBar.innerHTML = "";
  }
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
      <button class="tst-tab${_activeTab === "reading"  ? " active" : ""}" onclick="TST.setTab('reading')">
        📖 Reading
      </button>
      <button class="tst-tab${_activeTab === "speaking"  ? " active" : ""}" onclick="TST.setTab('speaking')">
        🗣 Speaking
      </button>
      <button class="tst-tab${_activeTab === "listening" ? " active" : ""}" onclick="TST.setTab('listening')">
        🎧 Listening
      </button>
      <button class="tst-tab${_activeTab === "writing"   ? " active" : ""}" onclick="TST.setTab('writing')">
        ✍️ Writing
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
            <div class="tst-suggest-row">
              <button type="button" class="tst-suggest-btn" id="tst-suggest-btn"
                onclick="TST.suggestLevel()">&#10024; Sugerir n&#237;vel</button>
              <span id="tst-level-chip"></span>
            </div>
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
  let panel;
  if      (_activeTab === "items")    panel = renderItemsPanel();
  else if (_activeTab === "sessions") panel = renderSessionsPanel();
  else if (_activeTab === "reading")   panel = renderReadingPanel();
  else if (_activeTab === "speaking")  panel = renderSpeakingPanel();
  else if (_activeTab === "listening") panel = renderListeningPanel();
  else if (_activeTab === "writing")   panel = renderWritingPanel();
  else                                 panel = renderItemsPanel();
  _container.innerHTML = `<div class="tst-root">${renderTabs()}${panel}</div>`;
  if (_modalOpen) document.body.insertAdjacentHTML("beforeend", renderModal());
  // Resume in-progress sessions when tab is re-entered
  if (_activeTab === "reading"  && _readingState)  showReadingItem();
  if (_activeTab === "speaking" && _speakingState) showSpeakingChecklist();
  _updateActionsBar();
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

window.TST = {

  async setTab(tab) {
    _activeTab = tab;
    // Reading test is discarded when leaving the tab; speaking checklist is preserved
    if (tab !== "reading")   _readingState = null;
    if (tab !== "listening") _listeningErrors = [];
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
    // "reading" tab needs no pre-loading — panel renders from state
  },

  selectStudentForReading(val) {
    _selectedStudent = val ? parseInt(val) : null;
    delete _sessionResults.Reading;
    _readingState = null;
    render();
  },

  async startReadingTest() {
    await startReadingSession();
  },

  async answerReadingMCQ(letter) {
    await recordReadingAnswer(letter);
  },

  selectStudentForSpeaking(val) {
    _selectedStudent = val ? parseInt(val) : null;
    delete _sessionResults.speaking;
    _speakingState = null;
    render();
  },

  async startSpeakingTest() {
    await startSpeakingSession();
  },

  toggleSpeakingItem(checkId, value) {
    handleSpeakingToggle(checkId, value);
  },

  toggleSpeakingShowAll() {
    handleSpeakingShowAll();
  },

  async submitSpeakingSession() {
    await finalizeSpeakingSession();
  },

  selectStudentForListening(val) {
    _selectedStudent = val ? parseInt(val) : null;
    _listeningErrors = [];
    delete _sessionResults.listening;
    render();
  },

  addListeningError() {
    const phrase    = document.getElementById("lst-phrase")?.value.trim();
    const understood = document.getElementById("lst-understood")?.value.trim();
    const cause     = document.getElementById("lst-cause")?.value;
    if (!phrase) return;
    _listeningErrors.push({ phrase, understood, cause });
    _renderListeningList();
    document.getElementById("lst-phrase").value      = "";
    document.getElementById("lst-understood").value  = "";
    document.getElementById("lst-cause").value       = "fala rápida";
  },

  removeListeningError(idx) {
    _listeningErrors.splice(idx, 1);
    _renderListeningList();
  },

  async submitListeningErrors() {
    await finalizeListeningErrors();
  },

  selectStudentForWriting(val) {
    _selectedStudent = val ? parseInt(val) : null;
    delete _sessionResults.writing;
    render();
  },

  async submitWritingSample() {
    await finalizeWritingSample();
  },

  showTestSummary() {
    renderTestSummaryPanel();
  },

  async saveAndCloseTest() {
    await _saveTestAndNavigate();
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

  async suggestLevel() {
    const content = document.getElementById("tst-new-content")?.value.trim();
    const btn     = document.getElementById("tst-suggest-btn");
    const chipEl  = document.getElementById("tst-level-chip");
    if (!btn || !chipEl) return;

    if (!content) {
      chipEl.className = "tst-level-chip tst-level-chip--short";
      chipEl.textContent = "Digite o conteúdo primeiro";
      chipEl.onclick = null;
      return;
    }

    btn.disabled = true;
    btn.textContent = "…";
    chipEl.textContent = "";

    try {
      const res = await apiFetch("/testing/classify-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });

      if (res.predicted_level) {
        const pct = Math.round(res.confidence * 100);
        chipEl.className = "tst-level-chip tst-level-chip--found";
        chipEl.textContent = `Nível sugerido: ${res.predicted_level} (${pct}% confiança)`;
        chipEl.title = "Clique para aplicar";
        chipEl.onclick = () => {
          const sel = document.getElementById("tst-new-cefr");
          if (sel) sel.value = res.predicted_level;
          chipEl.style.outline = "2px solid #001365";
          setTimeout(() => { chipEl.style.outline = ""; }, 800);
        };
      } else {
        chipEl.className = "tst-level-chip tst-level-chip--short";
        chipEl.textContent = "Texto muito curto para classificar";
        chipEl.onclick = null;
      }
    } catch (err) {
      chipEl.className = "tst-level-chip tst-level-chip--short";
      chipEl.textContent = `Erro: ${err.message}`;
      chipEl.onclick = null;
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ Sugerir nível";
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

};

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

// ─────────────────────────────────────────────────────────────
// Reading MCQ Session
// ─────────────────────────────────────────────────────────────

function renderReadingPanel() {
  // Placeholder — render() will immediately overwrite with showReadingItem() if test active
  if (_readingState) {
    return `<div id="tst-reading-panel" class="reading-panel"></div>`;
  }

  const studentOpts = _students.map(s =>
    `<option value="${s.id}"${s.id === _selectedStudent ? " selected" : ""}>${s.name}</option>`
  ).join("");

  const r = _sessionResults.Reading;

  return `
    <div id="tst-reading-panel" class="reading-panel">
      <div class="tst-toolbar">
        <select class="tst-select" onchange="TST.selectStudentForReading(this.value)">
          <option value="" disabled${!_selectedStudent ? " selected" : ""}>Select student…</option>
          ${studentOpts}
        </select>
      </div>
      ${r ? `
        <div class="reading-result-banner">
          <div class="reading-result-score">${r.correct}/${r.total}</div>
          <div class="reading-result-detail">
            <div class="reading-result-title">Reading MCQ</div>
            <div class="reading-result-sub">${r.pct}% acertos · Level ${r.level || "—"}</div>
          </div>
          <button class="tst-btn tst-btn--primary tst-btn--sm" style="margin-left:auto"
            onclick="TST.startReadingTest()">📖 New Test</button>
        </div>
      ` : _selectedStudent ? `
        <div class="reading-start-card">
          <div class="reading-panel-header">Reading MCQ Adaptive Test</div>
          <p style="font-size:0.875rem;color:var(--text-secondary,#6B6560);margin:0">
            Items are selected based on the student's estimated CEFR level.
            Click the option the student gives as their answer.
          </p>
          <div>
            <button class="tst-btn tst-btn--primary" onclick="TST.startReadingTest()">
              📖 Start Reading Test
            </button>
          </div>
        </div>
      ` : `
        <div class="tst-empty">
          <div class="tst-empty-icon">📖</div>
          <p>Select a student to begin a Reading MCQ session.</p>
        </div>
      `}
    </div>`;
}

async function startReadingSession() {
  const studentId = _selectedStudent;
  if (!studentId) return;

  const panel = document.getElementById("tst-reading-panel");
  if (panel) panel.innerHTML =
    `<div class="tst-loading"><div class="tst-spinner"></div> Setting up reading test…</div>`;

  try {
    // 1. Get student's estimated CEFR level
    const student = await apiFetch(`/students/${studentId}`);
    const level = (student.overall_level || "B1").toUpperCase();

    // 2. Create ReadingMCQ session
    const session = await apiFetch("/testing/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, session_type: "ReadingMCQ" }),
    });

    // 3. Fetch targeted items via suggest-items (ranked by relevance, CEFR ±1)
    let items = await apiFetch(`/testing/suggest-items/${studentId}?session_type=ReadingMCQ&n=5`).catch(() => []);

    if (!items.length) {
      if (panel) panel.innerHTML = `
        <div class="tst-empty">
          <div class="tst-empty-icon">📖</div>
          <p>No ReadingMCQ items available for this student. Import items first.</p>
        </div>`;
      return;
    }

    _readingState = { sessionId: session.id, items, current: 0, correct: 0, level, studentId };
    showReadingItem();

  } catch (err) {
    const p = document.getElementById("tst-reading-panel");
    if (p) p.innerHTML = `
      <div class="tst-add-msg tst-add-msg--error" style="display:block">✕ ${err.message}</div>`;
  }
}

function showReadingItem() {
  const { items, current, sessionId } = _readingState;
  const item = items[current];

  // Split content into base text and question (separated by "\n\n---\n\n")
  const SEP    = "\n\n---\n\n";
  const sepIdx = item.content.indexOf(SEP);
  const baseText = sepIdx >= 0 ? item.content.slice(0, sepIdx) : "";
  const question = sepIdx >= 0 ? item.content.slice(sepIdx + SEP.length) : item.content;

  let options = [];
  try { options = JSON.parse(item.options); } catch { options = []; }

  const LETTERS = ["A", "B", "C", "D", "E"];
  const pct     = Math.round((current / items.length) * 100);

  const optionsHTML = options.map((opt, i) => {
    const letter = LETTERS[i] ?? String(i + 1);
    return `
      <button class="reading-option-btn" onclick="TST.answerReadingMCQ('${letter}')">
        <span class="reading-option-letter">${letter}</span>
        <span>${_escHtml(opt)}</span>
      </button>`;
  }).join("");

  const html = `
    <div class="reading-session">
      <div class="reading-progress">
        <div class="reading-progress-bar">
          <div class="reading-progress-fill" style="width:${pct}%"></div>
        </div>
        <span class="reading-progress-label">${current + 1} / ${items.length}</span>
      </div>
      <div class="reading-meta">
        <span class="tst-chip tst-chip--blue">ReadingMCQ</span>
        <span class="tst-chip tst-chip--gray">${item.target_cefr}</span>
        ${item.relevance_score != null
          ? `<span class="tst-chip tst-chip--green" title="Targeted relevance score">Relevância: ${Number(item.relevance_score).toFixed(2)}</span>`
          : ""}
        <span style="font-family:var(--font-mono,monospace);font-size:0.65rem;color:var(--text-muted,#A09890);margin-left:auto">
          Session #${sessionId}
        </span>
      </div>
      ${baseText ? `<div class="reading-base-text">${_escHtml(baseText)}</div>` : ""}
      <div class="reading-question">${_escHtml(question)}</div>
      <div class="reading-options" id="rdg-options">
        ${optionsHTML}
      </div>
    </div>`;

  let panel = document.getElementById("tst-reading-panel");
  if (!panel) {
    // Tab structure was replaced (e.g. user navigated away); rebuild it
    _activeTab = "reading";
    _container.innerHTML = `<div class="tst-root">${renderTabs()}<div id="tst-reading-panel" class="reading-panel"></div></div>`;
    panel = document.getElementById("tst-reading-panel");
  }
  panel.innerHTML = html;
}

async function recordReadingAnswer(letter) {
  if (!_readingState) return;
  const state = _readingState;
  const item  = state.items[state.current];
  const isCorrect = letter.toUpperCase() === item.correct_answer.toUpperCase();

  // Visual feedback — highlight chosen option and reveal correct answer
  document.querySelectorAll(".reading-option-btn").forEach(btn => {
    btn.disabled = true;
    const btnLetter = btn.querySelector(".reading-option-letter")?.textContent?.trim();
    if (btnLetter === letter) btn.classList.add(isCorrect ? "correct" : "wrong");
    if (!isCorrect && btnLetter === item.correct_answer.toUpperCase()) btn.classList.add("correct");
  });

  if (isCorrect) state.correct++;

  // POST result to API (non-blocking — test advances regardless)
  apiFetch(`/testing/sessions/${state.sessionId}/results`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: item.id, student_answer: letter, is_correct: isCorrect }),
  }).catch(err => console.warn("Result POST failed:", err));

  // Advance after brief pause so professor sees the highlight
  setTimeout(() => {
    state.current++;
    if (state.current >= state.items.length) showReadingResultSummary();
    else showReadingItem();
  }, 700);
}

function showReadingResultSummary() {
  const { correct, items, level, sessionId } = _readingState;
  const total = items.length;
  const pct   = total ? Math.round((correct / total) * 100) : 0;

  // Persist for sessionResults banner and future summary re-use
  _sessionResults.Reading = { correct, total, pct, level, sessionId };
  if (!_testStartTime) _testStartTime = new Date();
  _readingState = null;

  const summaryHtml = `
    <div class="reading-summary">
      <div class="reading-summary-score">${correct}/${total}</div>
      <div class="reading-summary-label">Reading: ${correct}/${total} acertos (${pct}%)</div>
      <p style="font-size:0.8rem;color:var(--text-muted,#A09890);font-family:var(--font-mono,monospace);margin:0 0 28px">
        Session #${sessionId} · Level ${level}
      </p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="tst-btn tst-btn--primary" onclick="TST.startReadingTest()">📖 New Test</button>
        <button class="tst-btn tst-btn--ghost"   onclick="TST.setTab('sessions')">View Sessions</button>
      </div>
    </div>`;

  const panel = document.getElementById("tst-reading-panel");
  if (panel) {
    panel.innerHTML = summaryHtml;
  } else {
    _container.innerHTML = `<div class="tst-root">${renderTabs()}<div id="tst-reading-panel" class="reading-panel">${summaryHtml}</div></div>`;
  }
}

// ─────────────────────────────────────────────────────────────
// Speaking Checklist — constant data
// ─────────────────────────────────────────────────────────────

const SPEAKING_DIM_ORDER = [
  "Fluency", "Coherence", "GrammarAccuracy", "GrammarRange",
  "LexicalRange", "LexicalPrecision",
  "PronunciationSound", "PronunciationProsody", "Interaction",
];

const SPEAKING_DIMENSION_LABELS = {
  Fluency:              "Fluency",
  Coherence:            "Coherence",
  GrammarAccuracy:      "Grammatical Accuracy",
  GrammarRange:         "Grammatical Range",
  LexicalRange:         "Lexical Range",
  LexicalPrecision:     "Lexical Precision",
  PronunciationSound:   "Pronunciation — Intelligibility",
  PronunciationProsody: "Pronunciation — Prosody",
  Interaction:          "Interaction",
};

// Recommended dimension sets indexed by CEFR rank (0=A1 … 5=C2)
// Step-by-step logic:
//   A1–B1 (rank 0-2): core triad — Fluency, Coherence, GrammarAccuracy (30 items)
//   B2    (rank 3):   + GrammarRange, LexicalRange (50 items)
//   C1–C2 (rank 4-5): all 9 dimensions (72 items)
const SPEAKING_DIMS_BY_RANK = [
  // A1
  ["Fluency", "Coherence", "GrammarAccuracy"],
  // A2
  ["Fluency", "Coherence", "GrammarAccuracy"],
  // B1
  ["Fluency", "Coherence", "GrammarAccuracy"],
  // B2
  ["Fluency", "Coherence", "GrammarAccuracy", "GrammarRange", "LexicalRange"],
  // C1
  [...SPEAKING_DIM_ORDER],
  // C2
  [...SPEAKING_DIM_ORDER],
];

// 72 observable speaking checklist items
// check_id format: {DIM_PREFIX}_{NNN} — mirrors the ChecklistItem table in the DB
const SPEAKING_ITEMS = [
  // ── Fluency (10) ─────────────────────────────────────────
  { check_id: "FL_001", dimension: "Fluency",        text: "Speaks without long, disruptive pauses" },
  { check_id: "FL_002", dimension: "Fluency",        text: "Maintains a steady pace without frequent stops to search for words" },
  { check_id: "FL_003", dimension: "Fluency",        text: "Self-corrects smoothly without losing the thread of speech" },
  { check_id: "FL_004", dimension: "Fluency",        text: 'Uses fillers naturally ("well", "you know", "I mean") without overusing them' },
  { check_id: "FL_005", dimension: "Fluency",        text: "Can sustain speech on a familiar topic for at least 1–2 minutes" },
  { check_id: "FL_006", dimension: "Fluency",        text: "Speech sounds spontaneous rather than memorized or rehearsed" },
  { check_id: "FL_007", dimension: "Fluency",        text: "Hesitations are brief and do not significantly impede communication" },
  { check_id: "FL_008", dimension: "Fluency",        text: "Continues talking even when searching for a word (uses circumlocution)" },
  { check_id: "FL_009", dimension: "Fluency",        text: "Speech rhythm is natural and not choppy or overly staccato" },
  { check_id: "FL_010", dimension: "Fluency",        text: "Does not repeat sentences due to loss of direction" },

  // ── Coherence (10) ───────────────────────────────────────
  { check_id: "CO_001", dimension: "Coherence",      text: "Ideas are presented in a logical, easy-to-follow sequence" },
  { check_id: "CO_002", dimension: "Coherence",      text: 'Uses discourse markers to connect ideas ("firstly", "however", "in addition")' },
  { check_id: "CO_003", dimension: "Coherence",      text: "Develops topics with relevant supporting details or examples" },
  { check_id: "CO_004", dimension: "Coherence",      text: "Stays on topic throughout the response" },
  { check_id: "CO_005", dimension: "Coherence",      text: 'Uses referencing devices correctly (pronouns, "this/that", "the latter")' },
  { check_id: "CO_006", dimension: "Coherence",      text: "Opens and closes responses in a clear, organized way" },
  { check_id: "CO_007", dimension: "Coherence",      text: "Provides justification or reasoning for opinions and claims" },
  { check_id: "CO_008", dimension: "Coherence",      text: "Transitions between ideas are smooth and clearly signaled" },
  { check_id: "CO_009", dimension: "Coherence",      text: "Can summarize or conclude a point effectively" },
  { check_id: "CO_010", dimension: "Coherence",      text: "Overall response structure is easy for the listener to follow" },

  // ── Grammatical Accuracy (10) ────────────────────────────
  { check_id: "GA_001", dimension: "GrammarAccuracy", text: "Uses subject-verb agreement correctly most of the time" },
  { check_id: "GA_002", dimension: "GrammarAccuracy", text: "Uses verb tenses consistently and appropriately for the context" },
  { check_id: "GA_003", dimension: "GrammarAccuracy", text: "Forms questions with correct word order" },
  { check_id: "GA_004", dimension: "GrammarAccuracy", text: "Uses articles (a/an/the) correctly in most contexts" },
  { check_id: "GA_005", dimension: "GrammarAccuracy", text: "Uses plural forms correctly" },
  { check_id: "GA_006", dimension: "GrammarAccuracy", text: "Errors are mostly minor and do not impede comprehension" },
  { check_id: "GA_007", dimension: "GrammarAccuracy", text: "Uses negation correctly" },
  { check_id: "GA_008", dimension: "GrammarAccuracy", text: "Uses prepositions correctly in most contexts" },
  { check_id: "GA_009", dimension: "GrammarAccuracy", text: "Pronoun references are mostly clear and accurate" },
  { check_id: "GA_010", dimension: "GrammarAccuracy", text: "Word order within clauses is generally correct" },

  // ── Grammatical Range (10) ───────────────────────────────
  { check_id: "GR_001", dimension: "GrammarRange",   text: "Uses a mix of simple and complex sentence structures" },
  { check_id: "GR_002", dimension: "GrammarRange",   text: 'Uses subordinate clauses ("because", "although", "unless", "when")' },
  { check_id: "GR_003", dimension: "GrammarRange",   text: 'Uses relative clauses ("who", "which", "that", "where")' },
  { check_id: "GR_004", dimension: "GrammarRange",   text: 'Uses conditional structures ("If I were…", "I would have…")' },
  { check_id: "GR_005", dimension: "GrammarRange",   text: "Uses passive voice when contextually appropriate" },
  { check_id: "GR_006", dimension: "GrammarRange",   text: "Uses modal verbs with variety (can, could, should, might, must, ought to)" },
  { check_id: "GR_007", dimension: "GrammarRange",   text: "Uses reported speech correctly" },
  { check_id: "GR_008", dimension: "GrammarRange",   text: "Uses compound sentences with varied coordinating conjunctions" },
  { check_id: "GR_009", dimension: "GrammarRange",   text: "Uses expanded noun phrases with pre- and post-modification" },
  { check_id: "GR_010", dimension: "GrammarRange",   text: "Attempts advanced structures (inversion, cleft sentences) even if not always correctly" },

  // ── Lexical Range (8) ────────────────────────────────────
  { check_id: "LR_001", dimension: "LexicalRange",   text: "Uses vocabulary beyond the most basic, high-frequency words" },
  { check_id: "LR_002", dimension: "LexicalRange",   text: "Can discuss a variety of everyday topics with adequate vocabulary" },
  { check_id: "LR_003", dimension: "LexicalRange",   text: 'Uses collocations naturally ("make a decision", "take a risk", "reach a goal")' },
  { check_id: "LR_004", dimension: "LexicalRange",   text: "Can discuss abstract concepts (feelings, social issues, ethical dilemmas)" },
  { check_id: "LR_005", dimension: "LexicalRange",   text: "Uses idiomatic expressions occasionally and appropriately" },
  { check_id: "LR_006", dimension: "LexicalRange",   text: "Describes or explains a concept effectively when the exact word is unknown (circumlocution)" },
  { check_id: "LR_007", dimension: "LexicalRange",   text: "Uses topic-specific vocabulary relevant to the discussion context" },
  { check_id: "LR_008", dimension: "LexicalRange",   text: "Vocabulary is varied — avoids excessive repetition of the same words" },

  // ── Lexical Precision (7) ────────────────────────────────
  { check_id: "LP_001", dimension: "LexicalPrecision", text: "Word choices are precise and appropriate to the context" },
  { check_id: "LP_002", dimension: "LexicalPrecision", text: 'Distinguishes correctly between semantically similar words ("make" vs. "do", "say" vs. "tell")' },
  { check_id: "LP_003", dimension: "LexicalPrecision", text: "Adjusts register appropriately between formal and informal contexts" },
  { check_id: "LP_004", dimension: "LexicalPrecision", text: "Word selection rarely leads to miscommunication or unintended meaning" },
  { check_id: "LP_005", dimension: "LexicalPrecision", text: 'Uses intensifiers and hedges with precision ("quite", "rather", "somewhat")' },
  { check_id: "LP_006", dimension: "LexicalPrecision", text: "Avoids L1 calques and false cognates that distort meaning" },
  { check_id: "LP_007", dimension: "LexicalPrecision", text: "Selects words that convey the intended connotation (positive/negative/neutral)" },

  // ── Pronunciation — Intelligibility (5) ─────────────────
  { check_id: "PS_001", dimension: "PronunciationSound", text: "Is understood by the listener without the need for repetition or clarification" },
  { check_id: "PS_002", dimension: "PronunciationSound", text: "Vowel sounds are clear enough to avoid misunderstanding" },
  { check_id: "PS_003", dimension: "PronunciationSound", text: "Consonant sounds are clear enough to avoid misunderstanding" },
  { check_id: "PS_004", dimension: "PronunciationSound", text: "Minimal pairs are distinguishable (e.g. ship/sheep, think/sink, live/leave)" },
  { check_id: "PS_005", dimension: "PronunciationSound", text: "Intelligibility is maintained even during faster or more connected speech" },

  // ── Pronunciation — Prosody (5) ──────────────────────────
  { check_id: "PP_001", dimension: "PronunciationProsody", text: "Stresses content words appropriately within sentences" },
  { check_id: "PP_002", dimension: "PronunciationProsody", text: "Varies intonation to convey meaning (questions vs. statements, emphasis)" },
  { check_id: "PP_003", dimension: "PronunciationProsody", text: "Uses linking and connected speech sounds naturally" },
  { check_id: "PP_004", dimension: "PronunciationProsody", text: "Rhythm and chunking reflect natural English patterns" },
  { check_id: "PP_005", dimension: "PronunciationProsody", text: "Tone signals pragmatic intent clearly (doubt, sarcasm, friendliness)" },

  // ── Interaction (7) ──────────────────────────────────────
  { check_id: "IN_001", dimension: "Interaction",    text: "Responds to questions promptly and without excessive processing time" },
  { check_id: "IN_002", dimension: "Interaction",    text: "Can both initiate and sustain a conversation beyond minimal responses" },
  { check_id: "IN_003", dimension: "Interaction",    text: 'Uses turn-taking signals naturally ("What do you think?", "Right…", "Exactly")' },
  { check_id: "IN_004", dimension: "Interaction",    text: "Asks for clarification or repetition when something is not understood" },
  { check_id: "IN_005", dimension: "Interaction",    text: "Acknowledges and builds on the interlocutor's contributions" },
  { check_id: "IN_006", dimension: "Interaction",    text: "Can repair communication breakdowns effectively" },
  { check_id: "IN_007", dimension: "Interaction",    text: 'Uses active listening cues ("I see", "Right", "Really?")' },
];

// ─────────────────────────────────────────────────────────────
// Speaking Checklist — session functions
// ─────────────────────────────────────────────────────────────

function renderSpeakingPanel() {
  // Placeholder if a checklist is in progress (render() will call showSpeakingChecklist)
  if (_speakingState) return `<div id="tst-speaking-panel" class="spk-panel"></div>`;

  const studentOpts = _students.map(s =>
    `<option value="${s.id}"${s.id === _selectedStudent ? " selected" : ""}>${s.name}</option>`
  ).join("");

  const spk = _sessionResults.speaking;
  let resultHTML = "";
  if (spk) {
    const entries = Object.entries(spk.scores).filter(([, s]) => s.answered > 0);
    const totYes = entries.reduce((n, [, s]) => n + s.yes, 0);
    const totAns = entries.reduce((n, [, s]) => n + s.answered, 0);
    const overallPct = totAns ? Math.round(totYes / totAns * 100) : 0;
    const badges = SPEAKING_DIM_ORDER
      .filter(d => spk.scores[d]?.answered > 0)
      .slice(0, 5)
      .map(d => {
        const p = spk.scores[d].pct ?? 0;
        const bg = p >= 70 ? "#F0FDF4" : p >= 40 ? "#FEF9C3" : "#FEF2F2";
        const fg = p >= 70 ? "#166534" : p >= 40 ? "#854D0E" : "#991B1B";
        return `<span class="tst-chip" style="background:${bg};color:${fg}">${(SPEAKING_DIMENSION_LABELS[d]||d).split(" ")[0]}: ${p}%</span>`;
      }).join("");

    resultHTML = `
      <div class="spk-result-banner">
        <div>
          <div style="font-family:var(--font-display,serif);font-size:2.25rem;color:var(--accent,#2D5BE3);line-height:1">${overallPct}%</div>
          <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary,#1A1714);margin-top:2px">Speaking Overall</div>
          <div style="font-size:0.7rem;color:var(--text-muted,#A09890);font-family:var(--font-mono,monospace)">Session #${spk.sessionId} · Level ${spk.level}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">${badges}</div>
        <button class="tst-btn tst-btn--primary tst-btn--sm" style="margin-left:auto;align-self:flex-start"
          onclick="TST.startSpeakingTest()">New Assessment</button>
      </div>`;
  }

  return `
    <div id="tst-speaking-panel" class="spk-panel">
      <div class="tst-toolbar">
        <select class="tst-select" onchange="TST.selectStudentForSpeaking(this.value)">
          <option value="" disabled${!_selectedStudent ? " selected" : ""}>Select student…</option>
          ${studentOpts}
        </select>
      </div>
      ${resultHTML || (_selectedStudent ? `
        <div class="spk-start-card">
          <div class="spk-panel-header">Speaking Checklist Assessment</div>
          <p style="font-size:0.875rem;color:var(--text-secondary,#6B6560);margin:0">
            72 observable items across Fluency, Coherence, Grammar, Lexis, Pronunciation
            and Interaction. Items shown are adapted to the student's estimated CEFR level.
          </p>
          <div>
            <button class="tst-btn tst-btn--primary" onclick="TST.startSpeakingTest()">
              🗣 Start Speaking Assessment
            </button>
          </div>
        </div>
      ` : `
        <div class="tst-empty">
          <div class="tst-empty-icon">🗣</div>
          <p>Select a student to begin a Speaking assessment.</p>
        </div>
      `)}
    </div>`;
}

async function startSpeakingSession() {
  const studentId = _selectedStudent;
  if (!studentId) return;

  const panel = document.getElementById("tst-speaking-panel");
  if (panel) panel.innerHTML =
    `<div class="tst-loading"><div class="tst-spinner"></div> Setting up speaking assessment…</div>`;

  try {
    // 1. Fetch student to get overall_level
    const student = await apiFetch(`/students/${studentId}`);
    const level = (student.overall_level || "B1").toUpperCase();

    // 2. Create FreeSpeaking session
    const session = await apiFetch("/testing/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, session_type: "FreeSpeaking" }),
    });

    // 3. Pick recommended dimensions for this CEFR level
    //    Rank: A1=0, A2=1, B1=2, B2=3, C1=4, C2=5 — clamp to valid range
    const CEFR_RANK = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
    const rank = CEFR_RANK[level] ?? 2;
    const recommended = new Set(SPEAKING_DIMS_BY_RANK[rank]);

    _speakingState = { sessionId: session.id, level, studentId, responses: {}, recommended, showAll: false };
    showSpeakingChecklist();

  } catch (err) {
    const p = document.getElementById("tst-speaking-panel");
    if (p) p.innerHTML =
      `<div class="tst-add-msg tst-add-msg--error" style="display:block">✕ ${err.message}</div>`;
  }
}

function showSpeakingChecklist() {
  const state = _speakingState;

  // Build dimension sections — all are rendered in the DOM; non-recommended are hidden
  const sectionsHTML = SPEAKING_DIM_ORDER.map(dim => {
    const isRec     = state.recommended.has(dim);
    const dimItems  = SPEAKING_ITEMS.filter(i => i.dimension === dim);
    const label     = SPEAKING_DIMENSION_LABELS[dim] || dim;
    const hideStyle = (!isRec && !state.showAll) ? ' style="display:none"' : "";

    const itemsHTML = dimItems.map(item => {
      const ans      = state.responses[item.check_id];
      const answered = item.check_id in state.responses;
      const rowCls   = answered ? (ans ? " answered-yes" : " answered-no") : "";
      const yesCls   = ans === true  ? " active" : "";
      const noCls    = ans === false ? " active" : "";
      return `
        <div class="spk-item-row${rowCls}" id="spk-item-${item.check_id}">
          <span class="spk-item-id">${item.check_id}</span>
          <span class="spk-item-text">${_escHtml(item.text)}</span>
          <div class="spk-item-btns">
            <button class="spk-yes-btn${yesCls}"
              onclick="TST.toggleSpeakingItem('${item.check_id}', true)">✓ Sim</button>
            <button class="spk-no-btn${noCls}"
              onclick="TST.toggleSpeakingItem('${item.check_id}', false)">✗ Não</button>
          </div>
        </div>`;
    }).join("");

    const optTag = isRec ? "" : `<span class="spk-optional-tag">opcional</span>`;

    return `
      <div class="spk-dim-section"${hideStyle} id="spk-dim-${dim}">
        <div class="spk-dim-header">
          <span class="spk-dim-name">${label}</span>
          ${optTag}
          <span class="spk-dim-badge" id="spk-badge-${dim}">0/${dimItems.length}</span>
        </div>
        <div class="spk-dim-items">${itemsHTML}</div>
      </div>`;
  }).join("");

  const recTotal = SPEAKING_ITEMS.filter(i => state.recommended.has(i.dimension)).length;

  const html = `
    <div class="spk-checklist-header">
      <span class="spk-checklist-title">Speaking Assessment</span>
      <span class="spk-meta-label">Session #${state.sessionId} · Level ${state.level}</span>
      <button class="spk-toggle-all" onclick="TST.toggleSpeakingShowAll()">
        ${state.showAll ? "Mostrar recomendados" : "Ver todos os 72 itens"}
      </button>
    </div>
    ${sectionsHTML}
    <div class="spk-footer" id="spk-footer">
      <span class="spk-footer-progress" id="spk-progress-label">
        0/${recTotal} recomendados respondidos
      </span>
      <button class="tst-btn tst-btn--primary tst-btn--sm" id="spk-submit-btn"
        onclick="TST.submitSpeakingSession()">
        Finalizar Avaliação
      </button>
    </div>`;

  let panel = document.getElementById("tst-speaking-panel");
  if (!panel) {
    _activeTab = "speaking";
    _container.innerHTML = `<div class="tst-root">${renderTabs()}<div id="tst-speaking-panel" class="spk-panel"></div></div>`;
    panel = document.getElementById("tst-speaking-panel");
  }
  panel.innerHTML = html;

  // Initialize badges for all already-answered items (e.g. after tab switch)
  for (const dim of SPEAKING_DIM_ORDER) _updateSpkDimBadge(dim);
  _updateSpkFooter();
}

function handleSpeakingToggle(checkId, value) {
  const state = _speakingState;
  if (!state) return;

  // Toggle: clicking the active button again removes the answer
  if (state.responses[checkId] === value) {
    delete state.responses[checkId];
  } else {
    state.responses[checkId] = value;
  }

  // Update row style and button active classes
  const row = document.getElementById(`spk-item-${checkId}`);
  if (row) {
    const answered = checkId in state.responses;
    row.className = `spk-item-row${answered ? (state.responses[checkId] ? " answered-yes" : " answered-no") : ""}`;
    row.querySelector(".spk-yes-btn")?.classList.toggle("active", state.responses[checkId] === true);
    row.querySelector(".spk-no-btn") ?.classList.toggle("active", state.responses[checkId] === false);
  }

  const dim = SPEAKING_ITEMS.find(i => i.check_id === checkId)?.dimension;
  if (dim) _updateSpkDimBadge(dim);
  _updateSpkFooter();
}

function _updateSpkDimBadge(dim) {
  const badge = document.getElementById(`spk-badge-${dim}`);
  if (!badge || !_speakingState) return;

  const dimItems = SPEAKING_ITEMS.filter(i => i.dimension === dim);
  const answered = dimItems.filter(i => i.check_id in _speakingState.responses);
  const yesCount = answered.filter(i => _speakingState.responses[i.check_id]).length;

  if (!answered.length) {
    badge.className = "spk-dim-badge";
    badge.textContent = `0/${dimItems.length}`;
    return;
  }

  const pct = Math.round(yesCount / answered.length * 100);
  badge.textContent = `${yesCount}/${answered.length} · ${pct}%`;
  badge.className = `spk-dim-badge spk-dim-badge--${pct >= 70 ? "good" : pct >= 40 ? "warn" : "bad"}`;
}

function _updateSpkFooter() {
  const state = _speakingState;
  const lbl = document.getElementById("spk-progress-label");
  if (!lbl || !state) return;

  const recItems  = SPEAKING_ITEMS.filter(i => state.recommended.has(i.dimension));
  const recDone   = recItems.filter(i => i.check_id in state.responses).length;
  const totalDone = Object.keys(state.responses).length;
  lbl.textContent = `${recDone}/${recItems.length} recomendados respondidos${totalDone > recDone ? ` · ${totalDone} no total` : ""}`;
}

function handleSpeakingShowAll() {
  if (!_speakingState) return;
  _speakingState.showAll = !_speakingState.showAll;
  const showing = _speakingState.showAll;

  // Toggle visibility of optional (non-recommended) sections without full re-render
  for (const dim of SPEAKING_DIM_ORDER) {
    if (!_speakingState.recommended.has(dim)) {
      const sec = document.getElementById(`spk-dim-${dim}`);
      if (sec) sec.style.display = showing ? "" : "none";
    }
  }

  const btn = document.querySelector(".spk-toggle-all");
  if (btn) btn.textContent = showing ? "Mostrar recomendados" : "Ver todos os 72 itens";
}

async function finalizeSpeakingSession() {
  const state = _speakingState;
  if (!state) return;

  const btn = document.getElementById("spk-submit-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }

  // Build API payload from recorded responses
  const responses = Object.entries(state.responses).map(([check_id, response]) => ({
    check_id, response,
  }));

  let apiResult = null;
  try {
    apiResult = await apiFetch(`/testing/sessions/${state.sessionId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responses }),
    });
  } catch (err) {
    console.warn("Checklist API error:", err.message);
    // Continue to show local results even if the API call fails
  }

  // Calculate scores locally — source of truth regardless of API outcome
  const scores = _calcSpeakingScores(state);
  _sessionResults.speaking = { scores, sessionId: state.sessionId, level: state.level };
  if (!_testStartTime) _testStartTime = new Date();
  _speakingState = null;

  _showSpeakingSummary(scores, apiResult);
}

function _calcSpeakingScores(state) {
  const scores = {};
  for (const item of SPEAKING_ITEMS) {
    if (!scores[item.dimension]) scores[item.dimension] = { yes: 0, answered: 0, total: 0 };
    scores[item.dimension].total++;
    if (item.check_id in state.responses) {
      scores[item.dimension].answered++;
      if (state.responses[item.check_id]) scores[item.dimension].yes++;
    }
  }
  for (const s of Object.values(scores)) {
    s.pct = s.answered > 0 ? Math.round(s.yes / s.answered * 100) : null;
  }
  return scores;
}

function _showSpeakingSummary(scores, apiResult) {
  const saved = _sessionResults.speaking;

  const cardsHTML = SPEAKING_DIM_ORDER
    .filter(dim => scores[dim]?.answered > 0)
    .map(dim => {
      const s   = scores[dim];
      const pct = s.pct ?? 0;
      const pctClass = pct >= 70 ? "spk-summary-pct--good" : pct >= 40 ? "spk-summary-pct--mid" : "spk-summary-pct--low";
      return `
        <div class="spk-summary-card">
          <div class="spk-summary-dim">${SPEAKING_DIMENSION_LABELS[dim] || dim}</div>
          <div class="spk-summary-pct ${pctClass}">${pct}%</div>
          <div class="spk-summary-count">${s.yes}/${s.answered} sim</div>
        </div>`;
    }).join("");

  const apiNote = apiResult?.errors?.length
    ? `<p style="font-size:.72rem;color:var(--text-muted,#A09890);font-family:var(--font-mono,monospace);margin:0 0 16px">
        ${apiResult.errors.length} item(s) não encontrado(s) no banco — usando pontuação local.</p>`
    : "";

  const html = `
    <div style="text-align:center;padding:28px 0">
      <div style="font-family:var(--font-display,serif);font-size:1.4rem;color:var(--text-primary,#1A1714);margin-bottom:6px">
        Speaking Assessment Concluído
      </div>
      <p style="font-size:.8rem;color:var(--text-muted,#A09890);font-family:var(--font-mono,monospace);margin:0 0 20px">
        Session #${saved.sessionId} · Level ${saved.level}
      </p>
      ${apiNote}
      <div class="spk-summary-grid">${cardsHTML}</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="tst-btn tst-btn--primary" onclick="TST.startSpeakingTest()">Nova Avaliação</button>
        <button class="tst-btn tst-btn--ghost"   onclick="TST.setTab('sessions')">Ver Sessões</button>
      </div>
    </div>`;

  let panel = document.getElementById("tst-speaking-panel");
  if (panel) {
    panel.innerHTML = html;
  } else {
    _container.innerHTML = `<div class="tst-root">${renderTabs()}<div id="tst-speaking-panel" class="spk-panel">${html}</div></div>`;
  }
}

// ─────────────────────────────────────────────────────────────
// Listening Breakdown
// ─────────────────────────────────────────────────────────────

const LISTENING_CAUSES = [
  "fala rápida", "linking", "palavra desconhecida", "sotaque", "outro",
];

function renderListeningPanel() {
  const studentOpts = _students.map(s =>
    `<option value="${s.id}"${s.id === _selectedStudent ? " selected" : ""}>${s.name}</option>`
  ).join("");

  const lst = _sessionResults.listening;
  const resultHTML = lst ? `
    <div class="lst-result-banner">
      <div>
        <div style="font-family:var(--font-display,serif);font-size:2rem;color:var(--accent,#2D5BE3);line-height:1">${lst.count}</div>
        <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary,#1A1714);margin-top:2px">erros registrados</div>
      </div>
      <button class="tst-btn tst-btn--primary tst-btn--sm" style="margin-left:auto"
        onclick="TST.selectStudentForListening('${lst.studentId}')">Novo Registro</button>
    </div>` : "";

  const listHTML = _listeningErrors.length ? `
    <div class="lst-list" id="lst-list">${_buildListeningListHTML()}</div>
    <div class="lst-footer">
      <span style="font-size:0.8rem;color:var(--text-secondary,#6B6560)">${_listeningErrors.length} erro(s) adicionado(s)</span>
      <button class="tst-btn tst-btn--primary tst-btn--sm" id="lst-submit-btn"
        onclick="TST.submitListeningErrors()">Finalizar e Registrar</button>
    </div>` : `<div id="lst-list"></div>`;

  return `
    <div id="tst-listening-panel" class="lst-panel">
      <div class="tst-toolbar">
        <select class="tst-select" onchange="TST.selectStudentForListening(this.value)">
          <option value="" disabled${!_selectedStudent ? " selected" : ""}>Select student…</option>
          ${studentOpts}
        </select>
      </div>
      ${resultHTML || (_selectedStudent ? `
        <div class="lst-form-card">
          <div class="lst-panel-header">Listening Breakdown</div>
          <div class="lst-form-row">
            <label class="lst-form-label">Frase perdida *</label>
            <input id="lst-phrase" class="lst-input" type="text"
              placeholder="Ex: "She's been working since…"" />
          </div>
          <div class="lst-form-row">
            <label class="lst-form-label">O que o aluno entendeu (opcional)</label>
            <input id="lst-understood" class="lst-input" type="text"
              placeholder="Ex: "She has work…"" />
          </div>
          <div class="lst-form-row">
            <label class="lst-form-label">Causa suspeita</label>
            <select id="lst-cause" class="lst-select">
              ${LISTENING_CAUSES.map(c => `<option value="${c}">${c}</option>`).join("")}
            </select>
          </div>
          <button class="lst-add-btn" onclick="TST.addListeningError()">+ Adicionar erro</button>
        </div>
        ${listHTML}
      ` : `
        <div class="tst-empty">
          <div class="tst-empty-icon">🎧</div>
          <p>Selecione um aluno para registrar erros de compreensão.</p>
        </div>
      `)}
    </div>`;
}

function _buildListeningListHTML() {
  return _listeningErrors.map((e, i) => `
    <div class="lst-error-row">
      <div class="lst-error-body">
        <div class="lst-error-phrase">${_escHtml(e.phrase)}</div>
        <div class="lst-error-meta">
          causa: ${_escHtml(e.cause)}
          ${e.understood ? ` · entendeu: ${_escHtml(e.understood)}` : ""}
        </div>
      </div>
      <button class="lst-remove-btn" onclick="TST.removeListeningError(${i})" title="Remover">✕</button>
    </div>`).join("");
}

function _renderListeningList() {
  const list = document.getElementById("lst-list");
  if (!list) return;
  list.innerHTML = _buildListeningListHTML();

  // Update footer counter and show/hide submit button
  const footer = list.nextElementSibling;
  if (!footer) {
    if (_listeningErrors.length > 0) {
      list.insertAdjacentHTML("afterend", `
        <div class="lst-footer">
          <span style="font-size:0.8rem;color:var(--text-secondary,#6B6560)">${_listeningErrors.length} erro(s) adicionado(s)</span>
          <button class="tst-btn tst-btn--primary tst-btn--sm" id="lst-submit-btn"
            onclick="TST.submitListeningErrors()">Finalizar e Registrar</button>
        </div>`);
    }
  } else {
    const counter = footer.querySelector("span");
    if (counter) counter.textContent = `${_listeningErrors.length} erro(s) adicionado(s)`;
  }
}

async function finalizeListeningErrors() {
  const studentId = _selectedStudent;
  if (!studentId || !_listeningErrors.length) return;

  const btn = document.getElementById("lst-submit-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }

  let ok = 0;
  const errors = [];
  for (const e of _listeningErrors) {
    const rawInput = e.understood
      ? `${e.phrase} (entendeu: ${e.understood})`
      : e.phrase;
    try {
      await apiFetch("/reporting/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id:  studentId,
          source_type: "ListeningBreakdown",
          raw_input:   rawInput,
          polarity:    -1,
          severity:    2,
          context:     `causa: ${e.cause}`,
        }),
      });
      ok++;
    } catch (err) {
      errors.push(err.message);
    }
  }

  const count = _listeningErrors.length;
  _sessionResults.listening = { count: ok, studentId };
  if (!_testStartTime) _testStartTime = new Date();
  _listeningErrors = [];

  const panel = document.getElementById("tst-listening-panel");
  const note = errors.length
    ? `<p style="font-size:.72rem;color:#EF4444;font-family:var(--font-mono,monospace);margin:8px 0 0">${errors.length} evento(s) com erro.</p>`
    : "";
  const html = `
    <div style="text-align:center;padding:28px 0">
      <div style="font-family:var(--font-display,serif);font-size:1.4rem;color:var(--text-primary,#1A1714);margin-bottom:6px">
        Listening Breakdown Registrado
      </div>
      <p style="font-size:.8rem;color:var(--text-muted,#A09890);font-family:var(--font-mono,monospace);margin:0 0 20px">
        ${ok} de ${count} evento(s) salvo(s)
      </p>${note}
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px">
        <button class="tst-btn tst-btn--primary" onclick="TST.selectStudentForListening('${studentId}')">Novo Registro</button>
        <button class="tst-btn tst-btn--ghost"   onclick="TST.setTab('sessions')">Ver Sessões</button>
      </div>
    </div>`;
  if (panel) panel.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// Writing Sample
// ─────────────────────────────────────────────────────────────

const WRITING_FLAGS = [
  { id: "run_ons",         label: "Estrutura de sentença / run-ons" },
  { id: "tense_inconsist", label: "Inconsistência de tempo verbal" },
  { id: "connectives",     label: "Uso incorreto de conectivos" },
  { id: "articles",        label: "Erros sistemáticos de artigo" },
  { id: "register",        label: "Registro inadequado (informal demais)" },
];

function renderWritingPanel() {
  const studentOpts = _students.map(s =>
    `<option value="${s.id}"${s.id === _selectedStudent ? " selected" : ""}>${s.name}</option>`
  ).join("");

  const wrt = _sessionResults.writing;
  const resultHTML = wrt ? `
    <div class="wrt-result-banner">
      <div>
        <div style="font-family:var(--font-display,serif);font-size:2rem;color:var(--accent,#2D5BE3);line-height:1">${wrt.flags}</div>
        <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary,#1A1714);margin-top:2px">flag(s) registrada(s)</div>
      </div>
      <button class="tst-btn tst-btn--primary tst-btn--sm" style="margin-left:auto"
        onclick="TST.selectStudentForWriting('${wrt.studentId}')">Nova Amostra</button>
    </div>` : "";

  const flagsHTML = WRITING_FLAGS.map(f =>
    `<label class="wrt-flag-item">
      <input type="checkbox" id="wrt-flag-${f.id}" value="${f.id}">
      <span class="wrt-flag-label">${f.label}</span>
    </label>`
  ).join("");

  return `
    <div id="tst-writing-panel" class="wrt-panel">
      <div class="tst-toolbar">
        <select class="tst-select" onchange="TST.selectStudentForWriting(this.value)">
          <option value="" disabled${!_selectedStudent ? " selected" : ""}>Select student…</option>
          ${studentOpts}
        </select>
      </div>
      ${resultHTML || (_selectedStudent ? `
        <div class="wrt-form-card">
          <div class="wrt-panel-header">Writing Sample</div>
          <div>
            <div class="wrt-form-label" style="margin-bottom:6px">Amostra do aluno</div>
            <textarea id="wrt-sample" class="wrt-textarea"
              placeholder="Cole aqui um trecho escrito pelo aluno…"></textarea>
          </div>
          <div>
            <div class="wrt-form-label" style="margin-bottom:10px">Flags de erro observadas</div>
            <div class="wrt-flags">${flagsHTML}</div>
          </div>
          <div>
            <button class="tst-btn tst-btn--primary" id="wrt-submit-btn"
              onclick="TST.submitWritingSample()">Registrar</button>
          </div>
        </div>
      ` : `
        <div class="tst-empty">
          <div class="tst-empty-icon">✍️</div>
          <p>Selecione um aluno para registrar uma amostra de escrita.</p>
        </div>
      `)}
    </div>`;
}

async function finalizeWritingSample() {
  const studentId = _selectedStudent;
  if (!studentId) return;

  const sample = document.getElementById("wrt-sample")?.value.trim() || "";
  const selectedFlags = WRITING_FLAGS.filter(f =>
    document.getElementById(`wrt-flag-${f.id}`)?.checked
  );

  if (!sample && !selectedFlags.length) {
    const btn = document.getElementById("wrt-submit-btn");
    if (btn) { btn.textContent = "Adicione uma amostra ou selecione pelo menos uma flag."; }
    setTimeout(() => { const b = document.getElementById("wrt-submit-btn"); if (b) b.textContent = "Registrar"; }, 2500);
    return;
  }

  const btn = document.getElementById("wrt-submit-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }

  // Post one event per flag; if no flags, post one event for the raw sample
  const targets = selectedFlags.length
    ? selectedFlags.map(f => ({ raw_input: f.label, context: sample ? `sample: ${sample.slice(0, 200)}` : "WritingSample" }))
    : [{ raw_input: sample.slice(0, 500), context: "WritingSample" }];

  let ok = 0;
  for (const t of targets) {
    try {
      await apiFetch("/reporting/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id:  studentId,
          source_type: "WritingSample",
          raw_input:   t.raw_input,
          polarity:    -1,
          severity:    2,
          context:     t.context,
        }),
      });
      ok++;
    } catch (_) { /* continue */ }
  }

  _sessionResults.writing = { flags: ok, studentId };
  if (!_testStartTime) _testStartTime = new Date();

  const panel = document.getElementById("tst-writing-panel");
  const html = `
    <div style="text-align:center;padding:28px 0">
      <div style="font-family:var(--font-display,serif);font-size:1.4rem;color:var(--text-primary,#1A1714);margin-bottom:6px">
        Writing Sample Registrado
      </div>
      <p style="font-size:.8rem;color:var(--text-muted,#A09890);font-family:var(--font-mono,monospace);margin:0 0 20px">
        ${ok} evento(s) salvo(s)
      </p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="tst-btn tst-btn--primary" onclick="TST.selectStudentForWriting('${studentId}')">Nova Amostra</button>
        <button class="tst-btn tst-btn--ghost"   onclick="TST.setTab('sessions')">Ver Sessões</button>
      </div>
    </div>`;
  if (panel) panel.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// Test Summary
// ─────────────────────────────────────────────────────────────

const CEFR_SEQ = ["A1", "A2", "B1", "B2", "C1", "C2"];

function _pctToCefr(pct, testLevel) {
  const idx = CEFR_SEQ.indexOf(testLevel);
  if (idx === -1) return testLevel;
  if (pct >= 80) return CEFR_SEQ[Math.min(idx + 1, 5)];
  if (pct >= 50) return CEFR_SEQ[idx];
  return CEFR_SEQ[Math.max(idx - 1, 0)];
}

function _estimateReadingLevel(r) {
  if (!r) return null;
  return _pctToCefr(r.pct, r.level);
}

function _estimateSpeakingLevel(spk) {
  if (!spk?.scores) return null;
  const entries = Object.values(spk.scores).filter(s => s.answered > 0);
  if (!entries.length) return null;
  const totYes = entries.reduce((n, s) => n + s.yes, 0);
  const totAns = entries.reduce((n, s) => n + s.answered, 0);
  const pct = Math.round(totYes / totAns * 100);
  return _pctToCefr(pct, spk.level);
}

function _collectGaps(results) {
  const candidates = [];

  // Speaking: lowest-scoring answered dimensions
  if (results.speaking?.scores) {
    for (const [dim, s] of Object.entries(results.speaking.scores)) {
      if (s.answered > 0) {
        candidates.push({
          skill:    SPEAKING_DIMENSION_LABELS[dim] || dim,
          detail:   `${s.pct ?? 0}% · ${s.yes}/${s.answered} sim`,
          severity: 100 - (s.pct ?? 0),
          source:   "Speaking",
        });
      }
    }
  }

  // Reading: always include if completed, higher severity when below threshold
  const r = results.Reading;
  if (r) {
    candidates.push({
      skill:    "Reading Comprehension",
      detail:   `${r.pct}% acertos (${r.correct}/${r.total})`,
      severity: 100 - r.pct,
      source:   "Reading",
    });
  }

  // Listening: qualitative
  if (results.listening?.count > 0) {
    candidates.push({
      skill:    "Listening Breakdown",
      detail:   `${results.listening.count} erro(s) registrado(s)`,
      severity: 50,
      source:   "Listening",
    });
  }

  // Writing: qualitative
  if (results.writing?.flags > 0) {
    candidates.push({
      skill:    "Writing Sample",
      detail:   `${results.writing.flags} flag(s) de erro`,
      severity: 50,
      source:   "Writing",
    });
  }

  return candidates.sort((a, b) => b.severity - a.severity).slice(0, 3);
}

function renderTestSummaryPanel() {
  const studentId = _selectedStudent;
  if (!studentId) return;

  const student   = _students.find(s => s.id === studentId);
  const name      = student?.name || "Aluno";
  const now       = new Date();
  const dateStr   = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const durMin    = _testStartTime
    ? Math.round((now - _testStartTime) / 60000)
    : null;
  const durStr    = durMin != null ? `${durMin} min` : "—";

  const readLevel = _estimateReadingLevel(_sessionResults.Reading);
  const spkLevel  = _estimateSpeakingLevel(_sessionResults.speaking);
  const gaps      = _collectGaps(_sessionResults);

  // Collect available session IDs for saving
  const sessionIds = [
    _sessionResults.Reading?.sessionId,
    _sessionResults.speaking?.sessionId,
  ].filter(Boolean);

  function skillCard(label, level, detail) {
    const cls = level ? "sum-skill-level" : "sum-skill-level sum-skill-level--na";
    return `
      <div class="sum-skill-card">
        <div class="sum-skill-label">${label}</div>
        <div class="${cls}">${level || "—"}</div>
        <div class="sum-skill-detail">${detail || ""}</div>
      </div>`;
  }

  const readDetail = _sessionResults.Reading
    ? `${_sessionResults.Reading.pct}% acertos`
    : "";
  const spkDetail = _sessionResults.speaking ? (() => {
    const entries = Object.values(_sessionResults.speaking.scores).filter(s => s.answered > 0);
    const tot = entries.reduce((n, s) => n + s.answered, 0);
    const yes = entries.reduce((n, s) => n + s.yes, 0);
    return tot ? `${Math.round(yes / tot * 100)}% sim` : "";
  })() : "";
  const lstDetail = _sessionResults.listening
    ? `${_sessionResults.listening.count} erros` : "";
  const wrtDetail = _sessionResults.writing
    ? `${_sessionResults.writing.flags} flags` : "";

  const gapsHTML = gaps.length ? gaps.map((g, i) => `
    <div class="sum-gap-row">
      <div class="sum-gap-rank${i > 0 ? ` sum-gap-rank--${i + 1}` : ""}">${i + 1}</div>
      <div style="flex:1">
        <div class="sum-gap-skill">${_escHtml(g.skill)}</div>
        <div class="sum-gap-detail">${_escHtml(g.detail)}</div>
      </div>
      <span class="sum-gap-source">${g.source}</span>
    </div>`).join("")
    : `<div class="sum-no-gaps">Nenhum gap identificado — dados insuficientes.</div>`;

  const html = `
    <div id="tst-summary-panel" class="sum-panel">
      <div class="sum-header">
        <div class="sum-title">Resultado do Teste de Proficiência</div>
        <div class="sum-meta">${_escHtml(name)} · ${dateStr} · ${durStr}</div>
      </div>

      <div class="sum-skills-grid">
        ${skillCard("Reading",   readLevel, readDetail)}
        ${skillCard("Speaking",  spkLevel,  spkDetail)}
        ${skillCard("Listening", null,      lstDetail || ("listening" in _sessionResults ? "registrado" : "—"))}
        ${skillCard("Writing",   null,      wrtDetail  || ("writing" in _sessionResults  ? "registrado" : "—"))}
      </div>

      <div class="sum-gaps-card">
        <div class="sum-gaps-title">Top Gaps Identificados</div>
        <div class="sum-gaps-list">${gapsHTML}</div>
      </div>

      <div class="sum-actions">
        <div class="sum-save-btn-area">
          <button class="tst-btn tst-btn--primary" id="sum-save-btn"
            onclick="TST.saveAndCloseTest()"
            data-session-ids="${sessionIds.join(',')}"
            data-student-id="${studentId}"
            data-dur="${durMin ?? ''}">
            💾 Salvar e fechar
          </button>
          ${sessionIds.length ? `<div class="sum-saving-note">Salva em ${sessionIds.length} sessão(ões)</div>` : ""}
        </div>
        <button class="tst-btn tst-btn--ghost" onclick="TST.setTab('reading')">
          ← Voltar
        </button>
      </div>
    </div>`;

  _container.innerHTML = `<div class="tst-root">${renderTabs()}${html}</div>`;
  _updateActionsBar();
}

async function _saveTestAndNavigate() {
  const btn = document.getElementById("sum-save-btn");
  if (!btn) return;

  const sessionIds = btn.dataset.sessionIds
    .split(",")
    .map(id => parseInt(id))
    .filter(Boolean);
  const studentId = parseInt(btn.dataset.studentId);
  const durMin    = btn.dataset.dur ? parseInt(btn.dataset.dur) : null;

  btn.disabled   = true;
  btn.textContent = "Salvando…";

  const readLevel = _estimateReadingLevel(_sessionResults.Reading);
  const spkLevel  = _estimateSpeakingLevel(_sessionResults.speaking);
  const gaps      = _collectGaps(_sessionResults);

  const overallResult = {
    student_id:       studentId,
    generated_at:     new Date().toISOString(),
    estimated_levels: {
      reading:   readLevel  || null,
      speaking:  spkLevel   || null,
      listening: null,
      writing:   null,
    },
    skill_data: {
      reading:   _sessionResults.Reading   || null,
      speaking:  _sessionResults.speaking  ? {
        level: _sessionResults.speaking.level,
        scores: Object.fromEntries(
          Object.entries(_sessionResults.speaking.scores)
            .filter(([, s]) => s.answered > 0)
        ),
      } : null,
      listening: _sessionResults.listening || null,
      writing:   _sessionResults.writing   || null,
    },
    top_gaps: gaps.map(g => ({ skill: g.skill, detail: g.detail, source: g.source })),
  };

  for (const sessionId of sessionIds) {
    try {
      await apiFetch(`/testing/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overall_result:   overallResult,
          ...(durMin != null ? { duration_minutes: durMin } : {}),
        }),
      });
    } catch (err) {
      console.warn(`PATCH session ${sessionId} failed:`, err.message);
    }
  }

  // Reset test state
  _sessionResults  = {};
  _testStartTime   = null;
  _listeningErrors = [];

  // Navigate to students and open this student's profile
  window._pendingStudentId = studentId;
  location.hash = "students";
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function init(container, actionsBar) {
  _container       = container;
  _actionsBar      = actionsBar;
  _activeTab       = "items";
  _items           = [];
  _sessions        = [];
  _selectedStudent = null;
  _filterType      = "";
  _filterCefr      = "";
  _modalOpen       = false;
  _sessionResults  = {};
  _testStartTime   = null;
  _listeningErrors = [];
  _readingState    = null;
  _speakingState   = null;

  injectStyles();
  container.innerHTML = `<div class="tst-loading"><div class="tst-spinner"></div> Loading…</div>`;

  await Promise.all([loadStudents(), loadItems()]);
  render();
}
