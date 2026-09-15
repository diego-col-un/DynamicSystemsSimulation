(function (global) {
  let m1, m1ChartTime, m1ChartPhase, m2, m2ChartTime, m3, m3ChartTime;
  let lastActiveModelTab = 1;
  let selectedRunId = null;

  function getCss(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  function baseLineOptions(xTitle, yTitle, isPhase) {
    return {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { labels: { color: getCss('--text'), boxWidth: 12, font: { size: 11 } } },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          title: { display: true, text: xTitle, color: getCss('--muted') },
          ticks: { color: getCss('--muted'), maxTicksLimit: 8 },
          grid: { color: getCss('--line') },
          type: isPhase ? 'linear' : 'category'
        },
        y: {
          title: { display: true, text: yTitle, color: getCss('--muted') },
          ticks: { color: getCss('--muted') },
          grid: { color: getCss('--line') },
          beginAtZero: true
        }
      }
    };
  }

  function updateThemeButton() {
    const isLight = document.body.classList.contains('light-theme');
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = isLight ? '☀️ Modo claro' : '🌙 Modo oscuro';
    }
  }

  function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeButton();
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    }
    updateThemeButton();
  }

  function syncSlider(numId, sliderId) {
    document.getElementById(sliderId).value = document.getElementById(numId).value;
    onParamChange();
  }

  function syncNumber(sliderId, numId) {
    document.getElementById(numId).value = document.getElementById(sliderId).value;
    onParamChange();
  }

  function switchTab(n) {
    document.getElementById('panel1').classList.toggle('hidden', n !== 1);
    document.getElementById('panel2').classList.toggle('hidden', n !== 2);
    document.getElementById('panel3').classList.toggle('hidden', n !== 3);
    document.getElementById('panel4').classList.toggle('hidden', n !== 4);
    document.getElementById('tabBtn1').classList.toggle('active', n === 1);
    document.getElementById('tabBtn2').classList.toggle('active', n === 2);
    document.getElementById('tabBtn3').classList.toggle('active', n === 3);
    document.getElementById('tabBtn4').classList.toggle('active', n === 4);

    if (n !== 4) {
      lastActiveModelTab = n;
    }

    if (n === 4) {
      refreshAnalysis();
    }
  }

  function onParamChange() {
    updateR0();
    updateNetRate();
  }

  function getModelNameFromTab(tab) {
    if (tab === 1) return 'Presa-Depredador';
    if (tab === 2) return 'SIR / SIRS';
    if (tab === 3) return 'Población';
    return 'Análisis';
  }

  function getCurrentTab() {
    if (!document.getElementById('panel1').classList.contains('hidden')) return 1;
    if (!document.getElementById('panel2').classList.contains('hidden')) return 2;
    if (!document.getElementById('panel3').classList.contains('hidden')) return 3;
    return lastActiveModelTab || 1;
  }

  function getCurrentSeries() {
    const tab = getCurrentTab();
    if (tab === 1) {
      return {
        model: 'Presa-Depredador',
        label: 'Conejos',
        values: m1.history.C,
        x: m1.history.t
      };
    }
    if (tab === 2) {
      return {
        model: 'SIR / SIRS',
        label: 'Infectados',
        values: m2.history.I,
        x: m2.history.t
      };
    }
    return {
      model: 'Población',
      label: 'Población',
      values: m3.history.P,
      x: m3.history.t
    };
  }

  function saveCurrentRun() {
    const tab = getCurrentTab();
    const model = getModelNameFromTab(tab);
    const now = new Date();

    let params = {};
    if (tab === 1) {
      params = getM1Params();
    } else if (tab === 2) {
      params = getM2Params();
    } else if (tab === 3) {
      params = getM3Params();
    }

    const series = getCurrentSeries();
    const trend = DynamicSystemsAnalytics.linearTrend(series.values);

    const record = {
      id: now.getTime(),
      model,
      timestamp: now.toISOString(),
      params,
      finalValue: series.values[series.values.length - 1],
      trend: trend,
      integrationMethod: 'Euler explícito',
      series: sampleRunSeries(tab, series)
    };

    DynamicSystemsStore.saveRun(record);
    refreshHistory();
    refreshAnalysis();
  }

  function formatParamValue(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? String(value) : Number(value).toFixed(3).replace(/\.0+$|(?<=\.[0-9]*?)0+$/, '');
    }
    return String(value);
  }

  function buildParameterGrid(params, definitions) {
    const entries = Object.entries(params || {});
    if (!entries.length) {
      return '<div class="history-empty">Sin parámetros</div>';
    }

    return `
      <div class="history-grid">
        ${entries.map(([key, value]) => `
          <div class="history-param">
            <span>${definitions[key] || key}</span>
            <strong>${formatParamValue(value)}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  function sampleRunSeries(tab, series) {
    const points = Math.min(series.values.length, 120);
    const step = points > 1 ? (series.values.length - 1) / (points - 1) : 1;

    return Array.from({ length: points }, (_, index) => {
      const sourceIndex = Math.min(series.values.length - 1, Math.round(index * step));
      const state = {};
      if (tab === 1) {
        state.C = m1.history.C[sourceIndex];
        state.Z = m1.history.Z[sourceIndex];
      } else if (tab === 2) {
        state.S = m2.history.S[sourceIndex];
        state.I = m2.history.I[sourceIndex];
        state.R = m2.history.R[sourceIndex];
      } else {
        state.P = m3.history.P[sourceIndex];
      }
      return { time: series.x[sourceIndex], state };
    });
  }

  function selectHistoryRun(id) {
    selectedRunId = selectedRunId === id ? null : id;
    refreshHistory();
  }

  function getRunEquations(run) {
    if (run.model === 'Presa-Depredador') {
      return 'dC/dt = a*C - b*C*Z; dZ/dt = c*C*Z - d*Z';
    }
    if (run.model === 'SIR / SIRS') {
      return run.params.sirs
        ? 'dS/dt = -(beta*S*I)/N + delta*R; dI/dt = (beta*S*I)/N - gamma*I; dR/dt = gamma*I - delta*R'
        : 'dS/dt = -(beta*S*I)/N; dI/dt = (beta*S*I)/N - gamma*I; dR/dt = gamma*I';
    }
    return 'P(t+dt) = P(t) + (P*a - P/e)*dt';
  }

  function getParameterDefinitions(model) {
    if (model === 'Presa-Depredador') {
      return {
        a: 'tasa de natalidad de los conejos',
        b: 'tasa de depredación de conejos por zorros',
        c: 'eficiencia de conversión de alimento en crecimiento de zorros',
        d: 'tasa de mortalidad natural de los zorros',
        dt: 'paso de integración de Euler'
      };
    }
    if (model === 'SIR / SIRS') {
      return {
        N: 'población total',
        beta: 'tasa de transmisión o contagio',
        gamma: 'tasa de recuperación',
        delta: 'tasa de pérdida de inmunidad en modo SIRS',
        dt: 'paso de integración de Euler',
        sirs: 'indica si está activo el modo SIRS'
      };
    }
    return {
      a: 'tasa de natalidad de la población',
      e: 'esperanza de vida media',
      dt: 'paso de integración de Euler'
    };
  }

  function refreshHistory() {
    const list = document.getElementById('historyList');
    const runs = DynamicSystemsStore.getRuns();

    if (!runs.length) {
      list.innerHTML = '<div class="card-2 p-3 text-sm text-slate-400">Todavía no hay registros guardados.</div>';
      return;
    }

    list.innerHTML = runs.map((run) => {
      const slope = Number((run.trend && run.trend.slope) || 0);
      const r2 = Number((run.trend && run.trend.r2) || 0);
      const isSelected = selectedRunId === run.id;
      const seriesCount = Array.isArray(run.series) ? run.series.length : 0;

      return `
        <article class="history-card${isSelected ? ' selected' : ''}">
          <div class="history-header">
            <button class="history-select" onclick="selectHistoryRun(${run.id})" aria-expanded="${isSelected}">
              <span class="history-model">${run.model}</span>
              <span class="history-action">${isSelected ? 'Ocultar detalles' : 'Ver detalles'}</span>
            </button>
            <span class="history-date">${new Date(run.timestamp).toLocaleString()}</span>
          </div>
          ${buildParameterGrid(run.params, getParameterDefinitions(run.model))}
          <div class="history-footer">
            <div class="history-stat">
              <span>Valor final</span>
              <strong class="mono">${Number(run.finalValue || 0).toFixed(2)}</strong>
            </div>
            <div class="history-stat">
              <span>Tendencia</span>
              <strong class="mono">${slope.toFixed(4)}</strong>
            </div>
            <div class="history-stat">
              <span>R²</span>
              <strong class="mono">${r2.toFixed(3)}</strong>
            </div>
          </div>
          ${isSelected ? `
            <div class="history-details">
              <div class="history-detail-row"><span>Método de integración</span><strong>${run.integrationMethod || 'Euler explícito'}</strong></div>
              <div class="history-detail-row"><span>Paso dt</span><strong class="mono">${formatParamValue(run.params && run.params.dt)}</strong></div>
              <div class="history-detail-row"><span>Puntos de trayectoria guardados</span><strong class="mono">${seriesCount || 'No disponible en registros antiguos'}</strong></div>
              <div class="history-equation"><span>Ecuaciones</span><code>${getRunEquations(run)}</code></div>
              ${seriesCount ? '' : '<p class="history-empty">Esta ejecución fue guardada antes de activar el detalle de trayectoria. Guarda una nueva ejecución para consultarla con IA.</p>'}
              <button class="ctrl-btn card-2 rounded-md py-2 text-sm history-ai-button" onclick="requestAIInterpretation(${run.id})" ${seriesCount ? '' : 'disabled'}>✦ Preguntar a la IA sobre esta ejecución</button>
            </div>
          ` : ''}
        </article>
      `;
    }).join('');
  }

  function refreshAnalysis() {
    const runs = DynamicSystemsStore.getRuns();
    const countEl = document.getElementById('analysisCount');
    const modelEl = document.getElementById('analysisModel');
    const trendEl = document.getElementById('analysisTrend');
    const r2El = document.getElementById('analysisR2');
    const lastEl = document.getElementById('analysisLastDate');

    if (!runs.length) {
      countEl.textContent = '0';
      modelEl.textContent = 'Sin datos';
      trendEl.textContent = '—';
      r2El.textContent = '—';
      lastEl.textContent = '—';
      return;
    }

    const latest = runs[0];
    const counts = runs.reduce((acc, run) => {
      acc[run.model] = (acc[run.model] || 0) + 1;
      return acc;
    }, {});
    const dominantModel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    countEl.textContent = String(runs.length);
    modelEl.textContent = dominantModel ? `${dominantModel[0]} (${dominantModel[1]})` : latest.model;
    trendEl.textContent = `${Number((latest.trend && latest.trend.slope) || 0).toFixed(4)} / paso`;
    r2El.textContent = Number((latest.trend && latest.trend.r2) || 0).toFixed(3);
    lastEl.textContent = new Date(latest.timestamp).toLocaleString();
  }

  function getInterpretationPayload() {
    const tab = getCurrentTab();
    const series = getCurrentSeries();
    const values = series.values;
    const trend = DynamicSystemsAnalytics.linearTrend(values);
    const points = Math.min(values.length, 100);
    const step = points > 1 ? (values.length - 1) / (points - 1) : 1;
    const sampled = Array.from({ length: points }, (_, index) => {
      const sourceIndex = Math.min(values.length - 1, Math.round(index * step));
      const state = {};
      if (tab === 1) {
        state.C = m1.history.C[sourceIndex];
        state.Z = m1.history.Z[sourceIndex];
      } else if (tab === 2) {
        state.S = m2.history.S[sourceIndex];
        state.I = m2.history.I[sourceIndex];
        state.R = m2.history.R[sourceIndex];
      } else {
        state.P = m3.history.P[sourceIndex];
      }
      return { time: series.x[sourceIndex], state };
    });

    const equations = tab === 1
      ? 'dC/dt = a*C - b*C*Z; dZ/dt = c*C*Z - d*Z'
      : tab === 2
        ? (getM2Params().sirs
          ? 'dS/dt = -(beta*S*I)/N + delta*R; dI/dt = (beta*S*I)/N - gamma*I; dR/dt = gamma*I - delta*R'
          : 'dS/dt = -(beta*S*I)/N; dI/dt = (beta*S*I)/N - gamma*I; dR/dt = gamma*I')
        : 'P(t+dt) = P(t) + (P*a - P/e)*dt';

    const parameters = tab === 1 ? getM1Params() : (tab === 2 ? getM2Params() : getM3Params());

    return {
      model: series.model,
      integrationMethod: 'Euler explícito',
      timeStep: parameters.dt,
      parameters,
      parameterDefinitions: getParameterDefinitions(series.model),
      equations,
      metrics: {
        points: values.length,
        initialValue: values[0],
        finalValue: values[values.length - 1],
        slopePerStep: trend.slope,
        r2: trend.r2
      },
      series: sampled
    };
  }

  function getInterpretationPayloadFromRun(run) {
    const values = (run.series || []).map((point) => {
      if (run.model === 'Presa-Depredador') return point.state.C;
      if (run.model === 'SIR / SIRS') return point.state.I;
      return point.state.P;
    });
    const trend = run.trend || DynamicSystemsAnalytics.linearTrend(values);

    return {
      model: run.model,
      integrationMethod: run.integrationMethod || 'Euler explícito',
      timeStep: Number(run.params && run.params.dt) || 0,
      parameters: run.params || {},
      parameterDefinitions: getParameterDefinitions(run.model),
      equations: getRunEquations(run),
      metrics: {
        points: values.length,
        initialValue: values[0],
        finalValue: run.finalValue,
        slopePerStep: trend.slope,
        r2: trend.r2
      },
      series: run.series
    };
  }

  async function requestAIInterpretation(runId) {
    const button = document.getElementById('interpretButton');
    const status = document.getElementById('aiStatus');
    const output = document.getElementById('aiInterpretation');
    const selectedRun = runId ? DynamicSystemsStore.getRuns().find((run) => run.id === runId) : null;
    const payload = selectedRun ? getInterpretationPayloadFromRun(selectedRun) : getInterpretationPayload();
    if (runId && !selectedRun) return;

    if (selectedRun) {
      selectedRunId = runId;
      refreshHistory();
    }
    const activeButton = runId
      ? document.querySelector(`button[onclick="requestAIInterpretation(${runId})"]`)
      : button;
    const originalText = activeButton ? activeButton.textContent : '';
    if (!activeButton) return;
    activeButton.disabled = true;
    activeButton.textContent = '⌛ Consultando IA...';
    button.disabled = true;
    status.textContent = 'Consultando backend';
    output.textContent = selectedRun
      ? `Analizando la ejecución ${selectedRun.model} seleccionada...`
      : 'Analizando ecuaciones, parámetros y trayectoria...';

    try {
      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Error al consultar el backend');
      output.textContent = result.interpretation;
      status.textContent = 'Interpretación actualizada';
    } catch (error) {
      output.textContent = `${error.message}. Levanta el backend Go y configura OPENROUTER_API_KEY.`;
      status.textContent = 'No disponible';
    } finally {
      activeButton.disabled = false;
      activeButton.textContent = originalText;
      button.disabled = false;
    }
  }

  function clearHistory() {
    DynamicSystemsStore.clearRuns();
    selectedRunId = null;
    refreshHistory();
    refreshAnalysis();
  }

  function getState(n) {
    return n === 1 ? m1 : (n === 2 ? m2 : m3);
  }

  function getPlayBtnId(n) {
    return n === 1 ? 'm1_play' : (n === 2 ? 'm2_play' : 'm3_play');
  }

  function stepAndRedraw(n) {
    if (n === 1) {
      eulerStepM1();
      redrawM1();
    } else if (n === 2) {
      eulerStepM2();
      redrawM2();
    } else {
      eulerStepM3();
      redrawM3();
    }
  }

  function toggleRun(n) {
    const state = getState(n);
    const btn = document.getElementById(getPlayBtnId(n));
    state.running = !state.running;
    if (state.running) {
      btn.textContent = '⏸ Pausar';
      state.timer = setInterval(() => stepAndRedraw(n), 40);
    } else {
      btn.textContent = '▶ Iniciar';
      clearInterval(state.timer);
    }
  }

  function stepOnce(n) {
    const state = getState(n);
    if (state.running) toggleRun(n);
    stepAndRedraw(n);
  }

  function resetModel(n) {
    const state = getState(n);
    if (state.running) toggleRun(n);
    if (n === 1) {
      resetModel1();
    } else if (n === 2) {
      resetModel2();
    } else {
      resetModel3();
    }
  }

  function getM1Params() {
    return {
      a: parseFloat(document.getElementById('m1_a').value),
      b: parseFloat(document.getElementById('m1_b').value),
      c: parseFloat(document.getElementById('m1_c').value),
      d: parseFloat(document.getElementById('m1_d').value),
      dt: parseFloat(document.getElementById('m1_dt').value)
    };
  }

  function resetModel1() {
    m1.C = parseFloat(document.getElementById('m1_C0').value);
    m1.Z = parseFloat(document.getElementById('m1_Z0').value);
    m1.t = 0;
    m1.history = { t: [m1.t], C: [m1.C], Z: [m1.Z] };
    m1.phase = [{ x: m1.C, y: m1.Z }];
    redrawM1();
    updateM1Labels();
  }

  function eulerStepM1() {
    const p = getM1Params();
    const dC = (p.a * m1.C - p.b * m1.C * m1.Z) * p.dt;
    const dZ = (p.c * m1.C * m1.Z - p.d * m1.Z) * p.dt;
    m1.C = Math.max(0, m1.C + dC);
    m1.Z = Math.max(0, m1.Z + dZ);
    m1.t += p.dt;
    m1.history.t.push(m1.t);
    m1.history.C.push(m1.C);
    m1.history.Z.push(m1.Z);
    m1.phase.push({ x: m1.C, y: m1.Z });
    if (m1.history.t.length > 4000) {
      m1.history.t.shift();
      m1.history.C.shift();
      m1.history.Z.shift();
      m1.phase.shift();
    }
    updateM1Labels();
  }

  function updateM1Labels() {
    const p = getM1Params();
    document.getElementById('m1_t').textContent = m1.t.toFixed(2);
    document.getElementById('m1_eqBox').innerHTML =
      `dC/dt = ${p.a}·${m1.C.toFixed(1)} − ${p.b}·${m1.C.toFixed(1)}·${m1.Z.toFixed(1)} = <b style="color:var(--rabbit)">${(p.a * m1.C - p.b * m1.C * m1.Z).toFixed(2)}</b><br>` +
      `dZ/dt = ${p.c}·${m1.C.toFixed(1)}·${m1.Z.toFixed(1)} − ${p.d}·${m1.Z.toFixed(1)} = <b style="color:var(--fox)">${(p.c * m1.C * m1.Z - p.d * m1.Z).toFixed(2)}</b>`;
  }

  function redrawM1() {
    m1ChartTime.data.labels = m1.history.t.map((v) => v.toFixed(1));
    m1ChartTime.data.datasets[0].data = m1.history.C;
    m1ChartTime.data.datasets[1].data = m1.history.Z;
    m1ChartTime.update('none');

    m1ChartPhase.data.datasets[0].data = m1.phase;
    m1ChartPhase.update('none');
  }

  function getM2Params() {
    return {
      N: parseFloat(document.getElementById('m2_N').value),
      beta: parseFloat(document.getElementById('m2_beta').value),
      gamma: parseFloat(document.getElementById('m2_gamma').value),
      dt: parseFloat(document.getElementById('m2_dt').value),
      sirs: document.getElementById('m2_sirs').checked,
      delta: parseFloat(document.getElementById('m2_delta').value)
    };
  }

  function toggleSirs() {
    const on = document.getElementById('m2_sirs').checked;
    document.getElementById('m2_deltaWrap').classList.toggle('hidden', !on);
    document.getElementById('m2_modeLabel').textContent = on ? 'Temporal (SIRS)' : 'Permanente (SIR)';
    document.getElementById('m2_loopBack').style.opacity = on ? 1 : 0;
    document.getElementById('m2_loopBackText').style.opacity = on ? 1 : 0;
    document.getElementById('m2_eqBox').innerHTML = on ?
      'dS/dt = −β·S·I/N + δ·R<br>dI/dt = β·S·I/N − γ·I<br>dR/dt = γ·I − δ·R' :
      'dS/dt = −β·S·I/N<br>dI/dt = β·S·I/N − γ·I<br>dR/dt = γ·I';
  }

  function resetModel2() {
    const N = parseFloat(document.getElementById('m2_N').value);
    const I0 = parseFloat(document.getElementById('m2_I0').value);
    m2.I = I0;
    m2.S = N - I0;
    m2.R = 0;
    m2.t = 0;
    m2.history = { t: [0], S: [m2.S], I: [m2.I], R: [m2.R] };
    redrawM2();
    updateM2Labels();
    updateR0();
  }

  function eulerStepM2() {
    const p = getM2Params();
    const infection = p.beta * m2.S * m2.I / p.N;
    const recovery = p.gamma * m2.I;
    const waning = p.sirs ? p.delta * m2.R : 0;

    const dS = (-infection + waning) * p.dt;
    const dI = (infection - recovery) * p.dt;
    const dR = (recovery - waning) * p.dt;

    m2.S = Math.max(0, m2.S + dS);
    m2.I = Math.max(0, m2.I + dI);
    m2.R = Math.max(0, m2.R + dR);
    m2.t += p.dt;

    m2.history.t.push(m2.t);
    m2.history.S.push(m2.S);
    m2.history.I.push(m2.I);
    m2.history.R.push(m2.R);
    if (m2.history.t.length > 4000) {
      m2.history.t.shift();
      m2.history.S.shift();
      m2.history.I.shift();
      m2.history.R.shift();
    }
    updateM2Labels();
  }

  function updateM2Labels() {
    document.getElementById('m2_t').textContent = m2.t.toFixed(2);
    document.getElementById('m2_Sval').textContent = m2.S.toFixed(0);
    document.getElementById('m2_Ival').textContent = m2.I.toFixed(0);
    document.getElementById('m2_Rval').textContent = m2.R.toFixed(0);
  }

  function updateR0() {
    const beta = parseFloat(document.getElementById('m2_beta').value);
    const gamma = parseFloat(document.getElementById('m2_gamma').value);
    const r0 = gamma > 0 ? (beta / gamma) : 0;
    document.getElementById('m2_r0').textContent = r0.toFixed(2);
  }

  function redrawM2() {
    m2ChartTime.data.labels = m2.history.t.map((v) => v.toFixed(1));
    m2ChartTime.data.datasets[0].data = m2.history.S;
    m2ChartTime.data.datasets[1].data = m2.history.I;
    m2ChartTime.data.datasets[2].data = m2.history.R;
    m2ChartTime.update('none');
  }

  function getM3Params() {
    return {
      a: parseFloat(document.getElementById('m3_a').value),
      e: parseFloat(document.getElementById('m3_e').value),
      dt: parseFloat(document.getElementById('m3_dt').value)
    };
  }

  function resetModel3() {
    m3.P = parseFloat(document.getElementById('m3_P0').value);
    m3.t = 0;
    m3.history = { t: [0], P: [m3.P] };
    redrawM3();
    updateM3Labels();
    updateNetRate();
  }

  function eulerStepM3() {
    const p = getM3Params();
    const nacimientos = m3.P * p.a;
    const defunciones = m3.P / p.e;
    m3.P = Math.max(0, m3.P + (nacimientos - defunciones) * p.dt);
    m3.t += p.dt;
    m3.history.t.push(m3.t);
    m3.history.P.push(m3.P);
    if (m3.history.t.length > 4000) {
      m3.history.t.shift();
      m3.history.P.shift();
    }
    updateM3Labels();
  }

  function updateM3Labels() {
    const p = getM3Params();
    const nacimientos = m3.P * p.a;
    const defunciones = m3.P / p.e;
    document.getElementById('m3_t').textContent = m3.t.toFixed(2);
    document.getElementById('m3_Pval').textContent = m3.P.toFixed(0);
    document.getElementById('m3_Bval').textContent = nacimientos.toFixed(1);
    document.getElementById('m3_Dval').textContent = defunciones.toFixed(1);
    document.getElementById('m3_eqBox').innerHTML =
      `Nacimientos = ${m3.P.toFixed(0)}·${p.a} = <b style="color:var(--birth)">${nacimientos.toFixed(2)}</b><br>` +
      `Defunciones = ${m3.P.toFixed(0)}/${p.e} = <b style="color:var(--death)">${defunciones.toFixed(2)}</b><br>` +
      `P(t+dt) = ${m3.P.toFixed(0)} + ${nacimientos.toFixed(1)} − ${defunciones.toFixed(1)}`;
  }

  function updateNetRate() {
    const a = parseFloat(document.getElementById('m3_a').value);
    const e = parseFloat(document.getElementById('m3_e').value);
    const net = a - (1 / e);
    document.getElementById('m3_netRate').textContent = `${(net * 100).toFixed(2)} %/sem`;
    document.getElementById('m3_double').textContent = net > 0 ? (Math.log(2) / Math.log(1 + net)).toFixed(1) : '∞';
  }

  function redrawM3() {
    m3ChartTime.data.labels = m3.history.t.map((v) => v.toFixed(1));
    m3ChartTime.data.datasets[0].data = m3.history.P;
    m3ChartTime.update('none');
  }

  function bootstrapCharts() {
    if (typeof Chart !== 'undefined') {
      initApp();
      return;
    }

    const loadScript = function (src, onLoad, onError) {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          onLoad && onLoad();
        } else {
          existing.addEventListener('load', onLoad, { once: true });
        }
        return;
      }

      const tag = document.createElement('script');
      tag.src = src;
      tag.async = false;
      tag.defer = true;
      tag.onload = function () {
        tag.dataset.loaded = 'true';
        onLoad && onLoad();
      };
      tag.onerror = function () {
        onError && onError();
      };
      document.head.appendChild(tag);
    };

    loadScript(
      'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
      function () {
        if (typeof Chart !== 'undefined') {
          initApp();
        } else {
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js', function () {
            if (typeof Chart !== 'undefined') {
              initApp();
            } else {
              document.body.innerHTML = '<div style="padding:40px;color:#e8636b;font-family:sans-serif">No se pudo cargar Chart.js desde la red. Verifica tu conexión a internet e intenta recargar la página.</div>';
            }
          }, function () {
            document.body.innerHTML = '<div style="padding:40px;color:#e8636b;font-family:sans-serif">No se pudo cargar Chart.js desde la red. Verifica tu conexión a internet e intenta recargar la página.</div>';
          });
        }
      },
      function () {
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js', function () {
          if (typeof Chart !== 'undefined') {
            initApp();
          } else {
            document.body.innerHTML = '<div style="padding:40px;color:#e8636b;font-family:sans-serif">No se pudo cargar Chart.js desde la red. Verifica tu conexión a internet e intenta recargar la página.</div>';
          }
        }, function () {
          document.body.innerHTML = '<div style="padding:40px;color:#e8636b;font-family:sans-serif">No se pudo cargar Chart.js desde la red. Verifica tu conexión a internet e intenta recargar la página.</div>';
        });
      }
    );
  }

  function initApp() {
    m1 = { C: 100, Z: 15, t: 0, running: false, timer: null, history: { t: [], C: [], Z: [] }, phase: [] };
    m2 = { S: 995, I: 5, R: 0, t: 0, running: false, timer: null, history: { t: [], S: [], I: [], R: [] } };
    m3 = { P: 1000, t: 0, running: false, timer: null, history: { t: [], P: [] } };

    m1ChartTime = new Chart(document.getElementById('m1_chartTime'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Conejos', data: [], borderColor: getCss('--rabbit'), backgroundColor: 'transparent', pointRadius: 0, tension: 0.1 },
          { label: 'Zorros', data: [], borderColor: getCss('--fox'), backgroundColor: 'transparent', pointRadius: 0, tension: 0.1 }
        ]
      },
      options: baseLineOptions('t', 'Población')
    });

    m1ChartPhase = new Chart(document.getElementById('m1_chartPhase'), {
      type: 'line',
      data: {
        datasets: [{ label: 'Trayectoria (Z vs C)', data: [], borderColor: getCss('--accent'), backgroundColor: 'transparent', pointRadius: 0, showLine: true, tension: 0 }]
      },
      options: baseLineOptions('Conejos (C)', 'Zorros (Z)', true)
    });

    m2ChartTime = new Chart(document.getElementById('m2_chartTime'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Susceptibles', data: [], borderColor: getCss('--susc'), backgroundColor: 'transparent', pointRadius: 0, tension: 0.1 },
          { label: 'Infectados', data: [], borderColor: getCss('--inf'), backgroundColor: 'transparent', pointRadius: 0, tension: 0.1 },
          { label: 'Recuperados', data: [], borderColor: getCss('--rec'), backgroundColor: 'transparent', pointRadius: 0, tension: 0.1 }
        ]
      },
      options: baseLineOptions('t', 'Personas')
    });

    m3ChartTime = new Chart(document.getElementById('m3_chartTime'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [{ label: 'Población', data: [], borderColor: getCss('--pop'), backgroundColor: 'transparent', pointRadius: 0, tension: 0.1 }]
      },
      options: baseLineOptions('t (semanas)', 'Individuos')
    });

    document.getElementById('m1_chartTime').parentElement.style.height = '220px';
    document.getElementById('m1_chartPhase').parentElement.style.height = '260px';
    document.getElementById('m2_chartTime').parentElement.style.height = '320px';
    document.getElementById('m3_chartTime').parentElement.style.height = '320px';

    if (window.innerWidth <= 480) {
      document.getElementById('m1_chartTime').parentElement.style.height = '180px';
      document.getElementById('m1_chartPhase').parentElement.style.height = '200px';
      document.getElementById('m2_chartTime').parentElement.style.height = '240px';
      document.getElementById('m3_chartTime').parentElement.style.height = '240px';
    }

    initTheme();
    refreshHistory();
    refreshAnalysis();
    resetModel1();
    resetModel2();
    resetModel3();
    updateR0();
  }

  window.syncSlider = syncSlider;
  window.syncNumber = syncNumber;
  window.switchTab = switchTab;
  window.toggleTheme = toggleTheme;
  window.toggleRun = toggleRun;
  window.stepOnce = stepOnce;
  window.resetModel = resetModel;
  window.toggleSirs = toggleSirs;
  window.saveCurrentRun = saveCurrentRun;
  window.clearHistory = clearHistory;
  window.selectHistoryRun = selectHistoryRun;
  window.requestAIInterpretation = requestAIInterpretation;
  window.bootstrapCharts = bootstrapCharts;

  window.addEventListener('DOMContentLoaded', bootstrapCharts);
}(window));
