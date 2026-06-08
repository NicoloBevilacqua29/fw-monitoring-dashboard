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

function icon(name) {
  return `<i data-lucide="${name}" aria-hidden="true"></i>`;
}

// ── Helpers ─────────────────────────

function statusIcon(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "UP" || normalized === "RUNNING") {
    return icon("circle-check");
  }

  if (
    normalized === "WARNING" ||
    normalized === "STARTING" ||
    normalized === "RUNNING_RECENT"
  ) {
    return icon("triangle-alert");
  }

  return icon("circle-x");
}


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

function isNodeRecentlyStarted(node) {
  if (!node || node.status !== "UP") return false;

  const days = Number(node.uptime_days);
  const hours = Number(node.uptime_hours);
  const minutes = Number(node.uptime_minutes);

  if ([days, hours, minutes].every(Number.isFinite)) {
    return (days * 24 * 60 + hours * 60 + minutes) < 24 * 60;
  }

  return false;
}

function hasRecentDBRestart(db) {
  if (!db) return false;
  if (String(db.restarted_last_24h || "").toUpperCase() === "YES") return true;
  return (db.nodes || []).some(isNodeRecentlyStarted);
}

function dbStatus(db) {
  if (!db) return "DOWN";

  const nodesUp = Number(db.nodes_up);
  const expectedNodes = Number(db.expected_nodes);

  if (db.cluster_status === "OK" && nodesUp === expectedNodes) {
    return hasRecentDBRestart(db) ? "WARNING" : "UP";
  }

  if (nodesUp > 0) return "WARNING";
  return "DOWN";
}

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
        <div class="status-ring ${ringClass(status)}">${statusIcon(status)}</div>
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
        <div class="status-ring ${ringClass(status)}">${statusIcon(status)}</div>
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


// ── Render DB EDH ─────────────────────────────────────────────────────────────

function formatUptime(node) {
  if (!node || node.status !== "UP") return "—";
  const d = node.uptime_days ?? 0;
  const h = node.uptime_hours ?? 0;
  const m = node.uptime_minutes ?? 0;
  return `${d}g ${h}h ${m}m`;
}

function nodeRingClass(status, recent) {
  if (recent) return "ring-warn";
  return status === "UP" ? "ring-up" : "ring-down";
}

function nodeVisualStatus(node) {
  if (!node || node.status !== "UP") return "DOWN";
  return isNodeRecentlyStarted(node) ? "RUNNING_RECENT" : "UP";
}

function renderDB(db) {
  const status = dbStatus(db);
  const icon = status === "UP" ? "↑" : status === "WARNING" ? "!" : "↓";
  const cardClass = status === "UP" ? "" : status === "WARNING" ? "is-warn" : "is-down";

  // Nuovo formato JSON: nodes[]
  // Compatibilità: se esiste ancora il vecchio hosts[], lo trasformo in nodes[] base.
  const nodes = (db.nodes && Array.isArray(db.nodes) && db.nodes.length)
    ? db.nodes
    : (db.hosts || []).map(host => ({
        host,
        instance: "",
        status: "UP",
        startup_time: null,
        uptime_days: null,
        uptime_hours: null,
        uptime_minutes: null
      }));

  const nodeRows = nodes.map(node => {
    const recent = isNodeRecentlyStarted(node);
    const visualStatus = nodeVisualStatus(node);
    const isDown = visualStatus === "DOWN";
    const rowClass = isDown ? "is-node-down" : recent ? "is-node-warn" : "";
    const nodeIcon = isDown ? "↓" : recent ? "!" : "↑";
    const badgeClass = isDown ? "svc-down" : recent ? "svc-warn" : "svc-up";
    const badgeText = recent ? "RECENTE" : visualStatus;

    return `
      <div class="edh-node-row ${rowClass}">
        <div class="status-ring ${nodeRingClass(node.status, recent)}">${statusIcon(visualStatus)}</div>

        <div>
          <div class="server-name">${node.host || "Host non disponibile"}</div>
          <div class="server-domain">${node.instance || "Istanza non disponibile"}</div>
        </div>

        <span class="svc-badge ${badgeClass}">${badgeText}</span>

        <div>
          <div class="edh-label">Startup</div>
          <div class="edh-value">${node.startup_time || "—"}</div>
        </div>

        <div>
          <div class="edh-label">Uptime</div>
          <div class="edh-value">${formatUptime(node)}</div>
        </div>
      </div>`;
  }).join("");

  return `
  <div class="card ${cardClass}">
    <div class="card-collapsed">
      <div class="card-left">
        <div class="status-ring ${ringClass(status)}">${statusIcon(status)}</div>
        <div>
          <div class="server-name">${db.service || "DB EDH"}</div>
          <div class="server-domain">Cluster EDH database monitoring</div>
        </div>
      </div>
      <div class="card-right">
        <div class="ports-pill">${db.nodes_up ?? "—"}/${db.expected_nodes ?? "—"} nodi</div>
        <div class="chevron">⌄</div>
      </div>
    </div>
    <div class="card-details">
      <div class="meta-row">
        <div class="meta-chip">Cluster <span>${db.cluster_status || "N/D"}</span></div>
        <div class="meta-chip">Restart 24h <span>${db.restarted_last_24h || "N/D"}</span></div>
        <div class="meta-chip">Check <span>${db.check_time || "N/D"}</span></div>
      </div>
      <div class="services-list">${nodeRows}</div>
      <div class="timestamp">${db.check_time || "Timestamp non disponibile"}</div>
    </div>
  </div>`;
}

// ── Render Agents ─────────────────────────────────────────────────────────────

function agentStatus(agent) {
  if (!agent.active) return "DOWN";
  if (!agent.readyToRun) return "WARNING";
  return "UP";
}

function agentGlobalStatus(agents) {
  if (!agents || agents.length === 0) return "DOWN";
  const statuses = agents.map(agentStatus);
  if (statuses.every(s => s === "UP")) return "UP";
  if (statuses.some(s => s === "DOWN")) return "DOWN";
  return "WARNING";
}

function formatAgentDate(isoStr) {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleString("it-IT");
  } catch { return isoStr; }
}

function renderAgent(agent) {
  const status = agentStatus(agent);
  const cardClass = status === "UP" ? "" : status === "WARNING" ? "is-warn" : "is-down";
  const icon = status === "UP" ? "↑" : status === "WARNING" ? "!" : "↓";
  const badgeClass = status === "UP" ? "svc-up" : status === "WARNING" ? "svc-warn" : "svc-down";
  const badgeLabel = status === "UP" ? "ATTIVO" : status === "WARNING" ? "NON PRONTO" : "INATTIVO";

  return `
  <div class="card ${cardClass}">
    <div class="card-collapsed">
      <div class="card-left">
        <div class="status-ring ${ringClass(status)}">${statusIcon(status)}</div>
        <div>
          <div class="server-name">${agent.name || agent.agentHost || "Agent"}</div>
          <div class="server-domain">${agent.agentHost || "—"}</div>
        </div>
      </div>
      <div class="card-right">
        <span class="svc-badge ${badgeClass}" style="font-size:11px">${badgeLabel}</span>
        <div class="chevron">⌄</div>
      </div>
    </div>
    <div class="card-details">
      <div class="meta-row">
        <div class="meta-chip">Versione <span>${agent.agentVersion || "—"}</span></div>
        <div class="meta-chip">Platform <span>${agent.platform || "—"}</span></div>
        <div class="meta-chip">Upgrade <span>${agent.upgradeStatus || "—"}</span></div>
      </div>
      <div class="meta-row">
        <div class="meta-chip">Ultimo check <span>${formatAgentDate(agent.lastUpgradeCheck)}</span></div>
        <div class="meta-chip">Ultimo cambio stato <span>${formatAgentDate(agent.lastStatusChange)}</span></div>
      </div>
      <div class="timestamp">Aggiornato: ${formatAgentDate(agent.updateTime)}</div>
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

  const [wsData, cdcData, dbData, agentsRaw] = await Promise.all([
    Promise.all(wsFiles.map(h => loadJSON(`data/infa_ws_status_${h}.json`))).then(r => r.filter(Boolean)),
    Promise.all(CDC_FILES.map(f => loadJSON(`data/${f}.json`))).then(r => r.filter(Boolean)),
    loadJSON("data/db_monitoring.json"),
    loadJSON("data/report_finale.json")
  ]);

  // Il JSON degli agent può essere un array o un oggetto singolo
  const agentsData = Array.isArray(agentsRaw) ? agentsRaw : (agentsRaw ? [agentsRaw] : null);

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

  // Calcola stato globale DB EDH
  const dbRawStatus = dbStatus(dbData);
  const dbGlobal = dbRawStatus === "UP" ? "up" : dbRawStatus === "WARNING" ? "warn" : "down";

  // Calcola stato globale Agent
  const agentRawStatus = agentGlobalStatus(agentsData);
  const agentGlobal = agentRawStatus === "UP" ? "up" : agentRawStatus === "WARNING" ? "warn" : "down";
  const agentActiveCount = agentsData ? agentsData.filter(a => agentStatus(a) === "UP").length : 0;
  const agentTotal = agentsData ? agentsData.length : 0;

  const wsLabel  = wsGlobal === "up"  ? "Operativo" : "Anomalia rilevata";
  const cdcLabel = cdcGlobal === "up" ? "Operativo" : cdcGlobal === "warn" ? "Attenzione" : "Anomalia rilevata";
  const dbLabel  = dbGlobal === "up"  ? "Operativo" : dbGlobal === "warn" ? "Attenzione" : "Anomalia rilevata";
  const agentLabel = agentGlobal === "up" ? "Operativo" : agentGlobal === "warn" ? "Attenzione" : !agentsData ? "Dati non disponibili" : "Anomalia rilevata";

  const wsDesc  = wsGlobal === "up"
    ? `Tutti i ${wsServers} server Informatica WebServiceHub sono raggiungibili e rispondono correttamente su tutte le porte monitorate.`
    : `${wsDown.length} server su ${wsServers} presenta anomalie. Verificare le porte e il processo Informatica.`;

  const cdcDesc = cdcGlobal === "up"
    ? `Tutti i ${cdcTotalWf} workflow Change Data Capture sono in esecuzione sui cluster Informatica 9.5, 9.6 e 10.2.`
    : `${cdcStopWf} workflow su ${cdcTotalWf} risultano fermi. Verificare lo stato dei cluster CDC.`;

  const recentNodes = (dbData?.nodes || []).filter(isNodeRecentlyStarted);

  const agentDesc = !agentsData
    ? "Dati Agent non disponibili. Verificare la presenza del file data/report_finale.json."
    : agentGlobal === "up"
      ? `Tutti i ${agentTotal} agent Informatica Cloud sono attivi e pronti all'esecuzione.`
      : `${agentTotal - agentActiveCount} agent su ${agentTotal} presentano anomalie. Verificare lo stato degli agent.`;

  const dbDesc = !dbData
    ? "Dati DB EDH non disponibili. Verificare la presenza del file data/db_monitoring.json."
    : dbGlobal === "up"
      ? `Cluster ${dbData.service} operativo: ${dbData.nodes_up}/${dbData.expected_nodes} nodi attivi. Nessun riavvio rilevato nelle ultime 24h.`
      : recentNodes.length > 0 && Number(dbData.nodes_up) === Number(dbData.expected_nodes)
        ? `Cluster ${dbData.service} operativo ma ${recentNodes.length} nodo/i risultano avviati da meno di 24h.`
        : `Cluster ${dbData.service || "DB EDH"} in anomalia: ${dbData.nodes_up ?? "—"}/${dbData.expected_nodes ?? "—"} nodi attivi. Verificare lo stato database.`;

  const dashboardIconMap = {
  ws: icon("server"),
  cdc: icon("git-branch"),
  db: icon("database"),
  agent: icon("cloud-cog")
};

  const grid = document.getElementById("summary-grid");
  grid.innerHTML = `
    <a class="summary-card status-${wsGlobal}" data-dashboard="ws" href="ws.html">
      <div class="sc-top">
        <div class="sc-icon ${wsGlobal}">${dashboardIconMap.ws}</div>
        <span class="sc-badge ${wsGlobal}">${wsLabel}</span>
      </div>
      <div class="sc-title">Catalina & WebServiceHub</div>
      <div class="sc-desc">${wsDesc}</div>
      <div class="sc-stats">
        <div class="sc-stat">Server <strong>${wsOkCount}/${wsServers}</strong></div>
        <div class="sc-stat">Porte attive <strong>${wsPortsOk}/${wsPorts}</strong></div>
        ${wsDown.length > 0 ? `<div class="sc-stat" style="color:var(--red)">KO <strong>${wsDown.length}</strong></div>` : ""}
      </div>
      <div class="sc-cta">Visualizza dettagli <span class="sc-arrow">→</span></div>
    </a>

    <a class="summary-card status-${cdcGlobal}" data-dashboard="cdc" href="cdc.html">
      <div class="sc-top">
        <div class="sc-icon ${cdcGlobal}">${dashboardIconMap.cdc}</div>
        <span class="sc-badge ${cdcGlobal}">${cdcLabel}</span>
      </div>
      <div class="sc-title">Catalina & CDC</div>
      <div class="sc-desc">${cdcDesc}</div>
      <div class="sc-stats">
        <div class="sc-stat">Workflow attivi <strong>${cdcRunWf}/${cdcTotalWf}</strong></div>
        <div class="sc-stat">Cluster <strong>${cdcData.length}/3</strong></div>
        ${cdcStopWf > 0 ? `<div class="sc-stat" style="color:var(--red)">KO <strong>${cdcStopWf}</strong></div>` : ""}
      </div>
      <div class="sc-cta">Visualizza dettagli <span class="sc-arrow">→</span></div>
    </a>

    <a class="summary-card status-${dbGlobal}" data-dashboard="db" href="db.html">
      <div class="sc-top">
        <div class="sc-icon ${dbGlobal}">${dashboardIconMap.db}</div>
        <span class="sc-badge ${dbGlobal}">${dbLabel}</span>
      </div>
      <div class="sc-title">EDH Node Status</div>
      <div class="sc-desc">${dbDesc}</div>
      <div class="sc-stats">
        <div class="sc-stat">Nodi attivi <strong>${dbData?.nodes_up ?? "—"}/${dbData?.expected_nodes ?? "—"}</strong></div>
        <div class="sc-stat">Cluster <strong>${dbData?.cluster_status ?? "N/D"}</strong></div>
        <div class="sc-stat">Restart 24h <strong>${dbData?.restarted_last_24h ?? "N/D"}</strong></div>
      </div>
      <div class="sc-cta">Visualizza dettagli <span class="sc-arrow">→</span></div>
    </a>

    <a class="summary-card status-${agentGlobal}" data-dashboard="agent" href="agents.html">
      <div class="sc-top">
        <div class="sc-icon ${agentGlobal}">${dashboardIconMap.agent}</div>
        <span class="sc-badge ${agentGlobal}">${agentLabel}</span>
      </div>
      <div class="sc-title">Informatica Cloud Agent</div>
      <div class="sc-desc">${agentDesc}</div>
      <div class="sc-stats">
        <div class="sc-stat">Agent attivi <strong>${agentActiveCount}/${agentTotal}</strong></div>
        ${agentsData ? `<div class="sc-stat">Versione <strong>${agentsData[0]?.agentVersion ?? "—"}</strong></div>` : ""}
        ${agentTotal - agentActiveCount > 0 ? `<div class="sc-stat" style="color:var(--red)">KO <strong>${agentTotal - agentActiveCount}</strong></div>` : ""}
      </div>
      <div class="sc-cta">Visualizza dettagli <span class="sc-arrow">→</span></div>
    </a>`;

refreshIcons();

  // Dot header
  const dot = document.getElementById("header-dot");
  if (wsGlobal !== "up" || cdcGlobal !== "up" || dbGlobal !== "up" || agentGlobal !== "up") dot && dot.classList.add("has-down");

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

    refreshIcons();
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

    refreshIcons();
}


// ── Page: DB EDH detail ───────────────────────────────────────────────────────

async function initDB() {
  const dbData = await loadJSON("data/db_monitoring.json");
  const status = dbStatus(dbData);

  const alerts = [];
  if (!dbData) {
    alerts.push("DB EDH — file data/db_monitoring.json non disponibile");
  } else {
    const downNodes = (dbData.nodes || []).filter(node => node.status !== "UP");
    const recentNodes = (dbData.nodes || []).filter(isNodeRecentlyStarted);

    if (status !== "UP") {
      alerts.push(`${dbData.service || "DB EDH"} — ${dbData.nodes_up ?? "—"}/${dbData.expected_nodes ?? "—"} nodi attivi`);
    }

    downNodes.forEach(node => alerts.push(`${node.host || "Nodo EDH"} — DOWN`));
    recentNodes.forEach(node => alerts.push(`${node.host || "Nodo EDH"} — running da poco: uptime ${formatUptime(node)}`));
  }
  setupAlerts(alerts);

  const container = document.getElementById("db-dashboard");
  if (!container) return;

  if (!dbData) {
    const section = createSection("EDH", "dati non disponibili");
    section.querySelector(".grid").innerHTML = `
      <div class="card is-down">
        <div class="card-collapsed">
          <div class="card-left">
            <div class="status-ring ring-down">${statusIcon("DOWN")}</div>
            <div>
              <div class="server-name">DB EDH</div>
              <div class="server-domain">File data/db_monitoring.json non trovato</div>
            </div>
          </div>
        </div>
      </div>`;
    container.appendChild(section);
    return;
  }

  const section = createSection("EDH", `${dbData.nodes_up}/${dbData.expected_nodes} nodi attivi`);
  const grid = section.querySelector(".grid");
  addCard(grid, renderDB(dbData));
  container.appendChild(section);

  document.getElementById("footer").textContent =
    "Dashboard aggiornata automaticamente da Outlook + GitHub";

    refreshIcons();
}



// ── Page: Informatica Cloud Agent detail ──────────────────────────────────────

async function initAgents() {
  const raw = await loadJSON("data/report_finale.json");
  const agentsData = Array.isArray(raw) ? raw : (raw ? [raw] : null);
  const status = agentGlobalStatus(agentsData);

  const alerts = [];
  if (!agentsData) {
    alerts.push("Agent — file data/report_finale.json non disponibile");
  } else {
    agentsData.filter(a => agentStatus(a) !== "UP").forEach(a =>
      alerts.push(`${a.name || a.agentHost} — ${agentStatus(a)}`)
    );
  }
  setupAlerts(alerts);

  const container = document.getElementById("agents-dashboard");
  if (!container) return;

  if (!agentsData) {
    const section = createSection("AGENT", "dati non disponibili");
    section.querySelector(".grid").innerHTML = `
      <div class="card is-down">
        <div class="card-collapsed">
          <div class="card-left">
            <div class="status-ring ring-down">${statusIcon("DOWN")}</div>
            <div>
              <div class="server-name">Informatica Cloud Agent</div>
              <div class="server-domain">File data/report_finale.json non trovato</div>
            </div>
          </div>
        </div>
      </div>`;
    container.appendChild(section);
    return;
  }

  const activeCount = agentsData.filter(a => agentStatus(a) === "UP").length;
  const section = createSection("AGENT", `${activeCount}/${agentsData.length} attivi`);
  const grid = section.querySelector(".grid");
  agentsData.forEach(a => addCard(grid, renderAgent(a)));
  container.appendChild(section);

  document.getElementById("footer").textContent =
    "Dashboard aggiornata automaticamente da Outlook + GitHub";

    refreshIcons();
}


// ── Command console ───────────────────────────────────────────────────────────

const API_BASE = window.DASHBOARD_API_BASE || "http://127.0.0.1:5000";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderCommandTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `<div class="command-empty">Nessun risultato trovato.</div>`;
  }

  const columns = Object.keys(rows[0]);

  return `
    <table class="command-table">
      <thead>
        <tr>${columns.map(c => `<th>${escapeHTML(c)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${columns.map(c => `<td>${escapeHTML(row[c])}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function setCommandResult(title, bodyHTML) {
  const result = document.getElementById("command-result");
  if (!result) return;

  result.hidden = false;
  result.innerHTML = `
    <div class="command-result-header">
      <span>${escapeHTML(title)}</span>
      <span>${new Date().toLocaleTimeString("it-IT")}</span>
    </div>
    <div class="command-result-body">${bodyHTML}</div>`;
}

async function runDashboardCommand(command) {
  setCommandResult("Esecuzione comando", `<div class="command-empty">Interrogo il backend...</div>`);

  try {
    const response = await fetch(`${API_BASE}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command })
    });

    const payload = await response.json();

    if (!response.ok || payload.ok === false) {
      setCommandResult("Errore", `<div class="command-error">${escapeHTML(payload.error || "Comando non eseguito")}</div>`);
      return;
    }

    setCommandResult(
      `Risultato: ${payload.command || command}`,
      renderCommandTable(payload.data)
    );
  } catch (error) {
    setCommandResult(
      "Backend non raggiungibile",
      `<div class="command-error">Impossibile contattare ${escapeHTML(API_BASE)}. Verifica che Flask sia avviato.</div>`
    );
  }
}

function setupCommandConsole() {
  const form = document.getElementById("command-form");
  const input = document.getElementById("command-input");
  const chips = document.querySelectorAll("[data-command]");

  if (!form || !input) return;

  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.command || "";
      input.focus();
    });
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const command = input.value.trim();

    if (!command) {
      setCommandResult("Comando vuoto", `<div class="command-error">Inserisci un comando, ad esempio: stato edh</div>`);
      return;
    }

    runDashboardCommand(command);
  });
}

function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}


function initQuery() {
  const footer = document.getElementById("footer");
  if (footer) {
    footer.textContent = "Console query collegata al backend locale Python";
  }
  refreshIcons();
}

// ── Router ────────────────────────────────────────────────────────────────────

startClock();
setupCommandConsole();

const page = location.pathname.split("/").pop() || "index.html";
if      (page === "ws.html")     initWS();
else if (page === "cdc.html")    initCDC();
else if (page === "db.html")     initDB();
else if (page === "agents.html") initAgents();
else if (page === "query.html")  initQuery();
else                             initHome();
