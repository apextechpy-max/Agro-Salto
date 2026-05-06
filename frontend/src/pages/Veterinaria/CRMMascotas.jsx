import { useState, useEffect, useCallback } from 'react'
import api from '../../api'

const SPECIES_ICONS = { Perro: '🐕', Gato: '🐈', Ave: '🦜', Conejo: '🐇', Reptil: '🦎', Otro: '🐾' }
const SEX_LABEL = { MACHO: '♂ Macho', HEMBRA: '♀ Hembra', DESCONOCIDO: '⚧ Descon.' }

const initForm = { persona_id: '', nombre: '', especie: 'Perro', raza: '', color: '', sexo: 'DESCONOCIDO', fecha_nacimiento: '', peso_kg: '', microchip: '', observaciones: '' }

export default function CRMMascotas() {
  const [mascotas, setMascotas] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'nuevo' | mascota
  const [form, setForm] = useState(initForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [detailTab, setDetailTab] = useState('info') // 'info', 'historial', 'estudios'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : ''
      const [m, c] = await Promise.all([api.mascotas(q), api.personas('?tipo=CLIENTE')])
      setMascotas(m)
      setClientes(c)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm(initForm); setEditMode(false); setModal('nuevo') }
  const openEdit = (m) => {
    setForm({
      persona_id: m.persona_id, nombre: m.nombre, especie: m.especie, raza: m.raza || '',
      color: m.color || '', sexo: m.sexo || 'DESCONOCIDO', fecha_nacimiento: m.fecha_nacimiento || '',
      peso_kg: m.peso_kg || '', microchip: m.microchip || '', observaciones: m.observaciones || ''
    })
    setEditMode(m.id)
    setModal('nuevo')
  }

  const openDetail = async (id) => {
    try { 
      const d = await api.getMascota(id); 
      setModal(d); 
      setDetailTab('info'); 
    } catch (e) { setError(e.message) }
  }

  const handleSave = async () => {
    if (!form.persona_id || !form.nombre || !form.especie) { setError('Dueño, nombre y especie son obligatorios'); return }
    setSaving(true); setError('')
    try {
      if (editMode) { await api.updateMascota(editMode, form) }
      else { await api.createMascota(form) }
      setModal(null); load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const calcEdad = (fn) => {
    if (!fn) return '—'
    const diff = Date.now() - new Date(fn).getTime()
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
    if (years > 0) return `${years} año${years > 1 ? 's' : ''}`
    return `${months} mes${months !== 1 ? 'es' : ''}`
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🐾 CRM Mascotas</h1>
          <p className="page-subtitle">Registro de pacientes y fichas técnicas</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva Mascota</button>
      </div>

      {error && <div className="alert-error">{error}<button onClick={() => setError('')}>✕</button></div>}

      {/* Buscador */}
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input className="search-input" placeholder="Buscar por nombre, especie o dueño..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Grid de mascotas */}
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="mascotas-grid">
          {mascotas.length === 0 && <div className="empty-state">🐾<br/>No hay mascotas registradas</div>}
          {mascotas.map(m => (
            <div className="mascota-card" key={m.id} onClick={() => openDetail(m.id)}>
              <div className="mascota-avatar">{SPECIES_ICONS[m.especie] || '🐾'}</div>
              <div className="mascota-info">
                <div className="mascota-nombre">{m.nombre}</div>
                <div className="mascota-especie">{m.especie}{m.raza ? ` · ${m.raza}` : ''}</div>
                <div className="mascota-meta">
                  <span className="mascota-dueno">👤 {m.dueno_nombre}</span>
                  <span className="mascota-tel">📞 {m.dueno_telefono || '—'}</span>
                </div>
                <div className="mascota-badges">
                  <span className="badge badge-sex">{SEX_LABEL[m.sexo] || m.sexo}</span>
                  {m.peso_kg && <span className="badge badge-peso">⚖️ {m.peso_kg}kg</span>}
                  {m.fecha_nacimiento && <span className="badge badge-edad">🎂 {calcEdad(m.fecha_nacimiento)}</span>}
                </div>
              </div>
              <button className="btn-edit-card" onClick={e => { e.stopPropagation(); openEdit(m) }}>✏️</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nuevo / Editar */}
      {modal === 'nuevo' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>{editMode ? '✏️ Editar Mascota' : '🐾 Nueva Mascota'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-grid-2">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Dueño / Cliente *</label>
                <select className="form-input" value={form.persona_id} onChange={e => setForm(f => ({ ...f, persona_id: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social} {c.ci ? `· CI ${c.ci}` : ''} {c.telefono ? `· ${c.telefono}` : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Nombre de la mascota *</label>
                <input className="form-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Max" />
              </div>
              <div className="form-group">
                <label>Especie *</label>
                <select className="form-input" value={form.especie} onChange={e => setForm(f => ({ ...f, especie: e.target.value }))}>
                  {['Perro', 'Gato', 'Ave', 'Conejo', 'Reptil', 'Bovino', 'Equino', 'Porcino', 'Ovino', 'Otro'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Raza</label>
                <input className="form-input" value={form.raza} onChange={e => setForm(f => ({ ...f, raza: e.target.value }))} placeholder="Ej: Labrador" />
              </div>
              <div className="form-group">
                <label>Color / Pelaje</label>
                <input className="form-input" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="Ej: Negro con blanco" />
              </div>
              <div className="form-group">
                <label>Sexo</label>
                <select className="form-input" value={form.sexo} onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
                  <option value="MACHO">♂ Macho</option>
                  <option value="HEMBRA">♀ Hembra</option>
                  <option value="DESCONOCIDO">⚧ Desconocido</option>
                </select>
              </div>
              <div className="form-group">
                <label>Fecha de Nacimiento</label>
                <input type="date" className="form-input" value={form.fecha_nacimiento} onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Peso (kg)</label>
                <input type="number" step="0.1" className="form-input" value={form.peso_kg} onChange={e => setForm(f => ({ ...f, peso_kg: e.target.value }))} placeholder="Ej: 12.5" />
              </div>
              <div className="form-group">
                <label>Microchip / Nro. Identificación</label>
                <input className="form-input" value={form.microchip} onChange={e => setForm(f => ({ ...f, microchip: e.target.value }))} placeholder="Ej: 9842ABC" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Observaciones / Alergias</label>
                <textarea className="form-input" rows={3} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Alergias, condiciones previas, notas importantes..." />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : editMode ? 'Actualizar' : 'Registrar Mascota'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle */}
      {modal && modal.id && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h3>{SPECIES_ICONS[modal.especie] || '🐾'} {modal.nombre} <span style={{ fontSize: 14, opacity: 0.6 }}>#{modal.id}</span></h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="tabs" style={{ margin: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <button className={`tab ${detailTab === 'info' ? 'tab-active' : ''}`} onClick={() => setDetailTab('info')}>📄 Ficha Técnica</button>
              <button className={`tab ${detailTab === 'historial' ? 'tab-active' : ''}`} onClick={() => setDetailTab('historial')}>📋 Historial Clínico</button>
              <button className={`tab ${detailTab === 'estudios' ? 'tab-active' : ''}`} onClick={() => setDetailTab('estudios')}>📎 Estudios ({modal.estudios?.length || 0})</button>
            </div>

            {detailTab === 'info' && (
              <div className="mascota-detail-grid">
                <div className="mascota-detail-card">
                  <div className="detail-label">Especie / Raza</div>
                  <div className="detail-value">{modal.especie} {modal.raza ? `· ${modal.raza}` : ''}</div>
                </div>
                <div className="mascota-detail-card">
                  <div className="detail-label">Dueño</div>
                  <div className="detail-value">{modal.dueno_nombre}</div>
                </div>
                <div className="mascota-detail-card">
                  <div className="detail-label">Teléfono</div>
                  <div className="detail-value">{modal.dueno_telefono || '—'}</div>
                </div>
                <div className="mascota-detail-card">
                  <div className="detail-label">Sexo</div>
                  <div className="detail-value">{SEX_LABEL[modal.sexo]}</div>
                </div>
                <div className="mascota-detail-card">
                  <div className="detail-label">Edad</div>
                  <div className="detail-value">{calcEdad(modal.fecha_nacimiento)}</div>
                </div>
                <div className="mascota-detail-card">
                  <div className="detail-label">Peso actual</div>
                  <div className="detail-value">{modal.peso_kg ? `${modal.peso_kg} kg` : '—'}</div>
                </div>
                {modal.microchip && (
                  <div className="mascota-detail-card">
                    <div className="detail-label">Microchip</div>
                    <div className="detail-value">{modal.microchip}</div>
                  </div>
                )}
                {modal.observaciones && (
                  <div className="mascota-detail-card" style={{ gridColumn: '1/-1' }}>
                    <div className="detail-label">Observaciones</div>
                    <div className="detail-value">{modal.observaciones}</div>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'historial' && (
              <div className="mascota-historial" style={{ marginTop: 0 }}>
                {!modal.consultas || modal.consultas.length === 0
                  ? <p className="empty-state-sm">Sin consultas registradas</p>
                  : modal.consultas.map(c => (
                    <div className="historial-item" key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="badge-tipo">{c.tipo_consulta}</span>
                          <span className="historial-fecha" style={{ fontWeight: 600 }}>{new Date(c.fecha).toLocaleDateString('es-PY')}</span>
                        </div>
                        <div className="historial-vet">👨‍⚕️ {c.veterinario_nombre || 'Sin asignar'}</div>
                      </div>
                      
                      {c.diagnostico && (
                        <div>
                          <strong style={{ fontSize: 13, color: 'var(--text-muted)' }}>Diagnóstico / Motivo:</strong>
                          <div style={{ fontSize: 14 }}>{c.diagnostico || c.motivo}</div>
                        </div>
                      )}
                      
                      {c.tratamiento && (
                        <div style={{ background: 'var(--bg-body)', padding: 8, borderRadius: 6 }}>
                          <strong style={{ fontSize: 13, color: 'var(--blue)' }}>Tratamiento:</strong>
                          <div style={{ fontSize: 13 }}>{c.tratamiento}</div>
                        </div>
                      )}

                      {c.recetas && c.recetas.length > 0 && (
                        <div style={{ borderLeft: '3px solid var(--green-primary)', paddingLeft: 8 }}>
                          <strong style={{ fontSize: 13, color: 'var(--green-primary)' }}>Recetado:</strong>
                          {c.recetas.map((r, ri) => (
                            <div key={ri} style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {r.indicaciones && <div style={{ fontStyle: 'italic' }}>{r.indicaciones}</div>}
                              <div>- {r.cantidad}x {r.descripcion} <span style={{ opacity: 0.6 }}>({r.posologia})</span></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>
            )}

            {detailTab === 'estudios' && (
              <div className="mascota-historial" style={{ marginTop: 0 }}>
                {!modal.estudios || modal.estudios.length === 0
                  ? <p className="empty-state-sm">No hay estudios adjuntos</p>
                  : modal.estudios.map(e => (
                    <div className="historial-item" key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{e.nombre}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{e.descripcion || 'Sin descripción'}</div>
                        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                          📅 {new Date(e.consulta_fecha || e.creado_en || Date.now()).toLocaleDateString('es-PY')}
                        </div>
                      </div>
                      <a href={`http://localhost:3001${e.url_path}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
                        Ver Estudio
                      </a>
                    </div>
                  ))
                }
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => openEdit(modal)}>✏️ Editar Ficha</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
