const API_BASE = "http://localhost:5000/api";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Retorna o container principal de alunos.
 * Lança erro descritivo se a div não existir no DOM.
 */
function getContainer() {
  const el = document.getElementById("students-list");
  if (!el) throw new Error('Elemento #students-list não encontrado no DOM.');
  return el;
}

/**
 * Formata uma data ISO ("2024-03-01") para exibição ("Mar 1, 2024").
 * Retorna "—" se o valor for nulo ou inválido.
 */
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00"); // força interpretação local
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Renderiza uma mensagem de erro amigável dentro do container.
 * @param {HTMLElement} container
 * @param {string} message  – texto técnico (ex.: resposta da API)
 */
function renderError(container, message) {
  container.innerHTML = `
    <div class="error-state">
      <span class="error-icon">⚠</span>
      <div>
        <div class="error-title">Não foi possível completar a operação</div>
        <div class="error-msg">${message}</div>
      </div>
    </div>`;
}

/**
 * Renderiza um spinner de carregamento dentro do container.
 */
function renderLoading(container) {
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading students…</p>
    </div>`;
}


// ─────────────────────────────────────────────────────────────
// loadStudents()
// ─────────────────────────────────────────────────────────────

/** Retorna a cor de fundo do badge de nível CEFR. */
function _levelColor(level) {
  if (!level) return "#9E9890";
  if (level.startsWith("A"))  return "#2E7D32";   // verde
  if (level.startsWith("B"))  return "#001365";   // azul
  return "#6A1B9A";                               // roxo (C1-C2)
}

/** True se a data ISO estiver há mais de 15 dias. */
function _isStale(isoDate) {
  if (!isoDate) return false;
  return (Date.now() - new Date(isoDate).getTime()) > 15 * 24 * 60 * 60 * 1000;
}

/**
 * Busca todos os alunos via GET /api/students?include_estimates=true
 * e renderiza como tabs horizontais dentro de #students-list.
 *
 * Cada tab mostra nome + badge de nível. Um ponto vermelho aparece
 * se last_evidence_date > 15 dias. Clicar chama openStudentModal(data).
 */
async function loadStudents() {
  const container = getContainer();
  renderLoading(container);

  try {
    const response = await fetch(`${API_BASE}/students?include_estimates=true`);
    if (!response.ok) {
      throw new Error(`Servidor retornou ${response.status} ${response.statusText}`);
    }
    const students = await response.json();

    if (students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">👤</div>
          <div class="empty-state__title">No students yet</div>
          <p class="empty-state__body">Add your first student using the button above.</p>
        </div>`;
      return;
    }

    // ── Tab bar ───────────────────────────────────────────────
    const tabBar = document.createElement("div");
    tabBar.className = "stu-tab-bar";

    students.forEach((s, idx) => {
      const tab = document.createElement("button");
      tab.className = "stu-tab" + (idx === 0 ? " stu-tab--active" : "");
      tab.dataset.studentId = s.id;

      // Badge de nível
      const badge = document.createElement("span");
      badge.className = "stu-level-badge";
      badge.textContent = s.overall_level || "—";
      badge.style.background = _levelColor(s.overall_level);

      // Ponto de alerta
      const dot = document.createElement("span");
      dot.className = "stu-alert-dot";
      dot.hidden = !_isStale(s.last_evidence_date);
      dot.title = "No evidence in the last 15 days";

      const nameSpan = document.createElement("span");
      nameSpan.className = "stu-tab-name";
      nameSpan.textContent = s.name;

      tab.appendChild(badge);
      tab.appendChild(nameSpan);
      tab.appendChild(dot);

      tab.addEventListener("click", () => {
        tabBar.querySelectorAll(".stu-tab").forEach(t => t.classList.remove("stu-tab--active"));
        tab.classList.add("stu-tab--active");
        openStudentModal(s);
      });

      tabBar.appendChild(tab);
    });

    container.innerHTML = "";
    container.appendChild(tabBar);

    // Seleciona o primeiro aluno por defeito (ou aluno pendente do módulo Testing)
    const pendingId = window._pendingStudentId;
    if (pendingId) delete window._pendingStudentId;
    const target = pendingId
      ? (students.find(s => s.id === pendingId) || students[0])
      : students[0];
    openStudentModal(target);

  } catch (err) {
    renderError(container, err.message);
  }
}


// ─────────────────────────────────────────────────────────────
// showAddStudentForm()
// ─────────────────────────────────────────────────────────────

/**
 * Exibe um formulário inline no topo de #students-list.
 * Se o formulário já estiver visível, não faz nada (evita duplicatas).
 *
 * O formulário NÃO usa a tag <form> para não causar page reload.
 * Os inputs ficam em uma div estilizada; a submissão é tratada por saveStudent().
 */
function showAddStudentForm() {
  const container = getContainer();

  // Impede abrir o formulário duas vezes
  if (document.getElementById("add-student-form")) return;

  const formHTML = `
    <div id="add-student-form" style="
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 24px 28px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-md);
      animation: fadeUp 0.25s ease forwards;
    ">
      <h3 style="
        font-family: var(--font-display);
        font-size: 1.1rem;
        margin-bottom: 20px;
        color: var(--text-primary);
      ">New Student</h3>

      <div id="form-error" style="display:none; margin-bottom:16px;"></div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">

        <div style="display:flex; flex-direction:column; gap:6px;">
          <label for="input-name" style="
            font-size:0.75rem; font-weight:500;
            color:var(--text-secondary); letter-spacing:0.04em; text-transform:uppercase;
            font-family:var(--font-mono);
          ">Name <span style="color:var(--danger)">*</span></label>
          <input
            id="input-name"
            type="text"
            placeholder="e.g. Maria Silva"
            style="
              padding: 9px 12px;
              border: 1px solid var(--border);
              border-radius: var(--radius-md);
              font-family: var(--font-body);
              font-size: 0.875rem;
              color: var(--text-primary);
              background: var(--bg);
              outline: none;
              transition: border-color 150ms;
            "
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border)'"
          />
        </div>

        <div style="display:flex; flex-direction:column; gap:6px;">
          <label for="input-start-date" style="
            font-size:0.75rem; font-weight:500;
            color:var(--text-secondary); letter-spacing:0.04em; text-transform:uppercase;
            font-family:var(--font-mono);
          ">Start Date <span style="color:var(--danger)">*</span></label>
          <input
            id="input-start-date"
            type="date"
            style="
              padding: 9px 12px;
              border: 1px solid var(--border);
              border-radius: var(--radius-md);
              font-family: var(--font-body);
              font-size: 0.875rem;
              color: var(--text-primary);
              background: var(--bg);
              outline: none;
              transition: border-color 150ms;
            "
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border)'"
          />
        </div>

      </div>

      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button
          onclick="cancelAddStudent()"
          class="btn btn-ghost"
          style="font-size:0.875rem;"
        >Cancel</button>
        <button
          onclick="saveStudent()"
          id="btn-save"
          class="btn btn-primary"
          style="font-size:0.875rem;"
        >Save Student</button>
      </div>
    </div>`;

  // Insere o formulário no início do container, antes da lista existente
  container.insertAdjacentHTML("afterbegin", formHTML);

  // Foca automaticamente no primeiro campo
  document.getElementById("input-name").focus();
}


// ─────────────────────────────────────────────────────────────
// cancelAddStudent()
// ─────────────────────────────────────────────────────────────

/**
 * Remove o formulário inline sem salvar.
 * Exposta globalmente para ser chamada pelo onclick do botão Cancel.
 */
function cancelAddStudent() {
  document.getElementById("add-student-form")?.remove();
}


// ─────────────────────────────────────────────────────────────
// saveStudent()
// ─────────────────────────────────────────────────────────────

/**
 * Lê os valores do formulário inline, valida os campos obrigatórios,
 * faz POST /api/students e — em caso de sucesso — fecha o formulário
 * e recarrega a lista via loadStudents().
 *
 * Erros de validação aparecem dentro do formulário (sem alert()).
 * Erros de API são mostrados como mensagem amigável no formulário.
 *
 * O botão Salvar é desabilitado durante a requisição para evitar
 * submissões duplicadas.
 */
async function saveStudent() {
  // ── 1. Lê os valores dos inputs ──────────────────────────────
  const nameInput      = document.getElementById("input-name");
  const startDateInput = document.getElementById("input-start-date");
  const formError      = document.getElementById("form-error");
  const btnSave        = document.getElementById("btn-save");

  const name       = nameInput.value.trim();
  const start_date = startDateInput.value; // formato "YYYY-MM-DD" nativo do input[type=date]

  // ── 2. Validação client-side ─────────────────────────────────
  const errors = [];
  if (!name)       errors.push("Name is required.");
  if (!start_date) errors.push("Start date is required.");

  if (errors.length > 0) {
    formError.style.display = "block";
    formError.innerHTML = `
      <div class="error-state" style="padding:12px 16px;">
        <span class="error-icon">⚠</span>
        <div>
          <div class="error-title">Please fix the following</div>
          <div class="error-msg">${errors.join(" ")}</div>
        </div>
      </div>`;
    return; // interrompe antes de chamar a API
  }

  // ── 3. Desabilita o botão para evitar cliques duplos ─────────
  btnSave.disabled    = true;
  btnSave.textContent = "Saving…";
  formError.style.display = "none";

  try {
    // ── 4. Faz o POST com o corpo em JSON ───────────────────────
    const response = await fetch(`${API_BASE}/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // informa ao Flask que o body é JSON
      },
      body: JSON.stringify({ name, start_date }), // serializa o objeto para string JSON
    });

    // ── 5. Verifica se a API retornou sucesso ───────────────────
    if (!response.ok) {
      // Tenta ler a mensagem de erro que a API envia no corpo JSON
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    // ── 6. Sucesso: fecha o formulário e atualiza a lista ───────
    cancelAddStudent();   // remove o formulário do DOM
    await loadStudents(); // re-renderiza a lista com o novo aluno incluído

  } catch (err) {
    // ── 7. Exibe o erro dentro do formulário ────────────────────
    formError.style.display = "block";
    formError.innerHTML = `
      <div class="error-state" style="padding:12px 16px;">
        <span class="error-icon">⚠</span>
        <div>
          <div class="error-title">Failed to save student</div>
          <div class="error-msg">${err.message}</div>
        </div>
      </div>`;
  } finally {
    // ── 8. Sempre reabilita o botão, mesmo em caso de erro ──────
    if (btnSave) {
      btnSave.disabled    = false;
      btnSave.textContent = "Save Student";
    }
  }
}


// ─────────────────────────────────────────────────────────────
// showStudentProfile(studentId)
// ─────────────────────────────────────────────────────────────

/**
 * Exibe o perfil de um aluno específico com estimativa de nível CEFR
 * e um resumo de evidências baseado nos skill states.
 *
 * Dados buscados em paralelo:
 *   GET /api/students/<id>
 *   GET /api/students/<id>/level-estimate
 *   GET /api/students/<name>/skill-states
 */
async function showStudentProfile(studentId) {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) { console.error("Elemento #main-content não encontrado."); return; }

  mainContent.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading student profile…</p>
    </div>`;

  try {
    // ── 1. Busca dados do aluno ───────────────────────────────────
    const studentRes = await fetch(`${API_BASE}/students/${studentId}`);
    if (!studentRes.ok) throw new Error(`Erro ao buscar aluno: ${studentRes.status}`);
    const student = await studentRes.json();

    // ── 2. Busca estimativa de nível e skill states em paralelo ───
    const [levelRes, statesRes] = await Promise.all([
      fetch(`${API_BASE}/students/${studentId}/level-estimate`).catch(() => null),
      fetch(`${API_BASE}/students/${student.name}/skill-states`).catch(() => null),
    ]);

    const levelData = levelRes?.ok ? await levelRes.json() : null;
    const allStates = statesRes?.ok ? await statesRes.json() : [];

    // ── 3. Monta o painel principal ───────────────────────────────
    mainContent.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "max-width:860px;margin:0 auto;padding:32px 24px;display:flex;flex-direction:column;gap:24px;";
    mainContent.appendChild(wrapper);

    // ── 3a. Cabeçalho do aluno ────────────────────────────────────
    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;";
    header.innerHTML = `
      <div>
        <div style="font-family:var(--font-display);font-size:1.75rem;color:var(--color-text);letter-spacing:-0.02em;">${student.name}</div>
        <div style="font-size:0.8125rem;color:var(--color-text-muted);margin-top:4px;font-family:var(--font-mono);">
          #${student.id} · Start: ${formatDate(student.start_date)}
          ${student.job_title ? ` · ${student.job_title}` : ""}
        </div>
      </div>
      <button onclick="loadStudents()" style="
        padding:7px 14px;border-radius:8px;border:1.5px solid var(--color-border);
        background:transparent;font-size:0.8125rem;color:var(--color-text-secondary);
        cursor:pointer;transition:background 140ms;">
        ← Back
      </button>`;
    wrapper.appendChild(header);

    // ── 3b. Card de nível estimado ────────────────────────────────
    if (levelData) {
      const overall    = levelData.overall  || {};
      const listening  = levelData.listening || {};
      const speaking   = levelData.speaking  || {};
      const reading    = levelData.reading   || {};
      const writing    = levelData.writing   || {};

      const conf = overall.confidence ?? 0;
      const confLabel = conf >= 0.8 ? "Alto" : conf >= 0.5 ? "Médio" : "Baixo";
      const confColor = conf >= 0.8 ? "var(--color-success)" : conf >= 0.5 ? "var(--color-warning)" : "var(--color-error)";

      const levelCard = document.createElement("div");
      levelCard.style.cssText = "background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;padding:24px 28px;box-shadow:var(--shadow-sm);";
      levelCard.innerHTML = `
        <div style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:16px;">
          Estimated Level
        </div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
          <span style="font-family:var(--font-display);font-size:2.5rem;color:#001365;letter-spacing:-0.03em;">
            ${overall.overall_level || "—"}
          </span>
          <span style="font-size:0.8125rem;color:${confColor};font-family:var(--font-mono);">
            Confiança: ${confLabel} (${Math.round(conf * 100)}%)
          </span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
          ${[
            { label: "Listening", data: listening },
            { label: "Speaking",  data: speaking  },
            { label: "Reading",   data: reading   },
            { label: "Writing",   data: writing   },
          ].map(({ label, data }) => `
            <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:10px;padding:12px;text-align:center;">
              <div style="font-family:var(--font-mono);font-size:0.62rem;text-transform:uppercase;color:var(--color-text-muted);letter-spacing:0.08em;margin-bottom:6px;">${label}</div>
              <div style="font-family:var(--font-display);font-size:1.25rem;color:var(--color-text);">${data.overall_level || "—"}</div>
            </div>`).join("")}
        </div>`;
      wrapper.appendChild(levelCard);
    }

    // ── 3c. Resumo de Evidências ──────────────────────────────────
    const evidenceCard = document.createElement("div");
    evidenceCard.style.cssText = "background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;padding:24px 28px;box-shadow:var(--shadow-sm);";

    const evidenceTitle = document.createElement("div");
    evidenceTitle.style.cssText = "font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:20px;";
    evidenceTitle.textContent = "Resumo de Evidências";
    evidenceCard.appendChild(evidenceTitle);

    // Filtra skills com mastery < 0.5 e agrupa por domínio
    const weak = allStates.filter(s => s.mastery_score < 0.5);
    const DOMAINS = [
      { key: "grammar",    label: "Gramática"  },
      { key: "vocabulary", label: "Vocabulário" },
      { key: "phonology",  label: "Fonologia"   },
    ];

    const columnsRow = document.createElement("div");
    columnsRow.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:16px;";

    DOMAINS.forEach(({ key, label }) => {
      const top3 = weak
        .filter(s => s.skill_domain === key)
        .sort((a, b) => a.mastery_score - b.mastery_score)  // menor mastery = maior gap
        .slice(0, 3);

      const col = document.createElement("div");

      // Cabeçalho da coluna
      const colHeader = document.createElement("div");
      colHeader.style.cssText = "font-family:var(--font-body);font-size:0.8125rem;font-weight:600;color:var(--color-text);margin-bottom:12px;";
      colHeader.textContent = label;
      col.appendChild(colHeader);

      if (top3.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText = "font-size:0.75rem;color:var(--color-text-muted);font-style:italic;padding:8px 0;";
        empty.textContent = "Nenhuma fraqueza detectada.";
        col.appendChild(empty);
      } else {
        top3.forEach(state => {
          const pct    = Math.round(state.mastery_score * 100);
          const desc   = state.examples || state.skill_id;

          const item = document.createElement("div");
          item.style.cssText = "margin-bottom:14px;";

          // Descrição
          const descEl = document.createElement("div");
          descEl.style.cssText = "font-size:0.8rem;color:var(--color-text-secondary);margin-bottom:5px;line-height:1.4;";
          descEl.textContent = desc;
          item.appendChild(descEl);

          // Barra de progresso
          const barWrap = document.createElement("div");
          barWrap.style.cssText = "height:6px;background:var(--color-border);border-radius:100px;overflow:hidden;";
          const bar = document.createElement("div");
          bar.style.cssText = `height:100%;width:${pct}%;background:#001365;border-radius:100px;transition:width 0.4s ease;`;
          barWrap.appendChild(bar);
          item.appendChild(barWrap);

          // Percentual
          const pctEl = document.createElement("div");
          pctEl.style.cssText = "font-family:var(--font-mono);font-size:0.62rem;color:var(--color-text-muted);margin-top:3px;";
          pctEl.textContent = `${pct}% domínio`;
          item.appendChild(pctEl);

          col.appendChild(item);
        });
      }

      columnsRow.appendChild(col);
    });

    evidenceCard.appendChild(columnsRow);

    // Nota quando não há skill states
    if (allStates.length === 0) {
      columnsRow.innerHTML = "";
      const noData = document.createElement("div");
      noData.style.cssText = "font-size:0.8125rem;color:var(--color-text-muted);text-align:center;padding:20px 0;";
      noData.textContent = "Nenhum dado de skill state disponível ainda para este aluno.";
      evidenceCard.appendChild(noData);
    }

    wrapper.appendChild(evidenceCard);

  } catch (error) {
    console.error("Erro ao carregar perfil do aluno:", error);
    mainContent.innerHTML = `
      <div style="background:rgba(191,13,62,.06);border:1px solid rgba(191,13,62,.25);color:#BF0D3E;border-radius:10px;padding:16px 20px;margin:24px auto;max-width:600px;font-size:0.875rem;">
        Erro ao carregar perfil do aluno: ${error.message}
      </div>`;
  }
}


// ─────────────────────────────────────────────────────────────
// openStudentModal(studentData)
// ─────────────────────────────────────────────────────────────

const _CEFR_SEQ = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Formata "2025-09-15T..." → "15/09/2025". */
function _fmtDMY(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Cria um elemento com classe e texto opcionais. */
function _el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Barra de progresso azul #001365. */
function _progressBar(pct) {
  const wrap = _el("div", "smo-bar-wrap");
  const fill = _el("div", "smo-bar-fill");
  fill.style.width = Math.min(100, Math.max(0, pct)) + "%";
  wrap.appendChild(fill);
  return wrap;
}

/**
 * Exibe/esconde o formulário inline de override de nível no modal.
 * Chamado pelo botão "Ajustar nível" dentro do modal.
 */
function _toggleOverrideForm(studentId, levelSec, bigBadge) {
  // Se o form já existe, remove (toggle off)
  const existing = levelSec.querySelector(".smo-override-form");
  if (existing) { existing.remove(); return; }

  // ── Form container ──────────────────────────────────────────
  const form = _el("div", "smo-override-form");
  form.id = "smo-override-form";

  // Select de nível
  const levelRow = _el("div", "smo-override-row");
  levelRow.appendChild(_el("label", "smo-override-label", "Novo nível"));
  const select = document.createElement("select");
  select.className = "smo-override-select";
  _CEFR_SEQ.forEach(lvl => {
    const opt = document.createElement("option");
    opt.value = lvl;
    opt.textContent = lvl;
    select.appendChild(opt);
  });
  // Pre-select current level if known
  const badge = document.getElementById("smo-overall-badge");
  if (badge && _CEFR_SEQ.includes(badge.textContent)) {
    select.value = badge.textContent;
  }
  levelRow.appendChild(select);
  form.appendChild(levelRow);

  // Textarea de motivo
  const reasonRow = _el("div", "smo-override-row");
  reasonRow.appendChild(_el("label", "smo-override-label", "Motivo"));
  const input = document.createElement("input");
  input.type = "text";
  input.className = "smo-override-input";
  input.placeholder = "Descreva o motivo do ajuste…";
  reasonRow.appendChild(input);
  form.appendChild(reasonRow);

  // Mensagem de erro
  const errorMsg = _el("div", "smo-override-error");
  form.appendChild(errorMsg);

  // Botões
  const actions = _el("div", "smo-override-actions");

  const confirmBtn = _el("button", "smo-override-confirm", "Confirmar");
  confirmBtn.addEventListener("click", async () => {
    const level  = select.value;
    const reason = input.value.trim();

    errorMsg.textContent = "";

    if (!reason) {
      errorMsg.textContent = "Informe o motivo do ajuste";
      return;
    }
    if (reason.length < 10) {
      errorMsg.textContent = "Informe o motivo do ajuste";
      return;
    }

    confirmBtn.disabled    = true;
    confirmBtn.textContent = "Salvando…";

    try {
      const res = await fetch(`${API_BASE}/students/${studentId}/level-override`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ override_level: level, reason }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errorMsg.textContent = body.error || `Erro ${res.status}`;
        confirmBtn.disabled    = false;
        confirmBtn.textContent = "Confirmar";
        return;
      }

      // ── Sucesso: atualiza o badge sem recarregar ───────────────
      bigBadge.textContent       = level;
      bigBadge.style.background  = _levelColor(level);
      form.remove();

    } catch (err) {
      errorMsg.textContent = "Erro de rede. Tente novamente.";
      confirmBtn.disabled    = false;
      confirmBtn.textContent = "Confirmar";
    }
  });

  const cancelBtn = _el("button", "smo-override-cancel", "Cancelar");
  cancelBtn.addEventListener("click", () => form.remove());

  actions.appendChild(confirmBtn);
  actions.appendChild(cancelBtn);
  form.appendChild(actions);

  levelSec.appendChild(form);
  input.focus();
}

/**
 * Abre o modal de perfil do aluno.
 * @param {Object} s  – objeto de aluno retornado por include_estimates=true
 */
async function openStudentModal(s) {
  // Remove modal anterior se existir
  document.getElementById("stu-modal-overlay")?.remove();

  // ── Overlay ──────────────────────────────────────────────
  const overlay = _el("div", "smo-overlay");
  overlay.id = "stu-modal-overlay";
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  const modal = _el("div", "smo-modal");
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // ── Botão fechar ──────────────────────────────────────────
  const closeBtn = _el("button", "smo-close", "×");
  closeBtn.setAttribute("aria-label", "Fechar");
  closeBtn.addEventListener("click", () => overlay.remove());
  modal.appendChild(closeBtn);

  // ── CABEÇALHO ─────────────────────────────────────────────
  const header = _el("div", "smo-header");

  const nameEl = _el("h2", "smo-name", s.name);
  header.appendChild(nameEl);

  const meta = _el("div", "smo-meta");

  const startEl = _el("span", "smo-meta-item");
  startEl.textContent = `Início: ${_fmtDMY(s.start_date)}`;
  meta.appendChild(startEl);

  const weeksEl = _el("span", "smo-meta-item");
  weeksEl.textContent = `${s.weeks_since_start ?? 0} semanas de acompanhamento`;
  meta.appendChild(weeksEl);

  header.appendChild(meta);
  modal.appendChild(header);

  // ── NÍVEL GERAL ───────────────────────────────────────────
  const levelSec = _el("div", "smo-section");
  levelSec.appendChild(_el("div", "smo-section-title", "Nível Geral"));

  const levelRow = _el("div", "smo-level-row");

  const bigBadge = _el("div", "smo-big-badge");
  bigBadge.id = "smo-overall-badge";
  bigBadge.textContent = s.overall_level || "—";
  bigBadge.style.background = _levelColor(s.overall_level);
  levelRow.appendChild(bigBadge);

  const adjustBtn = _el("button", "smo-adjust-btn", "Ajustar nível");
  adjustBtn.addEventListener("click", () => _toggleOverrideForm(s.id, levelSec, bigBadge));
  levelRow.appendChild(adjustBtn);

  const progressWrap = _el("div", "smo-progress-wrap");
  const progressLabel = _el("div", "smo-progress-label");
  const pct = s.next_level_progress ?? 0;
  const nextLevel = _CEFR_SEQ[_CEFR_SEQ.indexOf(s.overall_level) + 1] ?? null;
  progressLabel.textContent = nextLevel
    ? `Progresso para ${nextLevel}: ${pct}%`
    : "Nível máximo atingido";
  progressWrap.appendChild(progressLabel);
  progressWrap.appendChild(_progressBar(pct));
  levelRow.appendChild(progressWrap);

  levelSec.appendChild(levelRow);
  modal.appendChild(levelSec);

  // ── NÍVEL POR HABILIDADE ──────────────────────────────────
  const aspectSec = _el("div", "smo-section");
  aspectSec.appendChild(_el("div", "smo-section-title", "Nível por Habilidade"));

  const aspectGrid = _el("div", "smo-aspect-grid");
  const aspects = [
    { key: "L", label: "Listening"  },
    { key: "S", label: "Speaking"   },
    { key: "R", label: "Reading"    },
    { key: "W", label: "Writing"    },
  ];
  aspects.forEach(({ key, label }) => {
    const cell = _el("div", "smo-aspect-cell");
    const lbl  = _el("div", "smo-aspect-label", label);
    const lvl  = s.aspect_levels?.[key] ?? null;
    const badge = _el("div", "smo-aspect-badge", lvl || "—");
    badge.style.background = _levelColor(lvl);
    cell.appendChild(lbl);
    cell.appendChild(badge);
    aspectGrid.appendChild(cell);
  });
  aspectSec.appendChild(aspectGrid);
  modal.appendChild(aspectSec);

  // ── COBERTURA DE EVIDÊNCIAS (assíncrono) ─────────────────
  const covSec = _el("div", "smo-section");
  covSec.appendChild(_el("div", "smo-section-title", "Cobertura de Evidências"));
  const covBody = _el("div", "smo-cov-body");
  covBody.appendChild(_el("div", "smo-loading-inline", "Carregando…"));
  covSec.appendChild(covBody);
  modal.appendChild(covSec);

  try {
    const estRes = await fetch(`${API_BASE}/students/${s.id}/level-estimate`);
    covBody.innerHTML = "";
    if (estRes.ok) {
      const estData = await estRes.json();
      const coverage = estData.evidence_coverage || {};
      const COV_SKILLS = [
        { key: "Listening", letter: "L" },
        { key: "Speaking",  letter: "S" },
        { key: "Reading",   letter: "R" },
        { key: "Writing",   letter: "W" },
      ];
      const covGrid = _el("div", "smo-cov-grid");
      COV_SKILLS.forEach(({ key, letter }) => {
        const status = coverage[key] || "missing";
        const chip = _el("div", "smo-cov-chip smo-cov-chip--" + status, letter);
        if (status === "missing") {
          chip.title = `Sem evidências de ${key}. Registre no Reporting.`;
        }
        const lbl = _el("div", "smo-cov-label", key);
        const cell = _el("div", "smo-cov-cell");
        cell.appendChild(chip);
        cell.appendChild(lbl);
        covGrid.appendChild(cell);
      });
      covBody.appendChild(covGrid);
    } else {
      covBody.appendChild(_el("div", "smo-notice", "Cobertura indisponível."));
    }
  } catch {
    covBody.innerHTML = "";
    covBody.appendChild(_el("div", "smo-notice", "Erro ao carregar cobertura."));
  }

  // ── TÓPICOS A DOMINAR (assíncrono) ────────────────────────
  const topicSec = _el("div", "smo-section");
  topicSec.appendChild(_el("div", "smo-section-title", "Tópicos a Dominar"));

  const topicBody = _el("div", "smo-topic-body");
  topicBody.appendChild(_el("div", "smo-loading-inline", "Carregando…"));
  topicSec.appendChild(topicBody);
  modal.appendChild(topicSec);

  // Fetch assíncrono de gap-analysis
  try {
    const res = await fetch(`${API_BASE}/students/${s.id}/gap-analysis`);
    topicBody.innerHTML = "";

    if (!res.ok) {
      topicBody.appendChild(_el("div", "smo-notice", "Dados insuficientes para análise de tópicos."));
    } else {
      const gap = await res.json();

      // Determina próximo nível a partir do overall_level atual
      const nextIdx = _CEFR_SEQ.indexOf(s.overall_level) + 1;
      const targetLevel = nextIdx > 0 && nextIdx < _CEFR_SEQ.length
        ? _CEFR_SEQ[nextIdx] : null;

      // Filtra top_5_to_fix por domain=grammar e cefr_target=próximo nível
      const top5 = (gap.top_5_to_fix || [])
        .filter(sk => sk.skill_domain === "grammar" && (!targetLevel || sk.cefr_target === targetLevel))
        .slice(0, 5);

      // Fallback: se nenhum skill de grammar no próximo nível, mostra top 5 geral
      const items = top5.length > 0 ? top5 : (gap.top_5_to_fix || []).slice(0, 5);

      if (items.length === 0) {
        topicBody.appendChild(_el("div", "smo-notice", "Nenhum tópico crítico identificado."));
      } else {
        items.forEach(sk => {
          const row = _el("div", "smo-topic-row");

          const nameEl = _el("div", "smo-topic-name", sk.skill_id);
          row.appendChild(nameEl);

          const barRow = _el("div", "smo-topic-bar-row");
          barRow.appendChild(_progressBar(Math.round(sk.mastery_score * 100)));

          const pctEl = _el("span", "smo-topic-pct",
            `${Math.round(sk.mastery_score * 100)}%`);
          barRow.appendChild(pctEl);

          row.appendChild(barRow);
          topicBody.appendChild(row);
        });
      }
    }
  } catch {
    topicBody.innerHTML = "";
    topicBody.appendChild(_el("div", "smo-notice", "Erro ao carregar tópicos."));
  }
}


// ─────────────────────────────────────────────────────────────
// Exports  (compatível com módulos ES e com script tag clássica)
// ─────────────────────────────────────────────────────────────

// Expõe as funções no objeto window para que chamadas inline
// (onclick="saveStudent()") funcionem mesmo sem bundler
window.loadStudents        = loadStudents;
window.showAddStudentForm  = showAddStudentForm;
window.cancelAddStudent    = cancelAddStudent;
window.saveStudent         = saveStudent;
window.showStudentProfile  = showStudentProfile;
window.openStudentModal    = openStudentModal;

// Export ES module para quando o arquivo for importado via import()
export default function init(container, actionsBar) {
  // Garante que o container tenha o id esperado pelas funções internas
  container.id = "students-list";

  // Injeta o botão "+ New Student" na barra de ações do header
  actionsBar.innerHTML = `
    <button class="btn btn-primary" onclick="showAddStudentForm()">
      + New Student
    </button>`;

  // Carrega a lista imediatamente ao entrar na página
  loadStudents();
}
