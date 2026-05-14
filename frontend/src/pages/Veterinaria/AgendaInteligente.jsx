import { useState, useEffect, useCallback } from 'react'
import api from '../../api'

const TIPO_COLORS = {
  CONSULTA: '#4A90D9', CIRUGIA: '#E53935', VACUNA: '#43A047',
  BANO_ESTETICA: '#8E24AA', CONTROL: '#FB8C00', EMERGENCIA: '#D32F2F',
  RECORDATORIO: '#039BE5', OTRO: '#757575'
}

const TIPO_ICONS = {
  CONSULTA: '🩺', CIRUGIA: '🔬', VACUNA: '💉', BANO_ESTETICA: '🛁',
  CONTROL: '📋', EMERGENCIA: '🚨', RECORDATORIO: '🔔', OTRO: '📝'
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  return days
}

const initForm = {
  mascota_id: '', persona_id: '', titulo: '', tipo_evento: 'CONSULTA',
  fecha_inicio: '', fecha_fin: '', veterinario_id: '', notas: ''
}

export default function AgendaInteligente() {
  const [eventos, setEventos] = useState([])
  const [mascotas, setMascotas] = useState([])
  const [clientes, setClientes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(initForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [waInfo, setWaInfo] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const calDays = getCalendarDays(year, month)

  const desde = new Date(year, month, 1).toISOString().split('T')[0]
  const hasta = new Date(year, month + 1, 0).toISOString().split('T')[0]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ev, m, c, u] = await Promise.all([
        api.agenda(`?desde=${desde}&hasta=${hasta}`),
        api.mascotas(),
        api.personas('?tipo=CLIENTE'),
        api.veterinarios()
      ])
      setEventos(ev)
      setMascotas(m)
      setClientes(c)
      setUsuarios(u)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [desde, hasta])

  useEffect(() => { load() }, [load])

  const eventosDelDia = (day) => {
    if (!day) return []
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return eventos.filter(e => e.fecha_inicio.startsWith(dateStr))
  }

  const openNew = (day) => {
    const dateStr = day
      ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T08:00`
      : ''
    setForm({ ...initForm, fecha_inicio: dateStr })
    setModal('form')
  }

  const openEvento = (ev) => {
    setModal(ev)
  }

  const handleSave = async () => {
    if (!form.titulo || !form.fecha_inicio) { setError('Título y fecha son obligatorios'); return }
    setSaving(true); setError('')
    try {
      await api.createEvento(form)
      setModal(null); load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleWhatsApp = async (id) => {
    try {
      const info = await api.whatsappEvento(id)
      setWaInfo(info)
    } catch (e) { setError(e.message) }
  }

  const handleEstado = async (id, estado) => {
    try { await api.estadoEvento(id, estado); setModal(null); load() }
    catch (e) { setError(e.message) }
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">📅 Agenda Inteligente</h1>
          <p className="page-subtitle">Calendario de turnos, cirugías, vacunas y controles</p>
        </div>
        <button className="btn btn-primary" onClick={() => openNew(null)}>+ Nuevo Turno</button>
      </div>

      {error && <div className="alert-error">{error}<button onClick={() => setError('')}>✕</button></div>}

      {/* Leyenda de colores */}
      <div className="agenda-legend">
        {Object.entries(TIPO_ICONS).map(([tipo, icon]) => (
          <span key={tipo} className="legend-item" style={{ borderLeft: `3px solid ${TIPO_COLORS[tipo]}` }}>
            {icon} {tipo.replace('_', ' ')}
          </span>
        ))}
      </div>

      {/* Navegación del calendario */}
      <div className="cal-nav">
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹ Anterior</button>
        <h2 className="cal-month-title">{MESES[month]} {year}</h2>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}>Siguiente ›</button>
      </div>

      {/* Calendario */}
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="calendar-grid">
          {DIAS.map(d => <div key={d} className="cal-header-day">{d}</div>)}
          {calDays.map((day, i) => {
            const evs = eventosDelDia(day)
            const isToday = day && new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
            return (
              <div key={i} className={`cal-day ${!day ? 'cal-empty' : ''} ${isToday ? 'cal-today' : ''}`} onClick={() => day && openNew(day)}>
                {day && <div className="cal-day-num">{day}</div>}
                {evs.slice(0, 3).map(ev => (
                  <div
                    key={ev.id}
                    className="cal-event"
                    style={{ background: TIPO_COLORS[ev.tipo_evento] || '#4A90D9' }}
                    onClick={e => { e.stopPropagation(); openEvento(ev) }}
                  >
                    {TIPO_ICONS[ev.tipo_evento]} {ev.titulo}
                  </div>
                ))}
                {evs.length > 3 && <div className="cal-more">+{evs.length - 3} más</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Formulario */}
      {modal === 'form' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>📅 Nuevo Turno / Evento</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-grid-2">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Título del evento *</label>
                <input className="form-input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Vacuna antirrábica de Max" />
              </div>
              <div className="form-group">
                <label>Tipo de evento</label>
                <select className="form-input" value={form.tipo_evento} onChange={e => setForm(f => ({ ...f, tipo_evento: e.target.value }))}>
                  {Object.keys(TIPO_COLORS).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Veterinario</label>
                <select className="form-input" value={form.veterinario_id} onChange={e => setForm(f => ({ ...f, veterinario_id: e.target.value }))}>
                  <option value="">— Sin asignar —</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre_completo}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Cliente / Dueño</label>
                <select className="form-input" value={form.persona_id} onChange={e => setForm(f => ({ ...f, persona_id: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Mascota</label>
                <select className="form-input" value={form.mascota_id} onChange={e => setForm(f => ({ ...f, mascota_id: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {mascotas.filter(m => !form.persona_id || m.persona_id == form.persona_id).map(m => <option key={m.id} value={m.id}>{m.nombre} ({m.especie})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha y hora inicio *</label>
                <input type="datetime-local" className="form-input" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Fecha y hora fin</label>
                <input type="datetime-local" className="form-input" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Notas</label>
                <textarea className="form-input" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Indicaciones previas, ayuno, etc." />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Agendar Turno'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle de evento */}
      {modal && modal.id && (
        <div className="modal-overlay" onClick={() => { setModal(null); setWaInfo(null) }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 style={{ borderLeft: `4px solid ${TIPO_COLORS[modal.tipo_evento]}`, paddingLeft: 10 }}>
                {TIPO_ICONS[modal.tipo_evento]} {modal.titulo}
              </h3>
              <button className="modal-close" onClick={() => { setModal(null); setWaInfo(null) }}>✕</button>
            </div>
            <div className="evento-detail">
              <div className="evento-row"><span className="evento-label">📅 Fecha</span><span>{new Date(modal.fecha_inicio).toLocaleString('es-PY')}</span></div>
              <div className="evento-row"><span className="evento-label">🐾 Mascota</span><span>{modal.mascota_nombre || '—'} {modal.especie ? `(${modal.especie})` : ''}</span></div>
              <div className="evento-row"><span className="evento-label">👤 Dueño</span><span>{modal.dueno_nombre || '—'}</span></div>
              <div className="evento-row"><span className="evento-label">📞 Teléfono</span><span>{modal.dueno_telefono || '—'}</span></div>
              <div className="evento-row"><span className="evento-label">👨‍⚕️ Veterinario</span><span>{modal.veterinario_nombre || '—'}</span></div>
              {modal.notas && <div className="evento-row"><span className="evento-label">📝 Notas</span><span>{modal.notas}</span></div>}
              <div className="evento-row">
                <span className="evento-label">Estado</span>
                <span className={`estado-badge estado-${modal.estado?.toLowerCase()}`}>{modal.estado}</span>
              </div>
            </div>

            {waInfo && (
              <div className="wa-box">
                <p className="wa-mensaje">{waInfo.mensaje}</p>
                <a href={waInfo.link} target="_blank" rel="noopener noreferrer" className="btn btn-wa">
                  <span>💬</span> Abrir en WhatsApp
                </a>
              </div>
            )}

            <div className="modal-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
              {modal.estado === 'PROGRAMADO' && (
                <>
                  <button className="btn btn-success" onClick={() => handleEstado(modal.id, 'CONFIRMADO')}>✅ Confirmar</button>
                  <button className="btn btn-danger" onClick={() => handleEstado(modal.id, 'CANCELADO')}>✕ Cancelar</button>
                </>
              )}
              <button className="btn btn-wa-outline" onClick={() => handleWhatsApp(modal.id)}>
                {modal.notificado_wa ? '💬 Re-notificar WA' : '💬 Notificar por WhatsApp'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setModal(null); setWaInfo(null) }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
