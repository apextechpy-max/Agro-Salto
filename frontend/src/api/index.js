const isNative = typeof window !== 'undefined' && (
  window.Capacitor?.isNativePlatform?.() ||
  window.location.protocol === 'capacitor:' ||
  (window.location.hostname === 'localhost' && !window.location.port)
);

export const BASE = isNative 
  ? (localStorage.getItem('server_url') || 'https://agro-salto.vercel.app/api')
  : '/api';

function getToken() { return localStorage.getItem('token') }

function headers(extra = {}) {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}`, ...extra }
}

async function req(method, path, body) {
  const isFormData = body instanceof FormData
  const h = headers()
  if (isFormData) delete h['Content-Type']
  const opts = { method, headers: h }
  if (body !== undefined) opts.body = isFormData ? body : JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    // Token vencido o inválido → cerrar sesión y volver al login
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/'
    return
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

export const api = {
  get:    (path)        => req('GET',    path),
  post:   (path, body)  => req('POST',   path, body),
  put:    (path, body)  => req('PUT',    path, body),
  patch:  (path, body)  => req('PATCH',  path, body),
  delete: (path)        => req('DELETE', path),

  // Auth
  login: (u, p) => req('POST', '/auth/login', { usuario: u, password: p }),

  // Dashboard
  dashboard: (filial_id) => req('GET', `/dashboard${filial_id ? `?filial_id=${filial_id}` : ''}`),

  // Filiales
  filiales: () => req('GET', '/filiales'),
  createFilial: (d) => req('POST', '/filiales', d),

  // Categorias
  categorias: () => req('GET', '/categorias'),

  // Productos
  productos: (q = '') => req('GET', `/productos${q}`),
  getProducto: (id) => req('GET', `/productos/${id}`),
  productoHistorial: (id) => req('GET', `/productos/${id}/historial`),
  createProducto: (d) => req('POST', '/productos', d),
  updateProducto: (id, d) => req('PUT', `/productos/${id}`, d),
  ajusteStock: (id, d) => req('POST', `/productos/${id}/ajuste`, d),
  buscarPorCodigoLote: (codigoLote) => req('GET', `/productos/lote/${encodeURIComponent(codigoLote)}`),

  // Personas
  personas: (q = '') => req('GET', `/personas${q}`),
  getPersona: (id) => req('GET', `/personas/${id}`),
  createPersona: (d) => req('POST', '/personas', d),
  updatePersona: (id, d) => req('PUT', `/personas/${id}`, d),
  pagoCC: (id, d) => req('POST', `/personas/${id}/pago`, d),

  // Stock
  stock: (q = '') => req('GET', `/stock${q}`),
  alertasVto: () => req('GET', '/stock/alertas-vencimiento'),
  movimientosStock: (q = '') => req('GET', `/stock/movimientos${q}`),
  transferencia: (d) => req('POST', '/stock/transferencia', d),
  bajaStock: (d) => req('POST', '/stock/baja', d),

  // Compras
  compras: (q = '') => req('GET', `/compras${q}`),
  getCompra: (id) => req('GET', `/compras/${id}`),
  createCompra: (d) => req('POST', '/compras', d),
  estadoCompra: (id, estado) => req('PATCH', `/compras/${id}/estado`, { estado }),

  // Ventas
  ventas: (q = '') => req('GET', `/ventas${q}`),
  getVenta: (id) => req('GET', `/ventas/${id}`),
  createVenta: (d) => req('POST', '/ventas', d),
  anularVenta: (id) => req('PATCH', `/ventas/${id}/anular`, {}),

  // Caja
  cajas: (filial_id) => req('GET', `/caja/cajas${filial_id ? `?filial_id=${filial_id}` : ''}`),
  aperturaActiva: (caja_id) => req('GET', `/caja/apertura-activa?caja_id=${caja_id}`),
  abrirCaja: (d) => req('POST', '/caja/abrir', d),
  movimientosCaja: (ap_id) => req('GET', `/caja/${ap_id}/movimientos`),
  addMovCaja: (ap_id, d) => req('POST', `/caja/${ap_id}/movimiento`, d),
  cerrarCaja: (d) => req('POST', '/caja/cerrar', d),
  historialCaja: (q = '') => req('GET', `/caja/historial${q}`),

  // Usuarios
  usuarios: () => req('GET', '/usuarios'),
  veterinarios: () => req('GET', '/usuarios/veterinarios'),
  createUsuario: (d) => req('POST', '/usuarios', d),
  updateUsuario: (id, d) => req('PUT', `/usuarios/${id}`, d),
  deleteUsuario: (id) => req('DELETE', `/usuarios/${id}`),

  // Reportes
  repVentas: (q = '') => req('GET', `/reportes/ventas${q}`),
  repVentasDetalle: (q = '') => req('GET', `/reportes/ventas-detalle${q}`),
  repStockCritico: () => req('GET', '/reportes/stock-critico'),
  repDeudores: () => req('GET', '/reportes/deudores'),
  repCierres: (q = '') => req('GET', `/reportes/cierres-caja${q}`),
  libroVentas: (q = '') => req('GET', `/reportes/libro-ventas${q}`),
  libroCompras: (q = '') => req('GET', `/reportes/libro-compras${q}`),

  // ─── MÓDULO VETERINARIO (VMS) ──────────────────────────────

  // Mascotas
  mascotas: (q = '') => req('GET', `/mascotas${q}`),
  getMascota: (id) => req('GET', `/mascotas/${id}`),
  mascotasPersona: (persona_id) => req('GET', `/mascotas/persona/${persona_id}`),
  createMascota: (d) => req('POST', '/mascotas', d),
  updateMascota: (id, d) => req('PUT', `/mascotas/${id}`, d),
  deleteMascota: (id) => req('DELETE', `/mascotas/${id}`),

  // Clínica - Consultas
  consultas: (q = '') => req('GET', `/clinica/consultas${q}`),
  getConsulta: (id) => req('GET', `/clinica/consultas/${id}`),
  createConsulta: (d) => req('POST', '/clinica/consultas', d),
  updateConsulta: (id, d) => req('PUT', `/clinica/consultas/${id}`, d),
  getProgreso: (id) => req('GET', `/clinica/consultas/${id}/progreso`),
  consultaPreVenta: (id, d) => req('POST', `/clinica/consultas/${id}/pre-venta`, d),
  subirEstudio: (consulta_id, formData) => {
    return fetch(`${BASE}/clinica/consultas/${consulta_id}/estudio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    }).then(r => r.json());
  },
  crearReceta: (id, d) => req('POST', `/clinica/consultas/${id}/receta`, d),

  // Clínica - Internación
  internaciones: () => req('GET', '/clinica/internaciones'),
  crearInternacion: (d) => req('POST', '/clinica/internaciones', d),
  altaInternacion: (id, d) => req('PATCH', `/clinica/internaciones/${id}/alta`, d),
  addConstante: (id, d) => req('POST', `/clinica/internaciones/${id}/constante`, d),
  constantes: (id) => req('GET', `/clinica/internaciones/${id}/constantes`),

  // Agenda
  agenda: (q = '') => req('GET', `/agenda${q}`),
  getEvento: (id) => req('GET', `/agenda/${id}`),
  createEvento: (d) => req('POST', '/agenda', d),
  updateEvento: (id, d) => req('PUT', `/agenda/${id}`, d),
  deleteEvento: (id) => req('DELETE', `/agenda/${id}`),
  estadoEvento: (id, estado) => req('PATCH', `/agenda/${id}/estado`, { estado }),
  whatsappEvento: (id) => req('GET', `/agenda/${id}/whatsapp`),

  // Pre-ventas pendientes (para Caja)
  preVentasPendientes: () => req('GET', '/ventas?estado=PRE-VENTA'),
  cobrarPreVenta: (id, d) => req('POST', `/ventas/${id}/cobrar`, d),
}

export default api

