const WS_GROUPS = {
  Bernina: [
    "as008pwc",
    "as009pwc",
    "as010pwc",
    "as011pwc"
  ],

  Vimercate: [
    "as091pwc",
    "as092pwc",
    "as093pwc",
    "as094pwc"
  ]
};

// Nomi dei file JSON CDC prodotti dalla sh (uno per cluster)
const CDC_FILES = [
  "infa_cdc_cluster_CDC95",
  "infa_cdc_cluster_CDC96",
  "infa_cdc_cluster_CDC102"
];

function svcClass(status) {

  if (
    status === "UP" ||
    status === "RUNNING"
  ) {
    return "svc-up";
  }

  if (
    status === "WARNING" ||
    status === "STARTING" ||
    status === "RUNNING_RECENT"
  ) {
    return "svc-warn";
  }

  return "svc-down";
}

function ringClass(status) {

  if (status === "UP") {
    return "ring-up";
  }

  if (status === "WARNING") {
    return "ring-warn";
  }

  return "ring-down";
}

function wsStatus(server) {

  const infa =
    server.informatica_process_status === "UP";

  const ports =
    server.services.every(
      x => x.status === "UP"
    );

  if (infa && ports) {
    return "UP";
  }

  return "DOWN";
}

function cdcStatus(cluster) {
  return cluster.cluster_status || "DOWN";
}

function createSection(title,count) {

  const section =
    document.createElement("section");

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

function renderWS(server) {

  const status = wsStatus(server);

  const up =
    server.services.filter(
      x => x.status === "UP"
    ).length;

  const total =
    server.services.length;

  const services =
    server.services.map(s => `
      <div class="service-row">

        <span>${s.port}</span>

        <span>${s.protocol}</span>

        <span class="svc-badge ${svcClass(s.status)}">
          ${s.status}
        </span>

        <a
          class="svc-link"
          href="${s.url}"
          target="_blank"
          onclick="event.stopPropagation()"
        >
          Test URL
        </a>

      </div>
    `).join("");

  return `
  <div class="card ${status !== 'UP' ? 'is-down':''}">
    <div class="card-collapsed">

      <div class="card-left">

        <div class="status-ring ${ringClass(status)}">
          ${status === 'UP' ? '↑' : '↓'}
        </div>

        <div>
          <div class="server-name">
            ${server.host}
          </div>

          <div class="server-domain">
            ${server.domain}
          </div>
        </div>

      </div>

      <div class="card-right">

        <div class="ports-pill">
          ${up}/${total} porte
        </div>

        <div class="chevron">⌄</div>

      </div>

    </div>

    <div class="card-details">

      <div class="meta-row">

        <div class="meta-chip">
          SSH
          <span>${server.ssh_status}</span>
        </div>

        <div class="meta-chip">
          Informatica
          <span>
            ${server.informatica_process_status}
          </span>
        </div>

      </div>

      <div class="services-list">
        ${services}
      </div>

      <div class="timestamp">
        ${server.timestamp}
      </div>

    </div>
  </div>
  `;
}

function renderCDC(server) {

  const status =
    cdcStatus(server);

  const rows =
    (server.cdc || [])
    .map(c => `
      <div class="cdc-row">

        <div>
          ${c.name}
        </div>

        <div class="svc-badge ${svcClass(c.status)}">
          ${c.status}
        </div>

        <div>
          PID ${c.pid ?? '-'}
        </div>

        <div>
          ${c.elapsed ?? '-'}
        </div>

      </div>
    `)
    .join("");

  return `
  <div class="card ${status !== 'UP' ? 'is-down':''}">
    <div class="card-collapsed">

      <div class="card-left">

        <div class="status-ring ${ringClass(status)}">
          ${status === 'UP' ? '↑' :
            status === 'WARNING' ? '!' : '↓'}
        </div>

        <div>

          <div class="server-name">
            ${server.host}
          </div>

          <div class="server-domain">
            ${server.informatica_version}
          </div>

        </div>

      </div>

      <div class="card-right">

        <div class="ports-pill">
          ${cluster.cdc_running}/${cluster.cdc_total} CDC
        </div>

        <div class="chevron">⌄</div>

      </div>

    </div>

    <div class="card-details">

      <div class="meta-row">

        <div class="meta-chip">
          Catalina
          <span>
            ${server.catalina_status}
          </span>
        </div>

        <div class="meta-chip">
          Pair
          <span>
            ${server.pair_host}
          </span>
        </div>

      </div>

      <div class="services-list">
        ${rows}
      </div>

      <div class="timestamp">
        ${server.timestamp}
      </div>

    </div>

  </div>
  `;
}

async function loadJSON(path) {

  try {

    const r = await fetch(path);

    if (!r.ok) {
      return null;
    }

    return await r.json();

  } catch {

    return null;
  }
}

async function init() {

  const wsFiles = [
    "as008pwc","as009pwc","as010pwc","as011pwc",
    "as091pwc","as092pwc","as093pwc","as094pwc"
  ];

  // CDC: un JSON per cluster (non più per host)

  const wsData = [];
  const cdcData = [];

  for (const host of wsFiles) {

    const d =
      await loadJSON(
        `/fw-monitoring-dashboard/data/infa_ws_status_${host}.json`
      );

    if (d) wsData.push(d);
  }

  for (const file of CDC_FILES) {
    const d = await loadJSON(`/fw-monitoring-dashboard/data/${file}.json`);
    if (d) cdcData.push(d);
  }

  const alerts = [];

  wsData.forEach(x => {
    if (wsStatus(x) !== "UP") {
      alerts.push(
        `${x.host} WebServiceHub`
      );
    }
  });

  cdcData.forEach(x => {
    if (cdcStatus(x) !== "UP") {
      alerts.push(`${x.cluster} CDC — ${x.cdc_stopped} workflow KO`);
    }
  });

  if (alerts.length > 0) {

    document
      .getElementById("header-dot")
      .classList.add("has-down");

    document
      .getElementById("alert-banner")
      .classList.add("visible");

    const ul =
      document.getElementById("alert-list");

    alerts.forEach(a => {

      const li =
        document.createElement("li");

      li.textContent = a;

      ul.appendChild(li);

    });
  }

  document
    .getElementById("alert-dismiss")
    .onclick = () =>
      document
        .getElementById("alert-banner")
        .remove();

  const wsContainer =
    document.getElementById(
      "ws-dashboard"
    );

  Object.entries(WS_GROUPS)
    .forEach(([name,hosts]) => {

      const servers =
        wsData.filter(
          x => hosts.includes(x.host)
        );

      const section =
        createSection(
          name,
          `${servers.length} server`
        );

      const grid =
        section.querySelector(".grid");

      servers.forEach(s => {

        const wrap =
          document.createElement("div");

        wrap.innerHTML =
          renderWS(s);

        const card =
          wrap.firstElementChild;

        card.onclick =
          () => card.classList.toggle("open");

        grid.appendChild(card);

      });

      wsContainer.appendChild(section);

    });

  const cdcContainer =
    document.getElementById(
      "cdc-dashboard"
    );

  // Un'unica sezione CDC con tutti i cluster
  const cdcSection = createSection("Informatica CDC Clusters", `${cdcData.length} cluster`);
  const cdcGrid = cdcSection.querySelector(".grid");

  cdcData.forEach(cluster => {
    const wrap = document.createElement("div");
    wrap.innerHTML = renderCDC(cluster);
    const card = wrap.firstElementChild;
    card.onclick = () => card.classList.toggle("open");
    cdcGrid.appendChild(card);
  });

  cdcContainer.appendChild(cdcSection);

  document
    .getElementById("footer")
    .textContent =
      "Dashboard aggiornata automaticamente da Outlook + GitHub";
}

init();
