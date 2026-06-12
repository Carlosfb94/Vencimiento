import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.LLACOLEN_CONFIG || {};
const supabase = createClient(config.supabaseUrl || "", config.supabaseAnonKey || "");
const $ = (id) => document.getElementById(id);
let session = null;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char]));

const qty = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString("es-CL") : String(value || "");
};

const signedQty = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return String(value || "");
  return num.toLocaleString("es-CL");
};

const dateTime = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("es-CL");
};

function setStatus(ok, text) {
  $("statusDot").className = ok ? "ok" : "";
  $("statusText").textContent = text;
}

function showApp(show) {
  $("authPanel").hidden = show;
  $("appPanel").hidden = !show;
  $("logoutButton").hidden = !show;
}

function message(text, type = "") {
  $("message").textContent = text || "";
  $("message").className = type;
}

function unique(values) {
  return values.map((value) => String(value || "").trim()).filter((value, index, all) => value && all.indexOf(value) === index);
}

function renderTable(headers, rows, rowHtml) {
  return `<div class="tableWrap"><table><thead><tr>${headers.map((h) => `<th class="${h.cls || ""}">${escapeHtml(h.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(rowHtml).join("")}</tbody></table></div>`;
}

function renderCards(rows, cardHtml) {
  return `<div class="cards">${rows.map(cardHtml).join("")}</div>`;
}

function groupStockRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [row.sku, row.descripcion, row.lote || "-", row.vencimiento || "-"].join("\u001f");
    if (!map.has(key)) {
      map.set(key, {
        sku: row.sku,
        descripcion: row.descripcion,
        lote: row.lote || "-",
        vencimiento: row.vencimiento || "-",
        stock: 0,
        noDisponible: 0,
        total: 0,
        lineas: 0,
        bodegasSet: new Set(),
      });
    }
    const group = map.get(key);
    group.stock += Number(row.stock || 0);
    group.noDisponible += Number(row.noDisponible || 0);
    group.total += Number(row.total || 0);
    group.lineas += 1;
    if (row.bodega) group.bodegasSet.add(row.bodega);
  }
  return Array.from(map.values())
    .map((group) => ({
      ...group,
      bodegas: Array.from(group.bodegasSet).join(", "),
    }))
    .sort((a, b) => String(a.vencimiento).localeCompare(String(b.vencimiento)) || String(a.lote).localeCompare(String(b.lote)));
}

function resetStockMetrics() {
  $("metricStockPanal").textContent = "-";
  $("metricNotasVenta").textContent = "-";
  $("metricDisponible").textContent = "-";
  $("metricLineas").textContent = "-";
}

function resetNoteMetrics() {
  $("noteMetricEstado").textContent = "-";
  $("noteMetricFactura").textContent = "-";
  $("noteMetricPiOk").textContent = "-";
  $("noteMetricPiPending").textContent = "-";
}

function renderStock(data) {
  const rows = data.rows || [];
  const totals = data.totals || {stockPanal: 0, noDisponible: 0, totalPanal: 0, notasVenta: 0, disponible: 0};
  $("metricStockPanal").textContent = qty(totals.stockPanal);
  $("metricNotasVenta").textContent = qty(totals.notasVenta);
  $("metricDisponible").textContent = signedQty(totals.disponible);
  $("metricLineas").textContent = qty(rows.length);
  $("resultTitle").textContent = data.query ? `Inventario: ${data.query}` : "Inventario";
  $("resultSubtitle").textContent = data.time ? `Ultima consulta: ${dateTime(data.time)}. Disponible = Stock Panal - Notas de venta.` : "Disponible = Stock Panal - Notas de venta.";
  $("resultCount").textContent = data.message || `${rows.length} productos.`;

  if (!rows.length) {
    $("results").innerHTML = `<div class="empty">${escapeHtml(data.message || "Sin productos para mostrar.")}</div>`;
    return;
  }

  const groups = groupStockRows(rows);
  const grouped = renderTable(
    [
      {label: "Producto"},
      {label: "Lote"},
      {label: "Vcto"},
      {label: "Bodegas"},
      {label: "Stock Panal", cls: "right"},
      {label: "N.Disp", cls: "right"},
      {label: "Total Panal", cls: "right"},
      {label: "Lineas", cls: "right"},
    ],
    groups,
    (row) => `<tr>
      <td><div class="sku">${escapeHtml(row.sku)}</div><div class="desc">${escapeHtml(row.descripcion)}</div></td>
      <td>${escapeHtml(row.lote || "-")}</td>
      <td>${escapeHtml(row.vencimiento || "-")}</td>
      <td>${escapeHtml(row.bodegas || "-")}</td>
      <td class="right strong">${escapeHtml(qty(row.stock))}</td>
      <td class="right">${escapeHtml(qty(row.noDisponible))}</td>
      <td class="right">${escapeHtml(qty(row.total))}</td>
      <td class="right">${escapeHtml(qty(row.lineas))}</td>
    </tr>`,
  );

  const groupedCards = renderCards(groups, (row) => `<div class="item">
    <div class="top"><div><div class="sku">${escapeHtml(row.sku)}</div><div class="desc">${escapeHtml(row.descripcion)}</div></div><strong>${escapeHtml(qty(row.stock))}</strong></div>
    <div class="kv"><span>Lote</span><strong>${escapeHtml(row.lote || "-")}</strong></div>
    <div class="kv"><span>Vcto</span><strong>${escapeHtml(row.vencimiento || "-")}</strong></div>
    <div class="kv"><span>Bodegas</span><strong>${escapeHtml(row.bodegas || "-")}</strong></div>
    <div class="kv"><span>Total Panal</span><strong>${escapeHtml(qty(row.total))}</strong></div>
  </div>`);

  const detail = renderTable(
    [
      {label: "Producto"},
      {label: "Bodega"},
      {label: "Ubicacion"},
      {label: "Lote"},
      {label: "Vcto"},
      {label: "LPN"},
      {label: "Stock Panal", cls: "right"},
      {label: "N.Disp", cls: "right"},
      {label: "Total Panal", cls: "right"},
    ],
    rows,
    (row) => `<tr>
      <td><div class="sku">${escapeHtml(row.sku)}</div><div class="desc">${escapeHtml(row.descripcion)}</div></td>
      <td>${escapeHtml(row.bodega || "-")}</td>
      <td>${escapeHtml(row.ubicacion || "-")}</td>
      <td>${escapeHtml(row.lote || "-")}</td>
      <td>${escapeHtml(row.vencimiento || "-")}</td>
      <td>${escapeHtml(row.lpn || "-")}</td>
      <td class="right strong">${escapeHtml(qty(row.stock))}</td>
      <td class="right">${escapeHtml(qty(row.noDisponible))}</td>
      <td class="right">${escapeHtml(qty(row.total))}</td>
    </tr>`,
  );

  $("results").innerHTML = `<div class="sectionTitle">Stock Panal por lote y vencimiento</div>${grouped}${groupedCards}<div class="sectionTitle">Detalle por ubicacion</div>${detail}`;
}

function facturaText(row) {
  const rowFacturas = Array.isArray(row.facturas) ? row.facturas : [];
  return rowFacturas.length ? rowFacturas.join(", ") : "-";
}

function courierText(row) {
  const courier = row.courier || {};
  return courier.found ? courier.courier || "Avanza" : "-";
}

function courierDetail(row) {
  const courier = row.courier || {};
  if (!courier.found) return "";
  return unique([courier.tracking, courier.estado, courier.fechaRegistro]).join(" / ");
}

function courierTimeline(row) {
  const events = row.courier?.seguimiento?.eventos || [];
  if (!events.length) return "";
  return events
    .slice(-4)
    .map((event) => unique([event.estado, event.fecha]).join(" - "))
    .filter(Boolean)
    .join(" | ");
}

function renderNote(data) {
  const rows = data.rows || [];
  const facturas = Array.isArray(data.facturas) ? data.facturas : [];
  $("noteMetricEstado").textContent = data.estadoPedido || "-";
  $("noteMetricFactura").textContent = facturas.length ? facturas.join(", ") : "-";
  $("noteMetricPiOk").textContent = qty(data.piCompletas);
  $("noteMetricPiPending").textContent = qty(data.piPendientes);
  $("noteTitle").textContent = data.folio ? `Nota de venta: ${data.folio}` : "Nota de venta";
  const mode = data.searchMode === "pedido" ? "Busqueda por numero de pedido." : "Busqueda por folio de N.Venta.";
  $("noteSubtitle").textContent = data.time ? `${mode} Ultima consulta: ${dateTime(data.time)}.` : mode;
  $("noteCount").textContent = data.message || `${rows.length} pedidos.`;

  if (!rows.length) {
    $("noteResults").innerHTML = `<div class="empty">${escapeHtml(data.message || "Sin resultados para mostrar.")}</div>`;
    return;
  }

  const table = renderTable(
    [
      {label: "Pedido"},
      {label: "N.Venta"},
      {label: "Auxiliar"},
      {label: "Fechas"},
      {label: "Estado"},
      {label: "Factura"},
      {label: "Courier"},
    ],
    rows,
    (row) => `<tr>
      <td><div class="sku">${escapeHtml(row.pedido || "-")}</div><div class="desc">${escapeHtml(row.tipo || "")}</div></td>
      <td>${escapeHtml(row.folio || "-")}</td>
      <td><div>${escapeHtml(row.auxiliar || "-")}</div><div class="desc">${escapeHtml(row.autor || "")}</div></td>
      <td><div>${escapeHtml(row.fechaEmision || "-")}</div><div class="desc">${escapeHtml(row.fechaCompromiso || "")}</div></td>
      <td><span class="pill ${/picking|despachar|terminado|completa/i.test(row.estadoPedido || "") ? "good" : "muted"}">${escapeHtml(row.estadoPedido || "-")}</span><div class="desc">${escapeHtml(row.piEstado || data.estadoFactura || "")}</div></td>
      <td><strong>${escapeHtml(facturaText(row))}</strong><div class="desc">${escapeHtml(unique([row.facturaTipo, row.facturaEstado]).join(" / "))}</div></td>
      <td><strong>${escapeHtml(courierText(row))}</strong><div class="desc">${escapeHtml(courierDetail(row))}</div><div class="timeline">${escapeHtml(courierTimeline(row))}</div></td>
    </tr>`,
  );

  const cards = renderCards(rows, (row) => `<div class="item">
    <div class="top"><div><div class="sku">Pedido ${escapeHtml(row.pedido || "-")}</div><div class="desc">N.Venta ${escapeHtml(row.folio || "-")}</div></div><strong>${escapeHtml(facturaText(row))}</strong></div>
    <div class="kv"><span>Estado</span><strong>${escapeHtml(row.estadoPedido || "-")}</strong></div>
    <div class="kv"><span>PI</span><strong>${escapeHtml(row.piEstado || data.estadoFactura || "-")}</strong></div>
    <div class="kv"><span>Courier</span><strong>${escapeHtml(courierText(row))}</strong></div>
    <div class="kv"><span>Auxiliar</span><strong>${escapeHtml(row.auxiliar || "-")}</strong></div>
    <div class="kv"><span>Emision</span><strong>${escapeHtml(row.fechaEmision || "-")}</strong></div>
    <div class="desc">${escapeHtml(courierDetail(row))}</div>
    <div class="timeline">${escapeHtml(courierTimeline(row))}</div>
  </div>`);

  $("noteResults").innerHTML = `${table}${cards}`;
}

async function login(event) {
  event.preventDefault();
  const email = $("emailInput").value.trim().toLowerCase();
  const password = $("passwordInput").value;
  const {data, error} = await supabase.auth.signInWithPassword({email, password});
  if (error) {
    alert(error.message || "No pude iniciar sesion.");
    return;
  }
  session = data.session;
  setStatus(true, email);
  showApp(true);
}

async function logout() {
  await supabase.auth.signOut();
  session = null;
  setStatus(false, "Pendiente ingreso");
  showApp(false);
}

async function handleExpiredSession() {
  await supabase.auth.signOut();
  session = null;
  setStatus(false, "Sesion vencida");
  showApp(false);
}

async function getActiveSession() {
  const {data, error} = await supabase.auth.getSession();
  if (error || !data.session) {
    await handleExpiredSession();
    throw new Error("Sesion vencida. Ingresa nuevamente.");
  }

  session = data.session;
  const expiresAt = Number(session.expires_at || 0) * 1000;
  if (expiresAt && expiresAt - Date.now() < 60000) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      await handleExpiredSession();
      throw new Error("Sesion vencida. Ingresa nuevamente.");
    }
    session = refreshed.data.session;
  }

  setStatus(true, session.user.email);
  showApp(true);
  return session;
}

async function callInventory(params) {
  const activeSession = await getActiveSession();
  const res = await fetch(`${config.inventoryFunctionUrl}?${params}`, {
    headers: {Authorization: `Bearer ${activeSession.access_token}`},
  });
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {message: raw};
  }
  if (!res.ok || data.ok === false) {
    const messageText = String(data.message || data.detail || raw || "");
    if (res.status === 401 || /invalid jwt|jwt|sesion|session/i.test(messageText)) {
      await handleExpiredSession();
      throw new Error("Sesion vencida. Ingresa nuevamente.");
    }
    throw new Error(data.message || data.detail || `Error HTTP ${res.status}`);
  }
  return data;
}

async function search(event) {
  event.preventDefault();
  const query = $("skuInput").value.trim();
  if (!query || !session?.access_token) return;
  $("searchButton").disabled = true;
  resetStockMetrics();
  message("Consultando inventario...");
  try {
    const params = new URLSearchParams({action: "stock", q: query, limit: "50"});
    const data = await callInventory(params);
    renderStock(data);
    message(data.message || "Consulta lista.", "");
  } catch (error) {
    $("results").innerHTML = `<div class="empty">${escapeHtml(error.message || "Error consultando inventario.")}</div>`;
    message(error.message || "Error consultando inventario.", "error");
  } finally {
    $("searchButton").disabled = false;
  }
}

async function searchNote(event) {
  event.preventDefault();
  const folio = $("noteInput").value.trim().replace(/[^\d]/g, "");
  if (!folio || !session?.access_token) return;
  $("noteButton").disabled = true;
  resetNoteMetrics();
  message("Consultando nota de venta...");
  try {
    const params = new URLSearchParams({action: "nota", folio});
    const data = await callInventory(params);
    renderNote(data);
    message(data.message || "Consulta lista.", "");
  } catch (error) {
    $("noteResults").innerHTML = `<div class="empty">${escapeHtml(error.message || "Error consultando nota de venta.")}</div>`;
    message(error.message || "Error consultando nota de venta.", "error");
  } finally {
    $("noteButton").disabled = false;
  }
}

function switchTab(targetId) {
  for (const button of document.querySelectorAll(".tabButton")) {
    const active = button.dataset.tab === targetId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  }
  $("stockView").hidden = targetId !== "stockView";
  $("noteView").hidden = targetId !== "noteView";
  message("");
}

supabase.auth.onAuthStateChange((_event, currentSession) => {
  session = currentSession;
  if (session) {
    setStatus(true, session.user.email);
    showApp(true);
  }
});

const {data} = await supabase.auth.getSession();
session = data.session;
if (session) {
  try {
    await getActiveSession();
  } catch {
    setStatus(false, "Pendiente ingreso");
    showApp(false);
  }
} else {
  setStatus(false, "Pendiente ingreso");
  showApp(false);
}

$("authForm").addEventListener("submit", login);
$("logoutButton").addEventListener("click", logout);
$("searchForm").addEventListener("submit", search);
$("noteForm").addEventListener("submit", searchNote);
for (const button of document.querySelectorAll(".tabButton")) {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
}
