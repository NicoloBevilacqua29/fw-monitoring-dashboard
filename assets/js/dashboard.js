const WS_GROUPS = {
  Bernina:   ["as008pwc","as009pwc","as010pwc","as011pwc"],
  Vimercate: ["as091pwc","as092pwc","as093pwc","as094pwc"]
};

const CDC_FILES = [
  "infa_cdc_cluster_CDC95",
  "infa_cdc_cluster_CDC96",
  "infa_cdc_cluster_CDC102"
];

const VERSION_LABELS = {
  CDC95:  "Informatica 9.5",
  CDC96:  "Informatica 9.6",
  CDC102: "Informatica 10.2 HotFix"
};

const BASE = (() => {
  const p = location.pathname.replace(/\/[^/]*$/, '/');
  return location.origin + p;
})();

// ── Helpers ──────────────────────────────────────────────────────────────────

function svcClass(s) {
  if (s === "UP" || s === "RUNNING") return "svc-up";
  if (s === "WARNING" || s === "STARTING" || s === "RUNNING_RECENT") return "svc-warn";
  return "svc-down";
}

function ringClass(s) {
  if (s === "UP")      return "ring-up";
  if (s === "WARNING") return "ring-warn";
  return "ring-down";
}

function wsStatus(srv) {
  return (srv.informatica_process_status === "UP" &&
          srv.services.every(x => x.status === "UP")) ? "UP" : "DOWN";
}

function cdcStatus(c) { return c.cluster_status || "DOWN"; }

async function loadJSON(path) {
  try {
    const r = await fetch(new URL(path, BASE));
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

function createSection(title, count) {
  const s = document.createElement("section");
  s.className = "site-section";
  s.innerHTML = `
    <div class="section-header">
      <span class="section-label">${title}</span>
      <div class="section-line"></div>
      <span class="section-count">${count}</span>
    </div>
    <div class="grid"></div>`;
  return s;
}

function addCard(grid, html) {
  const w = document.createElement("div");
  w.innerHTML = html;
  const c = w.firstElementChild;
  c.onclick = () => c.classList.toggle("open");
  grid.appendChild(c);
}

// ── Render WS ─────────────────────────────────────────────────────────────────

function renderWS(srv) {
  const status = wsStatus(srv);
  const up = srv.services.filter(x => x.status === "UP").length;
  const total = srv.services.length;
  const services = srv.services.map(s => `
    <div class="service-row">
      <span>${s.port}</span>
      <span>${s.protocol}</span>
      <span class="svc-badge ${svcClass(s.status)}">${s.status}</span>
      <a class="svc-link" href="${s.url}" target="_blank" onclick="event.stopPropagation()">Test URL</a>
    </div>`).join("");

  return `
  <div class="card ${status !== "UP" ? "is-down" : ""}">
    <div class="card-collapsed">
      <div class="card-left">
        <div class="status-ring ${ringClass(status)}">${status === "UP" ? "↑" : "↓"}</div>
        <div>
          <div class="server-name">${srv.host}</div>
          <div class="server-domain">${srv.domain}</div>
        </div>
      </div>
      <div class="card-right">
        <div class="ports-pill">${up}/${total} porte</div>
        <div class="chevron">⌄</div>
      </div>
    </div>
    <div class="card-details">
      <div class="meta-row">
        <div class="meta-chip">SSH <span>${srv.ssh_status}</span></div>
        <div class="meta-chip">Informatica <span>${srv.informatica_process_status}</span></div>
      </div>
      <div class="services-list">${services}</div>
      <div class="timestamp">${srv.timestamp}</div>
    </div>
  </div>`;
}

// ── Render CDC ────────────────────────────────────────────────────────────────

function renderCDC(cluster) {
  const status = cdcStatus(cluster);

  const catChips = Object.entries(cluster.catalina || {}).map(([host, info]) => `
    <div class="meta-chip">
      Catalina <b style="margin-left:4px">${host}</b>
      <span class="svc-badge ${info.status === "UP" ? "svc-up" : "svc-down"}" style="margin-left:6px">${info.status}</span>
    </div>`).join("");

  const rows = (cluster.cdc || []).map(c => {
    const hostLabel = !c.running_host ? "—"
      : c.running_host === "BOTH" ? `<span style="color:var(--yellow)">⚠ BOTH</span>`
      : c.running_host;
    return `
      <div class="cdc-row">
        <div style="font-family:monospace;font-size:12px;word-break:break-all">${c.name}</div>
        <span class="svc-badge ${c.status === "RUNNING" ? "svc-up" : "svc-down"}">${c.status}</span>
        <div style="font-size:12px;color:var(--muted)">${hostLabel}</div>
        <div style="font-size:12px;color:var(--muted)">PID&nbsp;${c.pid ?? "—"}</div>
      </div>`;
  }).join("");

  const icon = status === "UP" ? "↑" : status === "WARNING" ? "!" : "↓";
  return `
  <div class="card ${status !== "UP" ? "is-down" : ""}">
    <div class="card-collapsed">
      <div class="card-left">
        <div class="status-ring ${ringClass(status)}">${icon}</div>
        <div>
          <div class="server-name">${cluster.cluster} <small style="font-weight:400;color:var(--muted)">v${cluster.version}</small></div>
          <div class="server-domain">${cluster.primary} / ${cluster.secondary}</div>
        </div>
      </div>
      <div class="card-right">
        <div class="ports-pill">${cluster.cdc_running}/${cluster.cdc_total} CDC</div>
        <div class="chevron">⌄</div>
      </div>
    </div>
    <div class="card-details">
      <div class="meta-row">${catChips}</div>
      <div class="services-list">${rows}</div>
      <div class="timestamp">${cluster.timestamp}</div>
    </div>
  </div>`;
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function startClock() {
  const el = document.getElementById("header-time");
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleString("it-IT"); };
  tick(); setInterval(tick, 1000);
}

// ── Alert helpers ─────────────────────────────────────────────────────────────

function setupAlerts(alerts) {
  if (!alerts.length) return;
  const dot = document.getElementById("header-dot");
  const banner = document.getElementById("alert-banner");
  const ul = document.getElementById("alert-list");
  if (dot) dot.classList.add("has-down");
  if (banner) banner.classList.add("visible");
  if (ul) alerts.forEach(a => {
    const li = document.createElement("li");
    li.textContent = a;
    ul.appendChild(li);
  });
  const btn = document.getElementById("alert-dismiss");
  if (btn) btn.onclick = () => banner.remove();
}

// ── Page: homepage (summary cards) ───────────────────────────────────────────

async function initHome() {
  const wsFiles = ["as008pwc","as009pwc","as010pwc","as011pwc",
                   "as091pwc","as092pwc","as093pwc","as094pwc"];

  const [wsData, cdcData] = await Promise.all([
    Promise.all(wsFiles.map(h => loadJSON(`data/infa_ws_status_${h}.json`))).then(r => r.filter(Boolean)),
    Promise.all(CDC_FILES.map(f => loadJSON(`data/${f}.json`))).then(r => r.filter(Boolean))
  ]);

  // Calcola stato globale WS
  const wsDown    = wsData.filter(x => wsStatus(x) !== "UP");
  const wsTotal   = wsData.length;
  const wsOkCount = wsTotal - wsDown.length;
  const wsGlobal  = wsDown.length === 0 ? "up" : "down";
  const wsServers = wsTotal;
  const wsPorts   = wsData.reduce((a, s) => a + s.services.length, 0);
  const wsPortsOk = wsData.reduce((a, s) => a + s.services.filter(p => p.status === "UP").length, 0);

  // Calcola stato globale CDC
  const cdcDown    = cdcData.filter(x => cdcStatus(x) !== "UP");
  const cdcGlobal  = cdcDown.length === 0 ? "up" : cdcDown.some(x => x.cluster_status === "DOWN") ? "down" : "warn";
  const cdcTotalWf = cdcData.reduce((a, c) => a + c.cdc_total, 0);
  const cdcRunWf   = cdcData.reduce((a, c) => a + c.cdc_running, 0);
  const cdcStopWf  = cdcData.reduce((a, c) => a + c.cdc_stopped, 0);

  const wsLabel  = wsGlobal === "up"  ? "Operativo" : "Anomalia rilevata";
  const cdcLabel = cdcGlobal === "up" ? "Operativo" : cdcGlobal === "warn" ? "Attenzione" : "Anomalia rilevata";

  const wsDesc  = wsGlobal === "up"
    ? `Tutti i ${wsServers} server Informatica WebServiceHub sono raggiungibili e rispondono correttamente su tutte le porte monitorate.`
    : `${wsDown.length} server su ${wsServers} presenta anomalie. Verificare le porte e il processo Informatica.`;

  const cdcDesc = cdcGlobal === "up"
    ? `Tutti i ${cdcTotalWf} workflow Change Data Capture sono in esecuzione sui cluster Informatica 9.5, 9.6 e 10.2.`
    : `${cdcStopWf} workflow su ${cdcTotalWf} risultano fermi. Verificare lo stato dei cluster CDC.`;

  const wsIconMap  = { up: "✦", down: "✕" };
  const cdcIconMap = { up: "✦", down: "✕", warn: "!" };

  const grid = document.getElementById("summary-grid");
  grid.innerHTML = `
    <a class="summary-card status-${wsGlobal}" href="ws.html">
      <div class="sc-top">
        <div class="sc-icon ${wsGlobal}">${wsIconMap[wsGlobal]}</div>
        <span class="sc-badge ${wsGlobal}">${wsLabel}</span>
      </div>
      <div class="sc-title">WebServiceHub Monitoring</div>
      <div class="sc-desc">${wsDesc}</div>
      <div class="sc-stats">
        <div class="sc-stat">Server <strong>${wsOkCount}/${wsServers}</strong></div>
        <div class="sc-stat">Porte attive <strong>${wsPortsOk}/${wsPorts}</strong></div>
        ${wsDown.length > 0 ? `<div class="sc-stat" style="color:var(--red)">KO <strong>${wsDown.length}</strong></div>` : ""}
      </div>
      <div class="sc-cta">Visualizza dettagli <span class="sc-arrow">→</span></div>
    </a>

    <a class="summary-card status-${cdcGlobal}" href="cdc.html">
      <div class="sc-top">
        <div class="sc-icon ${cdcGlobal}">${cdcIconMap[cdcGlobal]}</div>
        <span class="sc-badge ${cdcGlobal}">${cdcLabel}</span>
      </div>
      <div class="sc-title">CDC Monitoring</div>
      <div class="sc-desc">${cdcDesc}</div>
      <div class="sc-stats">
        <div class="sc-stat">Workflow attivi <strong>${cdcRunWf}/${cdcTotalWf}</strong></div>
        <div class="sc-stat">Cluster <strong>${cdcData.length}/3</strong></div>
        ${cdcStopWf > 0 ? `<div class="sc-stat" style="color:var(--red)">KO <strong>${cdcStopWf}</strong></div>` : ""}
      </div>
      <div class="sc-cta">Visualizza dettagli <span class="sc-arrow">→</span></div>
    </a>`;

  // Dot header
  const dot = document.getElementById("header-dot");
  if (wsGlobal !== "up" || cdcGlobal !== "up") dot && dot.classList.add("has-down");

  document.getElementById("footer").textContent =
    "Dashboard aggiornata automaticamente da Outlook + GitHub";
}

// ── Page: WebServiceHub detail ────────────────────────────────────────────────

async function initWS() {
  const wsFiles = ["as008pwc","as009pwc","as010pwc","as011pwc",
                   "as091pwc","as092pwc","as093pwc","as094pwc"];
  const wsData = (await Promise.all(wsFiles.map(h => loadJSON(`data/infa_ws_status_${h}.json`)))).filter(Boolean);

  const alerts = wsData.filter(x => wsStatus(x) !== "UP").map(x => `${x.host} — porta/processo KO`);
  setupAlerts(alerts);

  const container = document.getElementById("ws-dashboard");
  Object.entries(WS_GROUPS).forEach(([name, hosts]) => {
    const servers = wsData.filter(x => hosts.includes(x.host));
    const section = createSection(name, `${servers.length} server`);
    const grid = section.querySelector(".grid");
    servers.forEach(s => addCard(grid, renderWS(s)));
    container.appendChild(section);
  });

  document.getElementById("footer").textContent =
    "Dashboard aggiornata automaticamente da Outlook + GitHub";
}

// ── Page: CDC detail ──────────────────────────────────────────────────────────

async function initCDC() {
  const cdcData = (await Promise.all(CDC_FILES.map(f => loadJSON(`data/${f}.json`)))).filter(Boolean);

  const alerts = cdcData.filter(x => cdcStatus(x) !== "UP")
    .map(x => `${x.cluster} — ${x.cdc_stopped} workflow KO`);
  setupAlerts(alerts);

  const container = document.getElementById("cdc-dashboard");
  CDC_FILES.forEach(fileName => {
    const clusterName = fileName.replace("infa_cdc_cluster_", "");
    const cluster = cdcData.find(d => d.cluster === clusterName);
    if (!cluster) return;
    const label = VERSION_LABELS[clusterName] || clusterName;
    const section = createSection(label, `${cluster.cdc_running}/${cluster.cdc_total} CDC running`);
    const grid = section.querySelector(".grid");
    addCard(grid, renderCDC(cluster));
    container.appendChild(section);
  });

  document.getElementById("footer").textContent =
    "Dashboard aggiornata automaticamente da Outlook + GitHub";
}

// ── Router ────────────────────────────────────────────────────────────────────

startClock();

const page = location.pathname.split("/").pop() || "index.html";
if      (page === "ws.html")  initWS();
else if (page === "cdc.html") initCDC();
else                          initHome();
