import { useState, useEffect } from 'react'
import api from '../api'

const fmt = (n) => new Intl.NumberFormat('es-PY').format(Math.round(n || 0))

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargarDatos = () => {
    setLoading(true)
    setError(null)
    api.dashboard()
      .then(setData)
      .catch((err) => {
        console.error(err)
        setError(err.message || 'No se pudo conectar con el servidor')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargarDatos() }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  if (error || !data) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>No se pudo cargar el Dashboard</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400 }}>
        {error || 'Error desconocido'}. <br />
        Verificá que el backend esté corriendo en el puerto 3001.
      </div>
      <button className="btn btn-primary" onClick={cargarDatos}>🔄 Reintentar</button>
    </div>
  )

  const maxVenta = Math.max(...(data.ventasUltimos7?.map(d => d.total) || [1]), 1)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Resumen en tiempo real — Agro Salto</div>
        </div>
        <button className="btn btn-secondary" onClick={() => window.location.reload()}>🔄 Actualizar</button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card green">
          <div className="kpi-icon">💰</div>
          <div className="kpi-label">Ventas Hoy</div>
          <div className="kpi-value green">₲ {fmt(data.ventasHoy)}</div>
          <div className="kpi-sub">{data.cantVentasHoy} operaciones</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-icon">📅</div>
          <div className="kpi-label">Ventas del Mes</div>
          <div className="kpi-value blue">₲ {fmt(data.ventasMes)}</div>
          <div className="kpi-sub">Mes actual</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon">📦</div>
          <div className="kpi-label">Stock Crítico</div>
          <div className="kpi-value red">{data.stockCritico}</div>
          <div className="kpi-sub">productos bajo mínimo</div>
        </div>
        <div className="kpi-card gold">
          <div className="kpi-icon">⚠️</div>
          <div className="kpi-label">Por Vencer ≤30d</div>
          <div className="kpi-value gold">{data.alertasVto}</div>
          <div className="kpi-sub">lotes con alerta</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-icon">👥</div>
          <div className="kpi-label">Total Deudores</div>
          <div className="kpi-value" style={{ color: 'var(--blue)', fontSize: 22 }}>₲ {fmt(data.deudoresTotal)}</div>
          <div className="kpi-sub">cuentas a cobrar</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Gráfico ventas 7 días */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16 }}>📈 Ventas últimos 7 días</div>
          {data.ventasUltimos7?.length > 0 ? (
            <div className="bar-chart">
              {data.ventasUltimos7.map((d, i) => (
                <div className="bar-item" key={i}>
                  <div className="bar" style={{ height: `${Math.max(8, (d.total / maxVenta) * 80)}px` }} title={`₲ ${fmt(d.total)}`} />
                  <div className="bar-label">{d.dia?.slice(5)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 20 }}>
              <div>Sin ventas en los últimos 7 días</div>
            </div>
          )}
        </div>

        {/* Top productos */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16 }}>🏆 Top 5 Productos (30 días)</div>
          {data.top5Productos?.length > 0 ? (
            <div>
              {data.top5Productos.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--border)' : '' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--green-primary)' }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, fontSize: 13 }}>{p.nombre}</div>
                  <div style={{ fontWeight: 700, color: 'var(--green-primary)' }}>{fmt(p.total_vendido)} u.</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: 20 }}><div>Sin datos de ventas</div></div>
          )}
        </div>
      </div>

      {/* Alertas */}
      {(data.stockCritico > 0 || data.alertasVto > 0) && (
        <div style={{ marginTop: 20 }}>
          {data.stockCritico > 0 && (
            <div className="alert alert-error">
              🔴 <strong>{data.stockCritico} producto(s)</strong> con stock por debajo del mínimo. <a href="/stock" style={{ color: 'inherit', textDecoration: 'underline' }}>Ver Stock →</a>
            </div>
          )}
          {data.alertasVto > 0 && (
            <div className="alert alert-warning" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                ⚠️ <strong>{data.alertasVto} producto(s)</strong> próximos a vencer en los próximos 30 días. <a href="/stock" style={{ color: 'inherit', textDecoration: 'underline' }}>Ver panel de stock →</a>
              </div>
              {data.listaAlertasVto && data.listaAlertasVto.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '4px', marginTop: '5px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '5px' }}>Próximos a vencer:</div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                    {data.listaAlertasVto.map((alerta, i) => (
                      <li key={i}>
                        {alerta.nombre} (Lote: {alerta.numero_lote}) — Vence el {alerta.fecha_vto} 
                        <strong style={{ color: alerta.dias <= 5 ? '#ff4d4f' : 'inherit', marginLeft: '5px' }}>
                          (en {alerta.dias} días)
                        </strong>
                      </li>
                    ))}
                  </ul>
                  {data.alertasVto > 5 && <div style={{ fontSize: '12px', marginTop: '5px' }}>... y {data.alertasVto - 5} más.</div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
