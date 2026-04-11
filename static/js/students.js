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

/**
 * Busca todos os alunos via GET /api/students e renderiza os
 * resultados como cards dentro de #students-list.
 *
 * Fluxo:
 *   1. Mostra spinner
 *   2. Faz a requisição com fetch + await
 *   3. Converte o corpo para JSON com um segundo await
 *   4. Renderiza card para cada aluno  —  ou empty state se []
 *   5. Em caso de erro de rede ou HTTP, exibe mensagem amigável
 */
async function loadStudents() {
  const container = getContainer();
  renderLoading(container);

  try {
    // 1. Dispara a requisição e aguarda os headers chegarem
    const response = await fetch(`${API_BASE}/students`);

    // 2. Se o servidor respondeu com 4xx / 5xx, tratamos como erro
    if (!response.ok) {
      throw new Error(`Servidor retornou ${response.status} ${response.statusText}`);
    }

    // 3. Aguarda o corpo ser lido e desserializado como JSON
    //    "students" é agora um array de objetos JavaScript
    const students = await response.json();

    // 4a. Lista vazia → empty state
    if (students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <h3>No students yet</h3>
          <p>Add your first student using the button above.</p>
        </div>`;
      return;
    }

    // 4b. Gera o HTML de todos os cards de uma vez
    //     e injeta no DOM em uma única operação (evita reflows múltiplos)
    container.innerHTML = `
      <div class="card-grid">
        ${students.map(student => `
          <div class="card clickable-card" data-id="${student.id}">
            <div class="card-label">Student #${student.id}</div>
            <div class="card-title">${student.name}</div>
            <div class="card-meta">
              <div class="card-meta-row">
                <span>Level</span>
                <span>
                  ${student.target_level
                    ? `<span class="badge badge-blue">${student.target_level}</span>`
                    : `<span class="badge badge-gray">—</span>`}
                </span>
              </div>
              <div class="card-meta-row">
                <span>Start date</span>
                <span>${formatDate(student.start_date)}</span>
              </div>
              <div class="card-meta-row">
                <span>Job title</span>
                <span>${student.job_title ?? "—"}</span>
              </div>
            </div>
          </div>
        `).join("")}
      </div>`;

    // Adiciona event listeners para tornar os cards clicáveis
    document.querySelectorAll('.clickable-card').forEach(card => {
      card.addEventListener('click', () => {
        const studentId = card.getAttribute('data-id');
        showStudentProfile(studentId);
      });
    });

  } catch (err) {
    // Captura tanto erros de rede (fetch falhou) quanto os que lançamos acima
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
      <div style="background:#FEF2F2;border:1px solid #FECACA;color:#B91C1C;border-radius:10px;padding:16px 20px;margin:24px auto;max-width:600px;font-size:0.875rem;">
        Erro ao carregar perfil do aluno: ${error.message}
      </div>`;
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
