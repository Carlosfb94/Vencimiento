const config = window.LLACOLEN_CONFIG || {};
const $ = (id) => document.getElementById(id);

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char]));

const clean = (value) => String(value || "").trim();
const fallback = (value) => clean(value) || "-";

function dateTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("es-CL");
}

function message(text, type = "") {
  $("message").textContent = text || "";
  $("message").className = type;
}

function resetMetrics() {
  $("metricEstado").textContent = "-";
  $("metricTracking").textContent = "-";
  $("metricEntrega").textContent = "-";
}

async function fetchJson(params) {
  const res = await fetch(`${config.correosFunctionUrl}?${params}`);
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {message: raw};
  }
  if (!res.ok || data.ok === false) {
    throw new Error(data.message || data.detail || `Error HTTP ${res.status}`);
  }
  return data;
}

function callCorreos(invoice) {
  return fetchJson(new URLSearchParams({invoice}));
}

function invoiceNumber(value) {
  const match = String(value || "").match(/\d{4,8}/);
  return match ? match[0] : "";
}

function renderEvents(events) {
  if (!events.length) return `<div class="empty">Correos no entrego eventos para este envio.</div>`;
  return `<div class="timeline">${events.map((event) => `<div class="event">
    <time>${escapeHtml(fallback(dateTime(event.date)))}</time>
    <strong>${escapeHtml(fallback(event.description))}</strong>
    <span>${escapeHtml(fallback(event.location))}</span>
  </div>`).join("")}</div>`;
}

function renderShipments(shipments) {
  if (!shipments.length) return `<div class="empty">No encontre envios Correos para esa factura.</div>`;
  return shipments.map((shipment, index) => `<article class="shipment">
    <div class="shipmentHead">
      <div>
        <h3>${escapeHtml(fallback(shipment.trackingNumber || `Envio ${index + 1}`))}</h3>
        <p>${escapeHtml(fallback(shipment.service ? `Servicio ${shipment.service}` : ""))}</p>
      </div>
      <span class="pill">${escapeHtml(fallback(shipment.status))}</span>
    </div>
    <div class="detailGrid">
      <div class="detail"><span>Tracking</span><strong>${escapeHtml(fallback(shipment.trackingNumber))}</strong></div>
      <div class="detail"><span>Factura / referencia</span><strong>${escapeHtml(fallback(shipment.invoiceNumber))}</strong></div>
      <div class="detail"><span>Estado</span><strong>${escapeHtml(fallback(shipment.status))}</strong></div>
      <div class="detail"><span>Fecha entrega</span><strong>${escapeHtml(fallback(shipment.deliveryDate))}</strong></div>
      <div class="detail"><span>Recibido por</span><strong>${escapeHtml(fallback(shipment.receiverName))}</strong></div>
      <div class="detail"><span>Oficina</span><strong>${escapeHtml(fallback(shipment.office))}</strong></div>
    </div>
    <div class="sectionTitle">Linea de tiempo</div>
    ${renderEvents(Array.isArray(shipment.events) ? shipment.events : [])}
  </article>`).join("");
}

function renderResult(data) {
  const shipments = Array.isArray(data.shipments) ? data.shipments : [];
  const first = shipments[0] || {};
  $("resultTitle").textContent = data.invoice ? `Factura ${data.invoice}` : "Seguimiento Correos";
  $("resultSubtitle").textContent = data.time ? `Ultima consulta: ${dateTime(data.time)}` : "Consulta Correos.";
  $("resultCount").textContent = data.message || "";
  $("metricEstado").textContent = fallback(first.status);
  $("metricTracking").textContent = fallback(first.trackingNumber);
  $("metricEntrega").textContent = fallback(first.deliveryDate);
  $("results").innerHTML = renderShipments(shipments);
}

async function search(event) {
  event.preventDefault();
  const invoice = invoiceNumber($("queryInput").value);
  if (!invoice) return;
  $("queryInput").value = invoice;
  $("searchButton").disabled = true;
  resetMetrics();
  $("resultTitle").textContent = `Factura ${invoice}`;
  $("resultSubtitle").textContent = "Consultando Correos...";
  $("resultCount").textContent = "";
  $("results").innerHTML = `<div class="empty">Consultando seguimiento...</div>`;
  message("Consultando Correos...");
  try {
    const data = await callCorreos(invoice);
    renderResult(data);
    message(data.message || "Consulta lista.", data.found ? "" : "error");
  } catch (error) {
    $("results").innerHTML = `<div class="empty">${escapeHtml(error.message || "Error consultando Correos.")}</div>`;
    message(error.message || "Error consultando Correos.", "error");
  } finally {
    $("searchButton").disabled = false;
  }
}

$("searchForm").addEventListener("submit", search);
