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

function totals(rows) {
  return rows.reduce((acc, row) => {
    acc.stock += Number(row.stock || 0);
    acc.noDisponible += Number(row.noDisponible || 0);
    acc.total += Number(row.total || 0);
    return acc;
  }, {stock: 0, noDisponible: 0, total: 0});
}

function groupRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [row.sku, row.descripcion, row.lote, row.vencimiento].join("\u001f");
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
      });
    }
    const group = map.get(key);
    group.stock += Number(row.stock || 0);
    group.noDisponible += Number(row.noDisponible || 0);
    group.total += Number(row.total || 0);
    group.lineas += 1;
  }
  return Array.from(map.values()).sort((a, b) => String(a.vencimiento).localeCompare(String(b.vencimiento)) || String(a.lote).localeCompare(String(b.lote)));
}

function renderTable(headers, rows, rowHtml) {
  return `<div class="tableWrap"><table><thead><tr>${headers.map((h) => `<th class="${h.cls || ""}">${h.label}</th>`).join("")}</tr></thead><tbody>${rows.map(rowHtml).join("")}</tbody></table></div>`;
}

function renderCards(rows, cardHtml) {
  return `<div class="cards">${rows.map(cardHtml).join("")}</div>`;
}

function render(data) {
  const rows = data.rows || [];
  const sum = totals(rows);
  $("metricStock").textContent = qty(sum.stock);
  $("metricNoDisp").textContent = qty(sum.noDisponible);
  $("metricTotal").textContent = qty(sum.total);
  $("metricLines").textContent = qty(rows.length);
  $("resultTitle").textContent = data.query ? `Vencimiento: ${data.query}` : "Vencimiento";
  $("resultSubtitle").textContent = data.time ? `Ultima consulta: ${data.time}` : "";
  $("resultCount").textContent = data.message || `${rows.length} lineas.`;
  if (!rows.length) {
    $("results").innerHTML = `<div class="empty">${escapeHtml(data.message || "Sin stock para mostrar.")}</div>`;
    return;
  }

  const groups = groupRows(rows);
  const grouped = renderTable(
    [{label: "Producto"}, {label: "Lote"}, {label: "Vcto"}, {label: "Stock", cls: "right"}, {label: "N.Disp", cls: "right"}, {label: "Total", cls: "right"}, {label: "Lineas", cls: "right"}],
    groups,
    (g) => `<tr><td><div class="sku">${escapeHtml(g.sku)}</div><div class="desc">${escapeHtml(g.descripcion)}</div></td><td>${escapeHtml(g.lote)}</td><td>${escapeHtml(g.vencimiento)}</td><td class="right">${escapeHtml(qty(g.stock))}</td><td class="right">${escapeHtml(qty(g.noDisponible))}</td><td class="right">${escapeHtml(qty(g.total))}</td><td class="right">${escapeHtml(qty(g.lineas))}</td></tr>`,
  ) + renderCards(groups, (g) => `<div class="item"><div class="top"><div><div class="sku">${escapeHtml(g.sku)}</div><div class="desc">${escapeHtml(g.descripcion)}</div></div><strong>${escapeHtml(qty(g.stock))}</strong></div><div class="kv"><span>Lote</span><strong>${escapeHtml(g.lote)}</strong></div><div class="kv"><span>Vcto</span><strong>${escapeHtml(g.vencimiento)}</strong></div><div class="kv"><span>Total</span><strong>${escapeHtml(qty(g.total))}</strong></div><div class="kv"><span>Lineas</span><strong>${escapeHtml(qty(g.lineas))}</strong></div></div>`);

  const detail = renderTable(
    [{label: "Producto"}, {label: "Bodega"}, {label: "Ubicacion"}, {label: "Lote"}, {label: "Vcto"}, {label: "LPN"}, {label: "Stock", cls: "right"}, {label: "N.Disp", cls: "right"}, {label: "Total", cls: "right"}],
    rows,
    (row) => `<tr><td><div class="sku">${escapeHtml(row.sku)}</div><div class="desc">${escapeHtml(row.descripcion)}</div></td><td>${escapeHtml(row.bodega)}</td><td>${escapeHtml(row.ubicacion)}</td><td>${escapeHtml(row.lote || "-")}</td><td>${escapeHtml(row.vencimiento || "-")}</td><td>${escapeHtml(row.lpn || "-")}</td><td class="right">${escapeHtml(qty(row.stock))}</td><td class="right">${escapeHtml(qty(row.noDisponible))}</td><td class="right">${escapeHtml(qty(row.total))}</td></tr>`,
  ) + renderCards(rows, (row) => `<div class="item"><div class="top"><div><div class="sku">${escapeHtml(row.sku)}</div><div class="desc">${escapeHtml(row.descripcion)}</div></div><strong>${escapeHtml(qty(row.stock))}</strong></div><div class="kv"><span>Bodega</span><strong>${escapeHtml(row.bodega)}</strong></div><div class="kv"><span>Ubicacion</span><strong>${escapeHtml(row.ubicacion)}</strong></div><div class="kv"><span>Lote</span><strong>${escapeHtml(row.lote || "-")}</strong></div><div class="kv"><span>Vcto</span><strong>${escapeHtml(row.vencimiento || "-")}</strong></div></div>`);

  $("results").innerHTML = `<div class="sectionTitle">Stock por lote y vencimiento</div>${grouped}<div class="sectionTitle">Detalle por ubicacion</div>${detail}`;
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

async function search(event) {
  event.preventDefault();
  const query = $("skuInput").value.trim();
  if (!query || !session?.access_token) return;
  $("searchButton").disabled = true;
  message("Consultando Panal...");
  try {
    const params = new URLSearchParams({q: query, bodega: $("warehouseInput").value, limit: "180"});
    const res = await fetch(`${config.inventoryFunctionUrl}?${params}`, {
      headers: {Authorization: `Bearer ${session.access_token}`},
    });
    const data = await res.json();
    render(data);
    message(data.message || "Consulta lista.", data.ok ? "" : "error");
  } catch (error) {
    message(error.message || "Error consultando inventario.", "error");
  } finally {
    $("searchButton").disabled = false;
  }
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
