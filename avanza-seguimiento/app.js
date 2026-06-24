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

const clean = (value) => String(value || "").trim();
const fallback = (value) => clean(value) || "-";

function unique(values) {
  return values.map(clean).filter((value, index, all) => value && all.indexOf(value) === index);
}

function dateTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("es-CL");
}

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

function resetMetrics() {
  $("metricEstado").textContent = "-";
  $("metricTracking").textContent = "-";
  $("metricDestino").textContent = "-";
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

async function callAvanza(folio) {
  const activeSession = await getActiveSession();
  const params = new URLSearchParams({action: "avanza", folio});
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

function currentLocation(courier) {
  const seguimiento = courier?.seguimiento || {};
  return unique([seguimiento.direccion, seguimiento.comuna]).join(", ") || courier?.destino || "";
}

function currentStatus(courier) {
  return courier?.seguimiento?.estadoActual || courier?.estado || "";
}

function renderTimeline(events) {
  if (!events.length) return `<div class="empty">Avanza no entrego eventos de seguimiento para este tracking.</div>`;
  return `<div class="timeline">${events.map((event) => `<div class="event">
    <time>${escapeHtml(fallback(event.fecha))}</time>
    <strong>${escapeHtml(fallback(event.estado))}</strong>
  </div>`).join("")}</div>`;
}

function renderRows(rows) {
  if (!rows.length) return "";
  return `<div class="sectionTitle">Coincidencias Avanza</div>
    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Tracking</th>
            <th>Estado</th>
            <th>Destino</th>
            <th>Registro</th>
            <th>Observacion</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `<tr>
            <td><strong>${escapeHtml(fallback(row.tracking))}</strong></td>
            <td>${escapeHtml(fallback(row.estado))}</td>
            <td>${escapeHtml(fallback(row.destino))}</td>
            <td>${escapeHtml(unique([row.fechaRegistro, row.horaRegistro]).join(" "))}</td>
            <td>${escapeHtml(fallback(row.observacion))}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function renderResult(data) {
  const courier = data.courier || {};
  const seguimiento = courier.seguimiento || {};
  const rows = Array.isArray(courier.rows) ? courier.rows : [];
  const events = Array.isArray(seguimiento.eventos) ? seguimiento.eventos : [];
  const status = currentStatus(courier);
  const location = currentLocation(courier);

  $("resultTitle").textContent = data.folio ? `N.Venta ${data.folio}` : "Seguimiento Avanza";
  $("resultSubtitle").textContent = data.time ? `Ultima consulta: ${dateTime(data.time)}` : "Consulta Avanza.";
  $("resultCount").textContent = data.message || "";
  $("metricEstado").textContent = fallback(status);
  $("metricTracking").textContent = fallback(courier.tracking);
  $("metricDestino").textContent = fallback(location);

  if (!data.found || !courier.found) {
    $("results").innerHTML = `<div class="empty">${escapeHtml(data.message || "No encontre seguimiento Avanza para esta nota de venta.")}</div>`;
    return;
  }

  const searched = unique([courier.searchedFrom ? `Desde ${courier.searchedFrom}` : "", courier.searchedTo ? `Hasta ${courier.searchedTo}` : ""]).join(" / ");
  $("results").innerHTML = `<div class="summary">
    <div class="currentBox">
      <span>Donde esta el pedido</span>
      <strong>${escapeHtml(fallback(status))}</strong>
      <p>${escapeHtml(fallback(location))}</p>
    </div>
    <div class="detailGrid">
      <div class="detail"><span>Tracking</span><strong>${escapeHtml(fallback(courier.tracking))}</strong></div>
      <div class="detail"><span>Destinatario</span><strong>${escapeHtml(fallback(seguimiento.destinatario))}</strong></div>
      <div class="detail"><span>Direccion</span><strong>${escapeHtml(fallback(location))}</strong></div>
      <div class="detail"><span>Registro</span><strong>${escapeHtml(unique([courier.fechaRegistro, courier.horaRegistro]).join(" ") || "-")}</strong></div>
      <div class="detail"><span>Referencia</span><strong>${escapeHtml(fallback(courier.referencia1 || seguimiento.referencia1))}</strong></div>
      <div class="detail"><span>Busqueda</span><strong>${escapeHtml(fallback(searched))}</strong></div>
    </div>
    <div class="detail"><span>Observacion</span><strong>${escapeHtml(fallback(courier.observacion))}</strong></div>
    ${data.panalEstado ? `<div class="detail"><span>Estado Panal</span><strong>${escapeHtml(data.panalEstado)}</strong></div>` : ""}
    ${data.panalError ? `<p class="muted">${escapeHtml(data.panalError)}</p>` : ""}
  </div>
  <div class="sectionTitle">Linea de tiempo</div>
  ${renderTimeline(events)}
  ${renderRows(rows)}`;
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
  resetMetrics();
  setStatus(false, "Pendiente ingreso");
  showApp(false);
}

async function search(event) {
  event.preventDefault();
  const folio = $("folioInput").value.trim().replace(/[^\d]/g, "");
  if (!folio || !session?.access_token) return;
  $("searchButton").disabled = true;
  resetMetrics();
  $("resultTitle").textContent = `N.Venta ${folio}`;
  $("resultSubtitle").textContent = "Consultando Avanza...";
  $("resultCount").textContent = "";
  $("results").innerHTML = `<div class="empty">Consultando seguimiento...</div>`;
  message("Consultando Avanza...");
  try {
    const data = await callAvanza(folio);
    renderResult(data);
    message(data.message || "Consulta lista.", data.found ? "" : "error");
  } catch (error) {
    $("results").innerHTML = `<div class="empty">${escapeHtml(error.message || "Error consultando Avanza.")}</div>`;
    message(error.message || "Error consultando Avanza.", "error");
  } finally {
    $("searchButton").disabled = false;
  }
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
