import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const fmt = (n) => new Intl.NumberFormat('es-PY').format(Math.round(n || 0))

function Modal({ open, onClose, children, title, size = '' }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${size}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Caja() {
  const { user, isAdmin } = useAuth()
  const [cajas, setCajas] = useState([])
  const [cajaSelec, setCajaSelec] = useState('')
  const [apertura, setApertura] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [historial, setHistorial] = useState([])
  const [tab, setTab] = useState('caja')
  const [msg, setMsg] = useState(null)

  const [modalAbrir, setModalAbrir] = useState(false)
  const [modalCerrar, setModalCerrar] = useState(false)
  const [modalMovimiento, setModalMovimiento] = useState(false)
  const [montoInicial, setMontoInicial] = useState('')
  const [cambioUsd, setCambioUsd] = useState('')
  const [cambioBrl, setCambioBrl] = useState('')
  const [cambioArs, setCambioArs] = useState('')
  const [montoDeclarado, setMontoDeclarado] = useState('')
  const [resultCierre, setResultCierre] = useState(null)
  const [movForm, setMovForm] = useState({ tipo: 'EGRESO', concepto: '', monto: '' })

  useEffect(() => {
    api.cajas(user?.filial_id).then(cajas => {
      setCajas(cajas)
      if (cajas.length > 0) setCajaSelec(cajas[0].id)
    })
  }, [])

  useEffect(() => {
    if (!cajaSelec) return
    api.aperturaActiva(cajaSelec).then(a => {
      setApertura(a)
      if (a) api.movimientosCaja(a.id).then(setMovimientos)
    })
  }, [cajaSelec])

  const loadHistorial = () => api.historialCaja().then(setHistorial)

  const abrir = async () => {
    try {
      await api.abrirCaja({ 
        caja_id: cajaSelec, 
        monto_inicial: parseFloat(montoInicial) || 0,
        cambio_usd: parseFloat(cambioUsd) || 0,
        cambio_brl: parseFloat(cambioBrl) || 0,
        cambio_ars: parseFloat(cambioArs) || 0
      })
      setMsg({ type: 'success', text: '✅ Caja abierta' })
      setModalAbrir(false)
      api.aperturaActiva(cajaSelec).then(a => { setApertura(a); if (a) api.movimientosCaja(a.id).then(setMovimientos) })
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
  }

  const cerrar = async () => {
    try {
      const result = await api.cerrarCaja({ apertura_id: apertura.id, monto_declarado: parseFloat(montoDeclarado) || 0 })
      setResultCierre(result)
      setApertura(null); setMovimientos([])
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
  }

  const addMovimiento = async () => {
    try {
      await api.addMovCaja(apertura.id, { tipo: movForm.tipo, concepto: movForm.concepto, monto: parseFloat(movForm.monto) })
      setMsg({ type: 'success', text: '✅ Movimiento registrado' })
      setModalMovimiento(false)
      api.movimientosCaja(apertura.id).then(setMovimientos)
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
  }

  const totalIngresos = movimientos.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + m.monto, 0)
  const totalEgresos = movimientos.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + m.monto, 0)
  const saldoActual = totalIngresos - totalEgresos

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">💰 Caja</div>
          <div className="page-subtitle">Gestión de turnos y movimientos</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cajas.length > 1 && (
            <select value={cajaSelec} onChange={e => setCajaSelec(parseInt(e.target.value))} style={{ padding: '8px 12px' }}>
              {cajas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
        </div>
      </div>

      {msg && <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <div className="tabs">
        <button className={`tab ${tab === 'caja' ? 'active' : ''}`} onClick={() => setTab('caja')}>Turno Actual</button>
        {isAdmin() && <button className={`tab ${tab === 'historial' ? 'active' : ''}`} onClick={() => { setTab('historial'); loadHistorial() }}>Historial Cierres</button>}
      </div>

      {tab === 'caja' && (
        <>
          {/* Estado de la caja */}
          <div className={`caja-estado ${apertura ? 'caja-abierta' : 'caja-cerrada'}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {apertura ? '🟢 Caja Abierta' : '⚫ Caja Cerrada'}
                </div>
                {apertura && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Turno iniciado por <strong>{apertura.usuario_nombre}</strong> — {new Date(apertura.fecha_apertura).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!apertura && <button className="btn btn-primary" onClick={() => setModalAbrir(true)}>▶ Abrir Caja</button>}
                {apertura && (
                  <>
                    <button className="btn btn-secondary" onClick={() => setModalMovimiento(true)}>+ Movimiento</button>
                    <button className="btn btn-gold" onClick={() => setModalCerrar(true)}>⏹ Cerrar Caja</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* KPIs del turno */}
          {apertura && (
            <>
              <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
                <div className="kpi-card green">
                  <div className="kpi-label">Total Ingresos</div>
                  <div className="kpi-value green">₲ {fmt(totalIngresos)}</div>
                </div>
                <div className="kpi-card red">
                  <div className="kpi-label">Total Egresos</div>
                  <div className="kpi-value red">₲ {fmt(totalEgresos)}</div>
                </div>
                <div className="kpi-card blue">
                  <div className="kpi-label">Saldo en Caja</div>
                  <div className="kpi-value blue">₲ {fmt(saldoActual)}</div>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Hora</th><th>Tipo</th><th>Concepto</th><th>Referencia</th><th>Usuario</th><th>Monto</th></tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(m.fecha).toLocaleTimeString('es-PY', { timeStyle: 'short' })}</td>
                        <td><span className={`badge badge-${m.tipo === 'INGRESO' ? 'green' : 'red'}`}>{m.tipo}</span></td>
                        <td>{m.concepto}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.ref_tipo}{m.ref_id ? ` #${m.ref_id}` : ''}</td>
                        <td style={{ fontSize: 12 }}>{m.usuario_nombre}</td>
                        <td style={{ fontWeight: 700, color: m.tipo === 'INGRESO' ? 'var(--green-primary)' : 'var(--red)' }}>
                          {m.tipo === 'INGRESO' ? '+' : '-'}₲ {fmt(m.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {movimientos.length === 0 && <div className="empty-state"><p>Sin movimientos en este turno</p></div>}
              </div>
            </>
          )}

          {/* Resultado del cierre */}
          {resultCierre && !apertura && (
            <div className="card" style={{ borderColor: resultCierre.diferencia === 0 ? 'var(--green-primary)' : 'var(--gold)' }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>✅ Cierre Registrado</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Monto del Sistema</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green-primary)' }}>₲ {fmt(resultCierre.monto_sistema)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Monto Declarado</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>₲ {fmt(montoDeclarado)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Diferencia</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: resultCierre.diferencia === 0 ? 'var(--green-primary)' : resultCierre.diferencia < 0 ? 'var(--red)' : 'var(--gold)' }}>
                    {resultCierre.diferencia > 0 ? '+' : ''}₲ {fmt(resultCierre.diferencia)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'historial' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Apertura</th><th>Cierre</th><th>Caja</th><th>Usuario</th><th>Fondo Inicial</th><th>Sistema</th><th>Declarado</th><th>Diferencia</th></tr>
            </thead>
            <tbody>
              {historial.map((h, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12 }}>{new Date(h.fecha_apertura).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.fecha_cierre ? new Date(h.fecha_cierre).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  <td>{h.caja}</td>
                  <td>{h.usuario}</td>
                  <td>₲ {fmt(h.monto_inicial)}</td>
                  <td>₲ {fmt(h.monto_sistema)}</td>
                  <td>₲ {fmt(h.monto_declarado)}</td>
                  <td style={{ fontWeight: 700, color: h.diferencia === 0 ? 'var(--green-primary)' : h.diferencia < 0 ? 'var(--red)' : 'var(--gold)' }}>
                    {h.diferencia > 0 ? '+' : ''}₲ {fmt(h.diferencia)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Abrir Caja */}
      <Modal open={modalAbrir} onClose={() => setModalAbrir(false)} title="Abrir Caja">
        <div className="modal-body">
          <div className="form-group">
            <label>Fondo inicial (₲)</label>
            <input type="number" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} placeholder="0" autoFocus />
          </div>
          <div className="form-row-3" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label>Cambio USD (₲)</label>
              <input type="number" value={cambioUsd} onChange={e => setCambioUsd(e.target.value)} placeholder="Ej: 7500" />
            </div>
            <div className="form-group">
              <label>Cambio BRL (₲)</label>
              <input type="number" value={cambioBrl} onChange={e => setCambioBrl(e.target.value)} placeholder="Ej: 1350" />
            </div>
            <div className="form-group">
              <label>Cambio ARS (₲)</label>
              <input type="number" value={cambioArs} onChange={e => setCambioArs(e.target.value)} placeholder="Ej: 6" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setModalAbrir(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={abrir}>▶ Abrir Caja</button>
        </div>
      </Modal>

      {/* Modal Cerrar Caja (CIEGO) */}
      <Modal open={modalCerrar} onClose={() => setModalCerrar(false)} title="⏹ Cerrar Caja">
        <div className="modal-body">
          <div className="alert alert-warning">
            🔒 <strong>Cierre Ciego</strong> — Ingresá el efectivo que contás físicamente. El sistema calculará la diferencia después.
          </div>
          <div className="form-group">
            <label>¿Cuánto efectivo contás en caja? (₲)</label>
            <input type="number" value={montoDeclarado} onChange={e => setMontoDeclarado(e.target.value)} placeholder="0" autoFocus />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setModalCerrar(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={() => { cerrar(); setModalCerrar(false) }}>⏹ Confirmar Cierre</button>
        </div>
      </Modal>

      {/* Modal Movimiento Manual */}
      <Modal open={modalMovimiento} onClose={() => setModalMovimiento(false)} title="Registrar Movimiento">
        <div className="modal-body">
          <div className="form-group">
            <label>Tipo</label>
            <select value={movForm.tipo} onChange={e => setMovForm(f => ({ ...f, tipo: e.target.value }))}>
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso / Gasto</option>
            </select>
          </div>
          <div className="form-group">
            <label>Concepto</label>
            <input value={movForm.concepto} onChange={e => setMovForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Ej: Pago de luz, Compra de materiales..." />
          </div>
          <div className="form-group">
            <label>Monto (₲)</label>
            <input type="number" value={movForm.monto} onChange={e => setMovForm(f => ({ ...f, monto: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setModalMovimiento(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={addMovimiento}>✓ Registrar</button>
        </div>
      </Modal>
    </div>
  )
}
