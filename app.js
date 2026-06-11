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

function resetStockMetrics() {
  $("metricBodega1").textContent = "-";
  $("metricBodega8").textContent = "-";
  $("metricNotasVenta").textContent = "-";
  $("metricDisponible").textContent = "-";
}

function resetNoteMetrics() {
  $("noteMetricEstado").textContent = "-";
  $("noteMetricFactura").textContent = "-";
  $("noteMetricPiOk").textContent = "-";
  $("noteMetricPiPending").textContent = "-";
}

function renderStock(data) {
  const rows = data.rows || [];
  const totals = data.totals || {bodega1: 0, bodega8: 0, notasVenta: 0, disponible: 0};
  $("metricBodega1").textContent = qty(totals.bodega1);
  $("metricBodega8").textContent = qty(totals.bodega8);
  $("metricNotasVenta").textContent = qty(totals.notasVenta);
  $("metricDisponible").textContent = signedQty(totals.disponible);
  $("resultTitle").textContent = data.query ? `Inventario: ${data.query}` : "Inventario";
  $("resultSubtitle").textContent = data.time ? `Ultima consulta: ${dateTime(data.time)}. Disponible = B1 + B8 - Notas de venta.` : "Disponible = Bodega 1 + Bodega 8 - Notas de venta.";
  $("resultCount").textContent = data.message || `${rows.length} productos.`;

  if (!rows.length) {
    $("results").innerHTML = `<div class="empty">${escapeHtml(data.message || "Sin productos para mostrar.")}</div>`;
    return;
  }

  const table = renderTable(
    [
      {label: "Producto"},
      {label: "Laboratorio"},
      {label: "Bodega 1", cls: "right"},
      {label: "Bodega 8", cls: "right"},
      {label: "Notas venta", cls: "right"},
      {label: "Disponible", cls: "right"},
      {label: "Estado"},
    ],
    rows,
    (row) => `<tr>
      <td><div class="sku">${escapeHtml(row.sku)}</div><div class="desc">${escapeHtml(row.descripcion)}</div></td>
      <td>${escapeHtml(row.laboratorio || "-")}</td>
      <td class="right">${escapeHtml(qty(row.bodega1))}</td>
      <td class="right">${escapeHtml(qty(row.bodega8))}</td>
      <td class="right">${escapeHtml(qty(row.notasVenta))}</td>
      <td class="right strong">${escapeHtml(signedQty(row.disponible))}</td>
      <td><span class="pill ${Number(row.disponible || 0) > 0 ? "good" : "muted"}">${escapeHtml(row.stockEstado || "-")}</span></td>
    </tr>`,
  );

  const cards = renderCards(rows, (row) => `<div class="item">
    <div class="top"><div><div class="sku">${escapeHtml(row.sku)}</div><div class="desc">${escapeHtml(row.descripcion)}</div></div><strong>${escapeHtml(signedQty(row.disponible))}</strong></div>
    <div class="kv"><span>Laboratorio</span><strong>${escapeHtml(row.laboratorio || "-")}</strong></div>
    <div class="kv"><span>Bodega 1</span><strong>${escapeHtml(qty(row.bodega1))}</strong></div>
    <div class="kv"><span>Bodega 8</span><strong>${escapeHtml(qty(row.bodega8))}</strong></div>
    <div class="kv"><span>Notas venta</span><strong>${escapeHtml(qty(row.notasVenta))}</strong></div>
  </div>`);

  $("results").innerHTML = `${table}${cards}`;
}

function facturaText(row) {
  const rowFacturas = Array.isArray(row.facturas) ? row.facturas : [];
  return rowFacturas.length ? rowFacturas.join(", ") : "-";
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
      {label: "Flujo"},
      {label: "Estado"},
      {label: "Factura"},
    ],
    rows,
    (row) => `<tr>
      <td><div class="sku">${escapeHtml(row.pedido || "-")}</div><div class="desc">${escapeHtml(row.tipo || "")}</div></td>
      <td>${escapeHtml(row.folio || "-")}</td>
      <td><div>${escapeHtml(row.auxiliar || "-")}</div><div class="desc">${escapeHtml(row.autor || "")}</div></td>
      <td><div>${escapeHtml(row.fechaEmision || "-")}</div><div class="desc">${escapeHtml(row.fechaCompromiso || "")}</div></td>
      <td class="flow">${["creacion", "picking", "control", "empaque", "despacho"].map((key) => `<span>${escapeHtml(row[key] || "-")}</span>`).join("")}</td>
      <td><span class="pill ${/picking|despachar|terminado|completa/i.test(row.estadoPedido || "") ? "good" : "muted"}">${escapeHtml(row.estadoPedido || "-")}</span><div class="desc">${escapeHtml(row.piEstado || data.estadoFactura || "")}</div></td>
      <td><strong>${escapeHtml(facturaText(row))}</strong><div class="desc">${escapeHtml(unique([row.facturaTipo, row.facturaEstado]).join(" / "))}</div></td>
    </tr>`,
  );

  const cards = renderCards(rows, (row) => `<div class="item">
    <div class="top"><div><div class="sku">Pedido ${escapeHtml(row.pedido || "-")}</div><div class="desc">N.Venta ${escapeHtml(row.folio || "-")}</div></div><strong>${escapeHtml(facturaText(row))}</strong></div>
    <div class="kv"><span>Estado</span><strong>${escapeHtml(row.estadoPedido || "-")}</strong></div>
    <div class="kv"><span>PI</span><strong>${escapeHtml(row.piEstado || data.estadoFactura || "-")}</strong></div>
    <div class="kv"><span>Auxiliar</span><strong>${escapeHtml(row.auxiliar || "-")}</strong></div>
    <div class="kv"><span>Emision</span><strong>${escapeHtml(row.fechaEmision || "-")}</strong></div>
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

async function callInventory(params) {
  const res = await fetch(`${config.inventoryFunctionUrl}?${params}`, {
    headers: {Authorization: `Bearer ${session.access_token}`},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
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

const {data} = await supabase.auth.getSession();
session = data.session;
if (session) {
  setStatus(true, session.user.email);
  showApp(true);
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
