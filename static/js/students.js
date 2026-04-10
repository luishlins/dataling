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
 * Exibe o perfil de um aluno específico, incluindo estimativa de nível.
 * Busca dados via GET /api/students/<id> e GET /api/students/<id>/level-estimate.
 * Renderiza no #main-content.
 */
async function showStudentProfile(studentId) {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) {
    console.error('Elemento #main-content não encontrado.');
    return;
  }

  // Mostra loading
  mainContent.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading student profile…</p>
    </div>`;

  try {
    // Busca dados do aluno
    const studentResponse = await fetch(`${API_BASE}/students/${studentId}`);
    if (!studentResponse.ok) {
      throw new Error(`Erro ao buscar aluno: ${studentResponse.status}`);
    }
    const student = await studentResponse.json();

    // Busca análise de gaps
    let gapData = null;
    try {
      const gapResponse = await fetch(`${API_BASE}/students/${studentId}/gap-analysis`);
      if (gapResponse.ok) {
        gapData = await gapResponse.json();
      } else if (gapResponse.status === 400) {
        // Insufficient data
        gapData = { error: 'Dados insuficientes para análise de gaps' };
      }
    } catch (gapError) {
      console.warn('Erro ao buscar análise de gaps:', gapError);
    }

    // Determina indicador de confiança
    let confidenceLabel, confidenceClass;
    if (levelData.overall.confidence >= 0.8) {
      confidenceLabel = 'Alto';
      confidenceClass = 'text-success';
    } else if (levelData.overall.confidence >= 0.5) {
      confidenceLabel = 'Médio';
      confidenceClass = 'text-warning';
    } else {
      confidenceLabel = 'Baixo';
      confidenceClass = 'text-danger';
    }

    // Prepara elementos de gap analysis se disponível
    let gapAnalysisHTML = '';
    if (gapData && !gapData.error) {
      const primaryAspect = gapData.aspect_gaps.reduce((max, aspect) => aspect.gap_total > max.gap_total ? aspect : max).aspect;
      gapAnalysisHTML = `
        <div class="row mt-4">
          <div class="col-md-6">
            <h4>Progress to Next Level</h4>
            <div class="progress">
              <div class="progress-bar" role="progressbar" style="width: ${gapData.next_level_distance.percentage}%" aria-valuenow="${gapData.next_level_distance.percentage}" aria-valuemin="0" aria-valuemax="100">${gapData.next_level_distance.percentage}%</div>
            </div>
          </div>
          <div class="col-md-6">
            <h4>Primary Focus Area</h4>
            <span class="badge badge-danger">${primaryAspect}</span>
          </div>
        </div>
        <div class="row mt-4">
          <div class="col-md-6">
            <h4>Top 5 Skills to Work On</h4>
            <ul class="list-group">
              ${gapData.top_5_to_fix.map(skill => `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                  ${skill.skill_domain}: ${skill.skill_id}
                  <div class="progress" style="width: 100px;">
                    <div class="progress-bar" style="width: ${skill.mastery_score * 100}%"></div>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>
          <div class="col-md-6">
            <h4>Study Targets</h4>
            <ul class="list-group">
              ${gapData.next_level_distance.study_targets.map(target => `<li class="list-group-item">${target}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    } else if (gapData && gapData.error) {
      gapAnalysisHTML = `
        <div class="row mt-4">
          <div class="col-12">
            <div class="alert alert-info">${gapData.error}</div>
          </div>
        </div>
      `;
    }

    // Renderiza o painel
    mainContent.innerHTML = `
      <div class="container mt-4">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">${student.name}</h2>
          </div>
          <div class="card-body">
            <div class="row mb-4">
              <div class="col-12 text-center">
                <h3 class="display-4">${levelData.overall.level || 'N/A'}</h3>
                <p class="lead ${confidenceClass}">Confiança: ${confidenceLabel} (${(levelData.overall.confidence * 100).toFixed(0)}%)</p>
              </div>
            </div>
            <div class="row">
              <div class="col-md-3 text-center">
                <div class="badge badge-primary p-3">
                  <h5>Listening</h5>
                  <span class="h4">${levelData.listening.level || 'N/A'}</span>
                </div>
              </div>
              <div class="col-md-3 text-center">
                <div class="badge badge-success p-3">
                  <h5>Speaking</h5>
                  <span class="h4">${levelData.speaking.level || 'N/A'}</span>
                </div>
              </div>
              <div class="col-md-3 text-center">
                <div class="badge badge-info p-3">
                  <h5>Reading</h5>
                  <span class="h4">${levelData.reading.level || 'N/A'}</span>
                </div>
              </div>
              <div class="col-md-3 text-center">
                <div class="badge badge-warning p-3">
                  <h5>Writing</h5>
                  <span class="h4">${levelData.writing.level || 'N/A'}</span>
                </div>
              </div>
            </div>
            ${gapAnalysisHTML}
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Erro ao carregar perfil do aluno:', error);
    mainContent.innerHTML = `
      <div class="alert alert-danger" role="alert">
        Erro ao carregar perfil do aluno: ${error.message}
      </div>
    `;
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
