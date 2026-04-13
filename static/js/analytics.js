const API_BASE = "http://localhost:5000/api";

const CEFR_SEQ = ["A1", "A2", "B1", "B2", "C1", "C2"];

// ── DOM helpers ───────────────────────────────────────────────

function _el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls)       e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function _svgEl(tag, attrs) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function _card(title) {
  const card = _el("div", "anl-card");
  card.appendChild(_el("div", "anl-card-title", title));
  return card;
}


// ── Block 1: Level Distribution (vertical bar chart) ─────────

function renderLevelDistribution(students, grid) {
  const card = _card("Distribuição de Níveis");

  const counts = Object.fromEntries(CEFR_SEQ.map(l => [l, 0]));
  students.forEach(s => {
    if (s.overall_level && counts[s.overall_level] !== undefined)
      counts[s.overall_level]++;
  });

  const maxCount = Math.max(...Object.values(counts), 1);

  const W = 420, H = 210;
  const PL = 34, PR = 12, PT = 20, PB = 38;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;
  const barW   = chartW / CEFR_SEQ.length;
  const barGap = barW * 0.28;

  const svg = _svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: "auto" });
  svg.style.display = "block";

  // Gridlines + Y labels
  [0, 0.5, 1].forEach(frac => {
    const y   = PT + chartH - frac * chartH;
    const val = Math.round(frac * maxCount);
    svg.appendChild(_svgEl("line", {
      x1: PL, x2: PL + chartW, y1: y, y2: y,
      stroke: "#D0D3E8", "stroke-width": "1",
    }));
    const t = _svgEl("text", {
      x: PL - 6, y: y + 4,
      "text-anchor": "end", "font-size": "10",
      fill: "#8C91B0", "font-family": "DM Mono,monospace",
    });
    t.textContent = val;
    svg.appendChild(t);
  });

  // Bars
  CEFR_SEQ.forEach((level, i) => {
    const count = counts[level];
    const bH    = Math.max((count / maxCount) * chartH, 0);
    const x     = PL + i * barW + barGap / 2;
    const y     = PT + chartH - bH;
    const w     = barW - barGap;

    svg.appendChild(_svgEl("rect", {
      x, y, width: w, height: bH,
      fill: "#001365", rx: "4",
    }));

    // Count above bar
    if (count > 0) {
      const t = _svgEl("text", {
        x: x + w / 2, y: y - 5,
        "text-anchor": "middle", "font-size": "11",
        fill: "#333333", "font-family": "DM Mono,monospace", "font-weight": "600",
      });
      t.textContent = count;
      svg.appendChild(t);
    }

    // X label
    const lbl = _svgEl("text", {
      x: x + w / 2, y: PT + chartH + 22,
      "text-anchor": "middle", "font-size": "12",
      fill: "#5A5F7A", "font-family": "DM Mono,monospace",
    });
    lbl.textContent = level;
    svg.appendChild(lbl);
  });

  card.appendChild(svg);
  card.appendChild(_el("div", "anl-legend", `${students.length} aluno${students.length !== 1 ? "s" : ""} no total`));
  grid.appendChild(card);
}


// ── Block 2: Top 5 Skill Gaps (horizontal bars) ──────────────

function renderSkillGaps(students, grid) {
  const card = _card("Top 5 Gaps da Turma");

  // Aggregate top_issues occurrences across all students
  const freq = {};
  students.forEach(s => {
    (s.top_issues || []).forEach(skillId => {
      freq[skillId] = (freq[skillId] || 0) + 1;
    });
  });

  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) {
    card.appendChild(_el("div", "anl-empty", "Nenhum dado de gap disponível."));
    grid.appendChild(card);
    return;
  }

  const maxFreq = sorted[0][1];

  const W = 420, ROW_H = 38, PL = 152, PR = 44, PT = 4;
  const H = PT + sorted.length * ROW_H + 4;
  const barMaxW = W - PL - PR;

  const svg = _svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: "auto" });
  svg.style.display = "block";

  sorted.forEach(([skillId, count], i) => {
    const y    = PT + i * ROW_H;
    const bW   = Math.max((count / maxFreq) * barMaxW, 4);
    const label = skillId.replace(/_/g, " ");
    const short = label.length > 24 ? label.slice(0, 22) + "…" : label;

    // Label
    const txt = _svgEl("text", {
      x: PL - 10, y: y + ROW_H / 2 + 4,
      "text-anchor": "end", "font-size": "10.5",
      fill: "#5A5F7A", "font-family": "DM Sans,sans-serif",
    });
    txt.textContent = short;
    svg.appendChild(txt);

    // Track
    svg.appendChild(_svgEl("rect", {
      x: PL, y: y + 9, width: barMaxW, height: ROW_H - 18,
      fill: "#E8EAF6", rx: "4",
    }));

    // Bar
    svg.appendChild(_svgEl("rect", {
      x: PL, y: y + 9, width: bW, height: ROW_H - 18,
      fill: "#BF0D3E", rx: "4",
    }));

    // Count
    const ct = _svgEl("text", {
      x: PL + bW + 7, y: y + ROW_H / 2 + 4,
      "font-size": "10", fill: "#333333",
      "font-family": "DM Mono,monospace", "font-weight": "600",
    });
    ct.textContent = count;
    svg.appendChild(ct);
  });

  card.appendChild(svg);
  card.appendChild(_el("div", "anl-legend", "Nº de alunos com o skill como gap crítico"));
  grid.appendChild(card);
}


// ── Block 3: Progress Leaders (top 3, active in last 30 days) ─

function renderProgressLeaders(students, grid) {
  const card = _card("Progresso para o Próximo Nível");
  card.appendChild(_el("div", "anl-card-sub", "Top 3 mais próximos — ativos no último mês"));

  const now        = Date.now();
  const THIRTY     = 30 * 24 * 60 * 60 * 1000;

  const active = students
    .filter(s =>
      s.overall_level &&
      s.last_evidence_date &&
      (now - new Date(s.last_evidence_date).getTime()) <= THIRTY
    )
    .sort((a, b) => (b.next_level_progress ?? 0) - (a.next_level_progress ?? 0))
    .slice(0, 3);

  if (active.length === 0) {
    card.appendChild(_el("div", "anl-empty", "Nenhum aluno ativo no último mês."));
    grid.appendChild(card);
    return;
  }

  active.forEach(s => {
    const pct      = Math.round(s.next_level_progress ?? 0);
    const nextIdx  = CEFR_SEQ.indexOf(s.overall_level) + 1;
    const nextLvl  = nextIdx < CEFR_SEQ.length ? CEFR_SEQ[nextIdx] : null;

    const row = _el("div", "anl-prog-row");

    const info = _el("div", "anl-prog-info");
    info.appendChild(_el("span", "anl-prog-name", s.name));
    info.appendChild(_el("span", "anl-prog-level",
      nextLvl ? `${s.overall_level} → ${nextLvl}` : s.overall_level));
    row.appendChild(info);

    row.appendChild(_el("span", "anl-prog-pct", `${pct}%`));

    const wrap = _el("div", "anl-bar-wrap");
    const fill = _el("div", "anl-bar-fill");
    fill.style.width = `${pct}%`;
    wrap.appendChild(fill);
    row.appendChild(wrap);

    card.appendChild(row);
  });

  grid.appendChild(card);
}


// ── Block 4: Inactivity Alerts ────────────────────────────────

function renderInactivityAlerts(students, grid) {
  const card = _card("Alerta de Inatividade");
  card.appendChild(_el("div", "anl-card-sub", "Sem evidência há mais de 15 dias"));

  const now         = Date.now();
  const FIFTEEN     = 15 * 24 * 60 * 60 * 1000;

  const inactive = students.filter(s =>
    !s.last_evidence_date ||
    (now - new Date(s.last_evidence_date).getTime()) > FIFTEEN
  );

  if (inactive.length === 0) {
    card.appendChild(_el("div", "anl-alert-ok", "Todos os alunos estão ativos."));
    grid.appendChild(card);
    return;
  }

  inactive.forEach(s => {
    const row    = _el("div", "anl-alert-row");
    const dot    = _el("span", "anl-alert-dot");
    const name   = _el("span", "anl-alert-name", s.name);

    let detail;
    if (!s.last_evidence_date) {
      detail = "Sem evidências registradas";
    } else {
      const days = Math.floor(
        (now - new Date(s.last_evidence_date).getTime()) / (24 * 60 * 60 * 1000)
      );
      detail = `${days} dias sem evidência`;
    }
    const detailEl = _el("span", "anl-alert-detail", detail);

    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(detailEl);
    card.appendChild(row);
  });

  grid.appendChild(card);
}


// ── Main ──────────────────────────────────────────────────────

async function loadAnalytics(container) {
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading analytics…</p>
    </div>`;

  try {
    const res = await fetch(`${API_BASE}/students?include_estimates=true`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const students = await res.json();

    container.innerHTML = "";

    const grid = _el("div", "anl-grid");
    container.appendChild(grid);

    renderLevelDistribution(students, grid);
    renderSkillGaps(students, grid);
    renderProgressLeaders(students, grid);
    renderInactivityAlerts(students, grid);

  } catch (err) {
    container.innerHTML = `
      <div class="error-state">
        <span class="error-icon">⚠</span>
        <div>
          <div class="error-title">Não foi possível carregar os analytics</div>
          <div class="error-msg">${err.message}</div>
        </div>
      </div>`;
  }
}

export default function init(container, actionsBar) {
  const refreshBtn = document.createElement("button");
  refreshBtn.className = "btn btn-ghost";
  refreshBtn.textContent = "↺ Refresh";
  refreshBtn.addEventListener("click", () => loadAnalytics(container));
  actionsBar.appendChild(refreshBtn);

  loadAnalytics(container);
}
