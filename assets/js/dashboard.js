const WS_GROUPS = {
  Bernina: ["as008pwc","as009pwc","as010pwc","as011pwc"],
  Vimercate: ["as091pwc","as092pwc","as093pwc","as094pwc"]
};

// File JSON CDC prodotti dalla sh (uno per cluster)
const CDC_FILES = [
  "infa_cdc_cluster_CDC95",
  "infa_cdc_cluster_CDC96",
  "infa_cdc_cluster_CDC102"
];

// Label da mostrare nella dashboard per ogni cluster
const VERSION_LABELS = {
  "CDC95":  "Informatica 9.5",
  "CDC96":  "Informatica 9.6",
  "CDC102": "Informatica 10.2 HotFix"
};

// Base path per i JSON (funziona sia in locale che su GitHub Pages)
const BASE = (() => {
  const p = location.pathname.replace(/\/[^/]*$/, '/');
  return location.origin + p;
})();

// ── Helpers UI ───────────────────────────────────────────────────────────────

function svcClass(status) {
  if (status === "UP" || status === "RUNNING") return "svc-up";
  if (status === "WARNING" || status === "STARTING" || status === "RUNNING_RECENT") return "svc-warn";
  return "svc-down";
}

function ringClass(status) {
  if (status === "UP")      return "ring-up";
  if (status === "WARNING") return "ring-warn";
  return "ring-down";
}

function wsStatus(server) {
  const infa  = server.informatica_process_status === "UP";
  const ports = server.services.every(x => x.status === "UP");
  return (infa && ports) ? "UP" : "DOWN";
}

function cdcStatus(cluster) {
  return cluster.cluster_status || "DOWN";
}

function createSection(title, count) {
  const section = document.createElement("section");
  section.className = "site-section";
  section.innerHTML = `
    <div class="section-header">
      <span class="section-label">${title}</span>
      <div class="section-line"></div>
      <span class="section-count">${count}</span>
    </div>
    <div class="grid"></div>
  `;
  return section;
}

// ── Render WebServiceHub ─────────────────────────────────────────────────────

function renderWS(server) {
  const status = wsStatus(server);
  const up     = server.services.filter(x => x.status === "UP").length;
  const total  = server.services.length;

  const services = server.services.map(s => `
    <div class="service-row">
      <span>${s.port}</span>
      <span>${s.protocol}</span>
      <span class="svc-badge ${svcClass(s.status)}">${s.status}</span>
      <a class="svc-link" href="${s.url}" target="_blank" onclick="event.stopPropagation()">Test URL</a>
    </div>
  `).join("");

  return `
  <div class="card ${status !== 'UP' ? 'is-down' : ''}">
    <div class="card-collapsed">
      <div class="card-left">
        <div class="status-ring ${ringClass(status)}">${status === 'UP' ? '↑' : '↓'}</div>
        <div>
          <div class="server-name">${server.host}</div>
          <div class="server-domain">${server.domain}</div>
        </div>
      </div>
      <div class="card-right">
        <div class="ports-pill">${up}/${total} porte</div>
        <div class="chevron">⌄</div>
      </div>
    </div>
    <div class="card-details">
      <div class="meta-row">
        <div class="meta-chip">SSH <span>${server.ssh_status}</span></div>
        <div class="meta-chip">Informatica <span>${server.informatica_process_status}</span></div>
      </div>
      <div class="services-list">${services}</div>
      <div class="timestamp">${server.timestamp}</div>
    </div>
  </div>`;
}

// ── Render CDC ───────────────────────────────────────────────────────────────

function renderCDC(cluster) {
  const status = cdcStatus(cluster);

  // Chip Catalina per ogni nodo
  const catChips = Object.entries(cluster.catalina || {}).map(([host, info]) => `
    <div class="meta-chip">
      Catalina <b style="margin-left:4px">${host}</b>
      <span class="svc-badge ${info.status === 'UP' ? 'svc-up' : 'svc-down'}" style="margin-left:6px">${info.status}</span>
    </div>
  `).join("");

  // Righe workflow CDC
  const rows = (cluster.cdc || []).map(c => {
    const hostLabel = !c.running_host
      ? '—'
      : c.running_host === 'BOTH'
        ? '<span style="color:var(--yellow)">⚠ BOTH</span>'
        : c.running_host;
    return `
      <div class="cdc-row">
        <div style="font-family:monospace;font-size:12px;word-break:break-all">${c.name}</div>
        <span class="svc-badge ${c.status === 'RUNNING' ? 'svc-up' : 'svc-down'}">${c.status}</span>
        <div style="font-size:12px;color:var(--muted)">${hostLabel}</div>
        <div style="font-size:12px;color:var(--muted)">PID&nbsp;${c.pid ?? '—'}</div>
      </div>`;
  }).join("");

  const ringIcon = status === 'UP' ? '↑' : status === 'WARNING' ? '!' : '↓';

  return `
  <div class="card ${status !== 'UP' ? 'is-down' : ''}">
    <div class="card-collapsed">
      <div class="card-left">
        <div class="status-ring ${ringClass(status)}">${ringIcon}</div>
        <div>
          <div class="server-name">${cluster.cluster} <small style="font-weight:400;color:var(--muted)">v${cluster.version}</small></div>
          <div class="server-domain">${cluster.primary} &nbsp;/&nbsp; ${cluster.secondary}</div>
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

// ── Load JSON ────────────────────────────────────────────────────────────────

async function loadJSON(path) {
  try {
    const r = await fetch(new URL(path, BASE));
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const wsFiles = [
    "as008pwc","as009pwc","as010pwc","as011pwc",
    "as091pwc","as092pwc","as093pwc","as094pwc"
  ];

  const wsData  = [];
  const cdcData = [];

  for (const host of wsFiles) {
    const d = await loadJSON(`data/infa_ws_status_${host}.json`);
    if (d) wsData.push(d);
  }

  for (const file of CDC_FILES) {
    const d = await loadJSON(`data/${file}.json`);
    if (d) cdcData.push(d);
  }

  // Alert banner
  const alerts = [];
  wsData.forEach(x => {
    if (wsStatus(x) !== "UP") alerts.push(`${x.host} WebServiceHub`);
  });
  cdcData.forEach(x => {
    if (cdcStatus(x) !== "UP") alerts.push(`${x.cluster} CDC — ${x.cdc_stopped} workflow KO`);
  });

  if (alerts.length > 0) {
    document.getElementById("header-dot").classList.add("has-down");
    document.getElementById("alert-banner").classList.add("visible");
    const ul = document.getElementById("alert-list");
    alerts.forEach(a => {
      const li = document.createElement("li");
      li.textContent = a;
      ul.appendChild(li);
    });
  }

  document.getElementById("alert-dismiss").onclick = () =>
    document.getElementById("alert-banner").remove();

  // ── WebServiceHub ──────────────────────────────────────────────────────────
  const wsContainer = document.getElementById("ws-dashboard");

  Object.entries(WS_GROUPS).forEach(([name, hosts]) => {
    const servers = wsData.filter(x => hosts.includes(x.host));
    const section = createSection(name, `${servers.length} server`);
    const grid    = section.querySelector(".grid");

    servers.forEach(s => {
      const wrap = document.createElement("div");
      wrap.innerHTML = renderWS(s);
      const card = wrap.firstElementChild;
      card.onclick = () => card.classList.toggle("open");
      grid.appendChild(card);
    });

    wsContainer.appendChild(section);
  });

  // ── CDC — una sezione per versione Informatica ─────────────────────────────
  const cdcContainer = document.getElementById("cdc-dashboard");

  CDC_FILES.forEach(fileName => {
    const clusterName = fileName.replace("infa_cdc_cluster_", ""); // es. "CDC95"
    const cluster     = cdcData.find(d => d.cluster === clusterName);
    if (!cluster) return;

    const label   = VERSION_LABELS[clusterName] || clusterName;
    const section = createSection(label, `${cluster.cdc_running}/${cluster.cdc_total} CDC running`);
    const grid    = section.querySelector(".grid");

    const wrap = document.createElement("div");
    wrap.innerHTML = renderCDC(cluster);
    const card = wrap.firstElementChild;
    card.onclick = () => card.classList.toggle("open");
    grid.appendChild(card);

    cdcContainer.appendChild(section);
  });

  document.getElementById("footer").textContent =
    "Dashboard aggiornata automaticamente da Outlook + GitHub";
}

init();