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

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function setDefaultDates() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 45);
  $("fromInput").value = isoDate(from);
  $("toInput").value = isoDate(today);
}

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
  $("metricCount").textContent = "-";
  $("metricLast").textContent = "-";
}

async function callFedex(invoice, from, to) {
  const params = new URLSearchParams({invoice, from, to});
  const res = await fetch(`${config.fedexFunctionUrl}?${params}`);
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

function renderEvents(events) {
  if (!events.length) return `<div class="empty">FedEx no entrego eventos de seguimiento para este envio.</div>`;
  return `<div class="timeline">${events.map((event) => `<div class="event">
    <time>${escapeHtml(fallback(dateTime(event.date)))}</time>
    <strong>${escapeHtml(fallback(event.description))}</strong>
    <span>${escapeHtml(fallback(event.location))}</span>
  </div>`).join("")}</div>`;
}

function renderShipments(shipments) {
  if (!shipments.length) {
    return `<div class="empty">No encontre envios FedEx para esa factura en el rango seleccionado.</div>`;
  }
  return shipments.map((shipment, index) => `<article class="shipment">
    <div class="shipmentHead">
      <div>
        <h3>${escapeHtml(fallback(shipment.trackingNumber || `Envio ${index + 1}`))}</h3>
        <p>${escapeHtml(fallback(shipment.service))}</p>
      </div>
      <span class="pill">${escapeHtml(fallback(shipment.status))}</span>
    </div>
    <div class="detailGrid">
      <div class="detail"><span>Tracking</span><strong>${escapeHtml(fallback(shipment.trackingNumber))}</strong></div>
      <div class="detail"><span>Estado</span><strong>${escapeHtml(fallback(shipment.status))}</strong></div>
      <div class="detail"><span>Destino</span><strong>${escapeHtml(fallback(shipment.destination))}</strong></div>
      <div class="detail"><span>Entrega estimada</span><strong>${escapeHtml(fallback(dateTime(shipment.estimatedDelivery)))}</strong></div>
    </div>
    <div class="sectionTitle">Linea de tiempo</div>
    ${renderEvents(Array.isArray(shipment.events) ? shipment.events : [])}
  </article>`).join("");
}

function renderResult(data) {
  const shipments = Array.isArray(data.shipments) ? data.shipments : [];
  const first = shipments[0] || {};
  $("resultTitle").textContent = data.invoice ? `Factura ${data.invoice}` : "Seguimiento FedEx";
  $("resultSubtitle").textContent = data.time ? `Ultima consulta: ${dateTime(data.time)}` : "Consulta FedEx.";
  $("resultCount").textContent = data.message || "";
  $("metricEstado").textContent = fallback(first.status);
  $("metricCount").textContent = String(shipments.length || 0);
  $("metricLast").textContent = fallback(first.lastEvent || first.destination);
  $("results").innerHTML = renderShipments(shipments);
}

async function search(event) {
  event.preventDefault();
  const invoice = $("invoiceInput").value.trim();
  const from = $("fromInput").value;
  const to = $("toInput").value;
  if (!invoice || !from || !to) return;
  $("searchButton").disabled = true;
  resetMetrics();
  $("resultTitle").textContent = `Factura ${invoice}`;
  $("resultSubtitle").textContent = "Consultando FedEx...";
  $("resultCount").textContent = "";
  $("results").innerHTML = `<div class="empty">Consultando seguimiento...</div>`;
  message("Consultando FedEx...");
  try {
    const data = await callFedex(invoice, from, to);
    renderResult(data);
    message(data.message || "Consulta lista.", data.found ? "" : "error");
  } catch (error) {
    $("results").innerHTML = `<div class="empty">${escapeHtml(error.message || "Error consultando FedEx.")}</div>`;
    message(error.message || "Error consultando FedEx.", "error");
  } finally {
    $("searchButton").disabled = false;
  }
}

setDefaultDates();
$("searchForm").addEventListener("submit", search);
