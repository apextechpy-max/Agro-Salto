import { useState, useEffect } from 'react'
import api from '../api'

const fmt = (n) => new Intl.NumberFormat('es-PY').format(Math.round(n || 0))
const today = () => new Date().toISOString().split('T')[0]
const firstOfMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

export default function Reportes() {
  const [tab, setTab] = useState('ventas')
  const [desde, setDesde] = useState(firstOfMonth())
  const [hasta, setHasta] = useState(today())
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const q = `?desde=${desde}&hasta=${hasta}`
      let result = []
      if (tab === 'ventas') result = await api.repVentas(q)
      if (tab === 'cierres') result = await api.repCierres(q)
      if (tab === 'deudores') result = await api.repDeudores()
      if (tab === 'stock') result = await api.repStockCritico()
      if (tab === 'libro-ventas') result = await api.libroVentas(q)
      if (tab === 'libro-compras') result = await api.libroCompras(q)
      setData(result)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab, desde, hasta])

  const TABS = [
    { id: 'ventas', label: '📊 Ventas' },
    { id: 'cierres', label: '💰 Cierres de Caja' },
    { id: 'deudores', label: '👥 Deudores' },
    { id: 'stock', label: '📦 Stock Crítico' },
    { id: 'libro-ventas', label: '📋 Libro Ventas' },
    { id: 'libro-compras', label: '📋 Libro Compras' },
  ]

  const totalVentas = tab === 'ventas' ? data.reduce((s, v) => s + (v.total || 0), 0) : 0
  const totalDeudores = tab === 'deudores' ? data.reduce((s, d) => s + (d.total_a_cobrar || 0), 0) : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">📈 Reportes</div>
          <div className="page-subtitle">Análisis y libros contables</div>
        </div>
      </div>

      <div className="tabs" style={{ flexWrap: 'wrap', width: '100%' }}>
        {TABS.map(t => <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {['ventas', 'cierres', 'libro-ventas', 'libro-compras'].includes(tab) && (
        <div className="search-bar">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 160 }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 160 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={load}>🔍 Buscar</button>
          </div>
        </div>
      )}

      {tab === 'ventas' && totalVentas > 0 && (
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
          <div className="kpi-card green">
            <div className="kpi-label">Total Ventas</div>
            <div className="kpi-value green">₲ {fmt(totalVentas)}</div>
          </div>
          <div className="kpi-card blue">
            <div className="kpi-label">Cant. Operaciones</div>
            <div className="kpi-value blue">{data.length}</div>
          </div>
          <div className="kpi-card gold">
            <div className="kpi-label">Ticket Promedio</div>
            <div className="kpi-value gold">₲ {fmt(totalVentas / (data.length || 1))}</div>
          </div>
        </div>
      )}

      {loading && <div className="loading-center"><div className="spinner" /></div>}

      {!loading && (
        <>
          {tab === 'ventas' && (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Pago</th><th>Total</th><th>Estado</th><th>Usuario</th><th>Filial</th></tr></thead>
                <tbody>
                  {data.map((v, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)' }}>#{v.id}</td>
                      <td style={{ fontSize: 12 }}>{new Date(v.fecha).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{v.cliente || 'Consumidor Final'}</td>
                      <td><span className={`badge badge-${v.tipo === 'MAYORISTA' ? 'blue' : 'green'}`}>{v.tipo}</span></td>
                      <td>{v.tipo_pago}</td>
                      <td style={{ fontWeight: 700 }}>₲ {fmt(v.total)}</td>
                      <td><span className={`badge badge-${v.estado === 'COMPLETADA' ? 'green' : 'red'}`}>{v.estado}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.usuario}</td>
                      <td style={{ fontSize: 12 }}>{v.filial}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length === 0 && <div className="empty-state"><p>Sin ventas en el período</p></div>}
            </div>
          )}

          {tab === 'cierres' && (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Apertura</th><th>Cierre</th><th>Caja</th><th>Usuario</th><th>Sistema</th><th>Declarado</th><th>Diferencia</th></tr></thead>
                <tbody>
                  {data.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>{new Date(c.fecha_apertura).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ fontSize: 12 }}>{c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                      <td>{c.caja}</td>
                      <td>{c.usuario}</td>
                      <td>₲ {fmt(c.monto_sistema)}</td>
                      <td>₲ {fmt(c.monto_declarado)}</td>
                      <td style={{ fontWeight: 700, color: c.diferencia === 0 ? 'var(--green-primary)' : c.diferencia < 0 ? 'var(--red)' : 'var(--gold)' }}>
                        {c.diferencia > 0 ? '+' : ''}₲ {fmt(c.diferencia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'deudores' && (
            <>
              {totalDeudores > 0 && (
                <div className="kpi-card red" style={{ marginBottom: 16, maxWidth: 300 }}>
                  <div className="kpi-label">Total a Cobrar</div>
                  <div className="kpi-value red">₲ {fmt(totalDeudores)}</div>
                </div>
              )}
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Cliente</th><th>RUC/CI</th><th>Teléfono</th><th>Cuentas</th><th>Total a Cobrar</th></tr></thead>
                  <tbody>
                    {data.map((d, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{d.razon_social}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{d.ruc || '—'}</td>
                        <td>{d.telefono || '—'}</td>
                        <td>{d.cant_cuentas}</td>
                        <td style={{ fontWeight: 700, color: 'var(--red)' }}>₲ {fmt(d.total_a_cobrar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length === 0 && <div className="empty-state"><div className="empty-icon">✅</div><p>Sin deudores pendientes</p></div>}
              </div>
            </>
          )}

          {tab === 'stock' && (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Código</th><th>Producto</th><th>Filial</th><th>Stock Mínimo</th><th>Stock Actual</th></tr></thead>
                <tbody>
                  {data.map((s, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.codigo}</td>
                      <td>{s.nombre}</td>
                      <td>{s.filial}</td>
                      <td>{s.stock_minimo}</td>
                      <td style={{ fontWeight: 700, color: s.stock_actual === 0 ? 'var(--red)' : 'var(--gold)' }}>{s.stock_actual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length === 0 && <div className="empty-state"><div className="empty-icon">✅</div><p>Todo el stock está por encima del mínimo</p></div>}
            </div>
          )}

          {(tab === 'libro-ventas' || tab === 'libro-compras') && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Fecha</th>
                    <th>{tab === 'libro-ventas' ? 'Cliente' : 'Proveedor'}</th>
                    <th>RUC</th>
                    {tab === 'libro-ventas' ? <th>Cond. IVA</th> : <th>Nro. Factura</th>}
                    <th>Subtotal</th><th>IVA 5%</th><th>IVA 10%</th><th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)' }}>#{r.id}</td>
                      <td style={{ fontSize: 12 }}>{r.fecha?.slice(0, 10)}</td>
                      <td>{r.razon_social || r.proveedor || 'Consumidor Final'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.ruc || '—'}</td>
                      <td>{tab === 'libro-ventas' ? r.condicion_iva : r.numero_factura || '—'}</td>
                      <td>₲ {fmt(r.subtotal)}</td>
                      <td>₲ {fmt(r.iva_5)}</td>
                      <td>₲ {fmt(r.iva_10)}</td>
                      <td style={{ fontWeight: 700 }}>₲ {fmt(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 0 && (
                <div style={{ padding: '12px 16px', borderTop: '2px solid var(--border-light)', display: 'flex', gap: 24, fontWeight: 700 }}>
                  <span>Total: ₲ {fmt(data.reduce((s, r) => s + r.total, 0))}</span>
                  <span style={{ color: 'var(--green-primary)' }}>IVA 5%: ₲ {fmt(data.reduce((s, r) => s + r.iva_5, 0))}</span>
                  <span style={{ color: 'var(--green-primary)' }}>IVA 10%: ₲ {fmt(data.reduce((s, r) => s + r.iva_10, 0))}</span>
                </div>
              )}
              {data.length === 0 && <div className="empty-state"><p>Sin registros en el período</p></div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
