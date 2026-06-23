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
  const [segmento, setSegmento] = useState('TODOS')
  const [excludedProducts, setExcludedProducts] = useState(new Set())
  const [comisionPct, setComisionPct] = useState(70)

  const load = async () => {
    setLoading(true)
    try {
      const q = `?desde=${desde}&hasta=${hasta}`
      let result = []
      if (tab === 'ventas') result = await api.repVentas(q)
      if (tab === 'ventas-detalle') {
        const queryDetalle = `?desde=${desde}&hasta=${hasta}&tipo_inventario=${segmento}`
        result = await api.repVentasDetalle(queryDetalle)
        setExcludedProducts(new Set())
      }
      if (tab === 'cierres') result = await api.repCierres(q)
      if (tab === 'deudores') result = await api.repDeudores()
      if (tab === 'stock') result = await api.repStockCritico()
      if (tab === 'libro-ventas') result = await api.libroVentas(q)
      if (tab === 'libro-compras') result = await api.libroCompras(q)
      setData(result)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab, desde, hasta, segmento])

  const TABS = [
    { id: 'ventas', label: '📊 Ventas Resumen' },
    { id: 'ventas-detalle', label: '🔍 Ventas por Ítem' },
    { id: 'cierres', label: '💰 Cierres de Caja' },
    { id: 'deudores', label: '👥 Deudores' },
    { id: 'stock', label: '📦 Stock Crítico' },
    { id: 'libro-ventas', label: '📋 Libro Ventas' },
    { id: 'libro-compras', label: '📋 Libro Compras' },
  ]

  const totalVentas = tab === 'ventas' ? data.reduce((s, v) => s + Number(v.total || 0), 0) : 0
  const totalDeudores = tab === 'deudores' ? data.reduce((s, d) => s + Number(d.total_a_cobrar || 0), 0) : 0

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

      {['ventas', 'ventas-detalle', 'cierres', 'libro-ventas', 'libro-compras'].includes(tab) && (
        <div className="search-bar">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 160 }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 160 }} />
          </div>
          {tab === 'ventas-detalle' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Segmento</label>
              <select value={segmento} onChange={e => setSegmento(e.target.value)} style={{ padding: '8px 12px', minWidth: 140 }}>
                <option value="TODOS">Todos</option>
                <option value="PETSHOP">Petshop</option>
                <option value="FARMACIA">Farmacia</option>
                <option value="CLINICA">Clínica</option>
              </select>
            </div>
          )}
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

          {tab === 'ventas-detalle' && (() => {
            const categoriesInData = Array.from(new Set(data.map(item => item.categoria_nombre || 'General')))
            const productsInData = data.reduce((acc, item) => {
              const existing = acc.find(p => p.codigo === item.producto_codigo)
              if (!existing) {
                acc.push({
                  codigo: item.producto_codigo,
                  nombre: item.producto_nombre,
                  categoria: item.categoria_nombre || 'General'
                })
              }
              return acc
            }, [])

            const filteredData = data.filter(item => !excludedProducts.has(item.producto_codigo))
            const totalFiltrado = filteredData.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)

            const toggleProduct = (code) => {
              setExcludedProducts(prev => {
                const next = new Set(prev)
                if (next.has(code)) next.delete(code)
                else next.add(code)
                return next
              })
            }

            const toggleCategory = (catName) => {
              const prodsInCat = productsInData.filter(p => p.categoria === catName)
              const allExcluded = prodsInCat.every(p => excludedProducts.has(p.codigo))

              setExcludedProducts(prev => {
                const next = new Set(prev)
                prodsInCat.forEach(p => {
                  if (allExcluded) {
                    next.delete(p.codigo)
                  } else {
                    next.add(p.codigo)
                  }
                })
                return next
              })
            }

            const checkAll = () => setExcludedProducts(new Set())
            const uncheckAll = () => setExcludedProducts(new Set(productsInData.map(p => p.codigo)))

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start', marginTop: 16 }}>
                {/* Tabla principal */}
                <div>
                  <div className="table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Venta #</th>
                          <th>Código</th>
                          <th>Producto</th>
                          <th>Categoría</th>
                          <th>Cant.</th>
                          <th>Precio Unit.</th>
                          <th>Subtotal</th>
                          <th>Cliente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((item, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 11 }}>{new Date(item.fecha).toLocaleDateString('es-PY')}</td>
                            <td>#{item.venta_id}</td>
                            <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.producto_codigo}</td>
                            <td style={{ fontWeight: 500 }}>{item.producto_nombre}</td>
                            <td><span className="badge badge-gray">{item.categoria_nombre || 'General'}</span></td>
                            <td>{item.cantidad}</td>
                            <td>₲ {fmt(item.precio_unit)}</td>
                            <td style={{ fontWeight: 700 }}>₲ {fmt(item.subtotal)}</td>
                            <td>{item.cliente_nombre || 'Consumidor Final'}</td>
                          </tr>
                        ))}
                        {filteredData.length === 0 && (
                          <tr><td colSpan={9} style={{ textAlign: 'center', opacity: 0.5, padding: 30 }}>Sin registros (o todos los ítems fueron excluidos)</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {filteredData.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 16 }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Ventas Seleccionadas</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green-primary)' }}>₲ {fmt(totalFiltrado)}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>% Pago Tercero</label>
                          <input 
                            type="number" 
                            value={comisionPct} 
                            onChange={e => setComisionPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                            style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontWeight: 700 }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pago Correspondiente</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>₲ {fmt(totalFiltrado * comisionPct / 100)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Panel de Selección Lateral */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, maxHeight: '70vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Filtro de Selección</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={checkAll} style={{ padding: '2px 6px', fontSize: 11 }}>Todos</button>
                      <button className="btn btn-secondary btn-sm" onClick={uncheckAll} style={{ padding: '2px 6px', fontSize: 11 }}>Ninguno</button>
                    </div>
                  </div>

                  {data.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, opacity: 0.5, fontSize: 13 }}>No hay datos en el rango seleccionado</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {categoriesInData.map(cat => {
                        const prodsInCat = productsInData.filter(p => p.categoria === cat)
                        const allExcluded = prodsInCat.every(p => excludedProducts.has(p.codigo))
                        const someExcluded = prodsInCat.some(p => excludedProducts.has(p.codigo))
                        const isChecked = !allExcluded

                        return (
                          <div key={cat} style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 10 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 6 }}>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                ref={el => {
                                  if (el) el.indeterminate = isChecked && someExcluded
                                }}
                                onChange={() => toggleCategory(cat)} 
                                style={{ width: 'auto' }}
                              />
                              📂 {cat}
                            </label>
                            
                            <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {prodsInCat.map(p => {
                                const isProdChecked = !excludedProducts.has(p.codigo)
                                return (
                                  <label key={p.codigo} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: isProdChecked ? 'var(--text)' : 'var(--text-muted)' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isProdChecked} 
                                      onChange={() => toggleProduct(p.codigo)} 
                                      style={{ width: 'auto' }}
                                    />
                                    {p.nombre}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

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
                  <span>Total: ₲ {fmt(data.reduce((s, r) => s + Number(r.total || 0), 0))}</span>
                  <span style={{ color: 'var(--green-primary)' }}>IVA 5%: ₲ {fmt(data.reduce((s, r) => s + Number(r.iva_5 || 0), 0))}</span>
                  <span style={{ color: 'var(--green-primary)' }}>IVA 10%: ₲ {fmt(data.reduce((s, r) => s + Number(r.iva_10 || 0), 0))}</span>
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
