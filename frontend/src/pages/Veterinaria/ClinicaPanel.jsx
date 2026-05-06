import { useState, useEffect, useCallback } from 'react'
import api from '../../api'
import logoImg from '../../assets/medallon_final.png'

const TIPO_ICONS = { CONSULTA: '🩺', CIRUGIA: '🔬', VACUNA: '💉', BANO_ESTETICA: '🛁', CONTROL: '📋', EMERGENCIA: '🚨', OTRO: '📝' }

export default function ClinicaPanel() {
  const [tab, setTab] = useState('en_curso')
  const [consultas, setConsultas] = useState([])
  const [internaciones, setInternaciones] = useState([])
  const [mascotas, setMascotas] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selectedConsulta, setSelectedConsulta] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [evolucion, setEvolucion] = useState([])
  const [showJustificacion, setShowJustificacion] = useState(false)
  const [justificacion, setJustificacion] = useState('')
  const [showInternarConfirm, setShowInternarConfirm] = useState(false)

  // Formulario nueva consulta
  const [formC, setFormC] = useState({ cliente_id: '', mascota_id: '', tipo_consulta: 'CONSULTA', motivo: '', peso_kg: '', temperatura: '', diagnostico: '', tratamiento: '', observaciones: '', estado: 'EN_CURSO' })
  const [mascotasFiltradas, setMascotasFiltradas] = useState([])
  const [historialMascota, setHistorialMascota] = useState(null)
  // Formulario pre-venta
  const [pvItems, setPvItems] = useState([])
  const [pvClienteId, setPvClienteId] = useState('')
  // Formulario receta
  const [recItems, setRecItems] = useState([{ descripcion: '', cantidad: 1, posologia: '' }])
  const [recIndicaciones, setRecIndicaciones] = useState('')
  // Subir estudios
  const [estudioFile, setEstudioFile] = useState(null)
  const [estudioDesc, setEstudioDesc] = useState('')
  // Constante vital
  const [constante, setConstante] = useState({ temperatura: '', frecuencia_card: '', frecuencia_resp: '', peso_kg: '', observacion: '' })
  const [constantes, setConstantes] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, i, m, cl, p] = await Promise.all([
        api.consultas('?estado=PENDIENTE,EN_CURSO'),
        api.internaciones(),
        api.mascotas(),
        api.personas('?tipo=CLIENTE'),
        api.productos('?tipo_inventario=CLINICA')
      ])
      setConsultas(c); setInternaciones(i); setMascotas(m); setClientes(cl); setProductos(p)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openConsulta = async (id) => {
    try {
      const d = await api.getConsulta(id)
      const ev = await api.getProgreso(id) // Nueva API para evolución
      setEvolucion(ev)
      // Si está pendiente, al abrirla pasa a EN_CURSO automáticamente
      if (d.estado === 'PENDIENTE') {
        await api.updateConsulta(id, { ...d, estado: 'EN_CURSO' })
        d.estado = 'EN_CURSO'
        load()
      }
      setSelectedConsulta(d)
      setModal('detalle')
    } catch (e) { setError(e.message) }
  }

  const handleCrearConsulta = async () => {
    if (!formC.mascota_id) { setError('Seleccione una mascota'); return }
    setSaving(true); setError('')
    try {
      const res = await api.createConsulta(formC)
      setFormC({ cliente_id: '', mascota_id: '', tipo_consulta: 'CONSULTA', motivo: '', peso_kg: '', temperatura: '', diagnostico: '', tratamiento: '', observaciones: '', estado: 'EN_CURSO' })
      setHistorialMascota(null)
      load()
      // Abrir automáticamente la consulta recién creada
      openConsulta(res.id)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleClienteChange = (cid) => {
    setFormC(f => ({ ...f, cliente_id: cid, mascota_id: '' }))
    setHistorialMascota(null)
    if (cid) {
      const m = mascotas.filter(x => x.persona_id == cid)
      setMascotasFiltradas(m)
    } else {
      setMascotasFiltradas([])
    }
  }

  const handleMascotaChange = async (mid) => {
    setFormC(f => ({ ...f, mascota_id: mid }))
    if (mid) {
      try {
        const d = await api.getMascota(mid)
        setHistorialMascota(d)
      } catch (e) { console.error(e) }
    } else {
      setHistorialMascota(null)
    }
  }

  const handleUpdateConsulta = async () => {
    // Verificar si hubo cambios en diagnostico o tratamiento
    const prev = evolucion[0] || { diagnostico: '', tratamiento: '' }
    const changed = selectedConsulta.diagnostico !== prev.diagnostico || selectedConsulta.tratamiento !== prev.tratamiento

    if (changed && !justificacion) {
      setShowJustificacion(true)
      return
    }

    setSaving(true); setError('')
    try {
      await api.updateConsulta(selectedConsulta.id, {
        diagnostico: selectedConsulta.diagnostico,
        tratamiento: selectedConsulta.tratamiento,
        observaciones: selectedConsulta.observaciones,
        estado: selectedConsulta.estado,
        peso_kg: selectedConsulta.peso_kg,
        temperatura: selectedConsulta.temperatura,
        justificacion: justificacion
      })
      setJustificacion('')
      setShowJustificacion(false)
      load(); setModal(null)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleInternar = async () => {
    setSaving(true); setError('')
    try {
      await api.crearInternacion({
        consulta_id: selectedConsulta.id,
        mascota_id: selectedConsulta.mascota_id,
        observaciones: `Internado desde consulta #${selectedConsulta.id}`
      })
      // Actualizar estado de consulta a FINALIZADA
      await api.updateConsulta(selectedConsulta.id, { ...selectedConsulta, estado: 'FINALIZADA' })
      alert('✅ Paciente internado correctamente.')
      setShowInternarConfirm(false)
      load(); setModal(null)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handlePreVenta = async () => {
    if (!pvItems.length) { setError('Agregue al menos un ítem'); return }
    setSaving(true); setError('')
    try {
      const r = await api.consultaPreVenta(selectedConsulta.id, { items: pvItems, cliente_id: pvClienteId || null, filial_id: 1 })
      alert(`✅ Pre-venta #${r.venta_id} creada. El cajero puede procesar el cobro.`)
      setModal('detalle'); load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handlePrintReceta = (receta) => {
    const w = window.open('', '_blank')
    w.document.write(`
      <html>
        <head>
          <title>Receta Veterinaria - Agrosaltos</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; width: 350px; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 15px; }
            .logo-container { margin-bottom: 10px; }
            .logo { width: 80px; height: 80px; border-radius: 50%; }
            .vet-name { font-weight: 800; font-size: 18px; color: #10b981; margin: 5px 0; text-transform: uppercase; }
            .vet-title { font-size: 13px; font-weight: 600; margin: 0; }
            .vet-reg { font-size: 12px; margin: 2px 0; color: #444; }
            
            .client-info { background: #f9f9f9; padding: 10px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #10b981; }
            .info-line { font-size: 12px; margin: 3px 0; }
            
            .section-title { font-weight: bold; font-size: 13px; margin-top: 15px; background: #eee; padding: 4px 8px; border-radius: 3px; display: flex; align-items: center; gap: 5px; }
            .item { font-size: 12px; margin-top: 10px; border-bottom: 1px dotted #ccc; padding-bottom: 5px; }
            .item-desc { font-weight: bold; font-size: 13px; color: #111; }
            .item-pos { padding-left: 5px; font-style: italic; color: #555; margin-top: 2px; }
            
            .footer { text-align: center; margin-top: 40px; font-size: 11px; }
            .signature { margin-top: 50px; border-top: 1px solid #000; display: inline-block; width: 200px; padding-top: 5px; }
            @media print { body { width: 100%; margin: 0; padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-container">
              <img src="${logoImg}" class="logo" />
            </div>
            <div class="vet-name">AGROSALTOS</div>
            <div class="vet-title" style="font-weight: 700; font-size: 15px; margin-top: 5px;">Dr. Jorge Mayeregger</div>
            <div class="vet-reg">Médico Veterinario</div>
            <div class="vet-reg">Reg. Nro. 5493 — Cel: 0983 150171</div>
          </div>

          <div class="client-info">
            <div class="info-line"><strong>FECHA:</strong> ${new Date(receta.fecha).toLocaleDateString('es-PY')}</div>
            <div class="info-line"><strong>PACIENTE:</strong> ${receta.mascota}</div>
            <div class="info-line"><strong>PROPIETARIO:</strong> ${receta.dueno}</div>
          </div>
          
          <div class="section-title">💊 MEDICACIÓN Y TRATAMIENTO</div>
          ${(receta.items || []).map(it => `
            <div class="item">
              <div class="item-desc">${it.cantidad}x ${it.descripcion}</div>
              <div class="item-pos">${it.posologia || ''}</div>
            </div>
          `).join('')}
          
          ${receta.indicaciones ? `
            <div class="section-title">📝 INDICACIONES GENERALES</div>
            <div class="item" style="white-space: pre-wrap; border: none;">${receta.indicaciones}</div>
          ` : ''}

          <div class="footer">
            <div class="signature">Firma y Sello Profesional</div>
            <p style="margin-top: 15px; opacity: 0.7;">Agrosaltos — Salto del Guairá</p>
          </div>
        </body>
      </html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 500)
  }

  const handleReceta = async () => {
    setSaving(true); setError('')
    try {
      const recetaGuardada = await api.crearReceta(selectedConsulta.id, { indicaciones: recIndicaciones, items: recItems.filter(i => i.descripcion || i.producto_id) })
      setModal('detalle')
      // Lanzar impresión térmica automáticamente
      handlePrintReceta(recetaGuardada)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleSubirEstudio = async () => {
    if (!estudioFile) { setError('Seleccione un archivo'); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('archivo', estudioFile)
      fd.append('descripcion', estudioDesc)
      await api.subirEstudio(selectedConsulta.id, fd)
      alert('✅ Estudio subido correctamente')
      // Refrescar datos de la consulta para ver los nuevos estudios
      const updated = await api.getConsulta(selectedConsulta.id)
      setSelectedConsulta(updated)
      setModal('detalle')
      setEstudioFile(null)
      setEstudioDesc('')
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const addPvItem = (prodId) => {
    const prod = productos.find(p => p.id == prodId)
    if (!prod) return
    const exists = pvItems.find(i => i.producto_id == prodId)
    if (exists) setPvItems(pvItems.map(i => i.producto_id == prodId ? { ...i, cantidad: i.cantidad + 1 } : i))
    else setPvItems([...pvItems, { producto_id: prod.id, nombre: prod.nombre, precio: prod.precio_venta_menor, cantidad: 1 }])
  }

  const loadConstantes = async (internId) => {
    const c = await api.constantes(internId)
    setConstantes(c)
  }

  const handleAddConstante = async (internId) => {
    setSaving(true)
    try {
      await api.addConstante(internId, constante)
      setConstante({ temperatura: '', frecuencia_card: '', frecuencia_resp: '', peso_kg: '', observacion: '' })
      loadConstantes(internId)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleAlta = async (internId) => {
    if (!window.confirm('¿Dar de alta al paciente?')) return
    try { await api.altaInternacion(internId, { estado: 'ALTA' }); load() } catch (e) { setError(e.message) }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">🏥 Panel Clínico</h1>
          <p className="page-subtitle">Gestión de consultas, internación y recetas</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('nueva')}>+ Nueva Consulta</button>
      </div>

      {error && <div className="alert-error">{error}<button onClick={() => setError('')}>✕</button></div>}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'en_curso' ? 'tab-active' : ''}`} onClick={() => setTab('en_curso')}>🏥 Consultas en Curso / Observación ({consultas.length})</button>
        <button className={`tab ${tab === 'internacion' ? 'tab-active' : ''}`} onClick={() => setTab('internacion')}>🛏️ Internación ({internaciones.length})</button>
      </div>

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <>
          {/* Tab Consultas En Curso */}
          {tab === 'en_curso' && (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Mascota</th><th>Dueño</th><th>Motivo</th><th>Veterinario</th><th>Acciones</th></tr></thead>
                <tbody>
                  {consultas.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>No hay pacientes en curso</td></tr>}
                  {consultas.map(c => (
                    <tr key={c.id}>
                      <td>{new Date(c.fecha).toLocaleDateString('es-PY')}</td>
                      <td><span style={{ fontSize: 18 }}>{TIPO_ICONS[c.tipo_consulta] || '🩺'}</span> {c.tipo_consulta}</td>
                      <td><strong>{c.mascota_nombre}</strong><br /><small style={{ opacity: 0.7 }}>{c.especie}</small></td>
                      <td>{c.dueno_nombre}</td>
                      <td>{c.motivo || '—'}</td>
                      <td>{c.veterinario_nombre || '—'}</td>
                      <td>
                        <button className="btn btn-sm btn-gold" onClick={() => openConsulta(c.id)}>Atender / Ver Historial</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab Internación */}
          {tab === 'internacion' && (
            <div className="internacion-grid">
              {internaciones.length === 0 && <div className="empty-state">🛏️<br />No hay pacientes internados</div>}
              {internaciones.map(i => (
                <div className="internacion-card" key={i.id}>
                  <div className="intern-header">
                    <div className="intern-nombre">{i.mascota_nombre} <span style={{ opacity: 0.6, fontSize: 13 }}>({i.especie})</span></div>
                    <span className={`estado-badge estado-activa`}>ACTIVA</span>
                  </div>
                  <div className="intern-dueno">👤 {i.dueno_nombre}</div>
                  <div className="intern-fecha">📅 Ingresó: {new Date(i.fecha_ingreso).toLocaleString('es-PY')}</div>
                  {i.observaciones && <div className="intern-obs">📝 {i.observaciones}</div>}

                  {/* Formulario de constante */}
                  <div className="constante-form">
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>📊 Registrar Constantes Vitales</div>
                    <div className="form-grid-3">
                      <input type="number" step="0.1" className="form-input form-input-sm" placeholder="Temp °C" value={constante.temperatura} onChange={e => setConstante(c => ({ ...c, temperatura: e.target.value }))} />
                      <input type="number" className="form-input form-input-sm" placeholder="FC (lpm)" value={constante.frecuencia_card} onChange={e => setConstante(c => ({ ...c, frecuencia_card: e.target.value }))} />
                      <input type="number" className="form-input form-input-sm" placeholder="FR (rpm)" value={constante.frecuencia_resp} onChange={e => setConstante(c => ({ ...c, frecuencia_resp: e.target.value }))} />
                    </div>
                    <input className="form-input form-input-sm" style={{ marginTop: 6 }} placeholder="Observación" value={constante.observacion} onChange={e => setConstante(c => ({ ...c, observacion: e.target.value }))} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => { handleAddConstante(i.id); loadConstantes(i.id) }} disabled={saving}>Registrar</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => { loadConstantes(i.id); setModal(`constantes_${i.id}`) }}>Ver historial</button>
                      <button className="btn btn-sm btn-success" onClick={() => handleAlta(i.id)}>Alta Médica</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Nueva Consulta */}
      {modal === 'nueva' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 900 }}>
            <div className="modal-header">
              <h3>🩺 Iniciar Consulta Médica</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            {error && <div className="alert-error">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: historialMascota ? '350px 1fr' : '1fr', gap: 20 }}>
              {/* Columna Formulario */}
              <div className="card" style={{ padding: 16 }}>
                <div className="form-group">
                  <label>Dueño / Cliente</label>
                  <select className="form-input" value={formC.cliente_id} onChange={e => handleClienteChange(e.target.value)}>
                    <option value="">— Seleccionar Cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Paciente (Mascota)</label>
                  <select className="form-input" value={formC.mascota_id} onChange={e => handleMascotaChange(e.target.value)} disabled={!formC.cliente_id}>
                    <option value="">— Seleccionar Mascota —</option>
                    {mascotasFiltradas.map(m => <option key={m.id} value={m.id}>{m.nombre} ({m.especie})</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Tipo de Consulta</label>
                  <select className="form-input" value={formC.tipo_consulta} onChange={e => setFormC(f => ({ ...f, tipo_consulta: e.target.value }))}>
                    {Object.keys(TIPO_ICONS).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Peso (kg)</label>
                    <input type="number" step="0.1" className="form-input" value={formC.peso_kg} onChange={e => setFormC(f => ({ ...f, peso_kg: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Temp (°C)</label>
                    <input type="number" step="0.1" className="form-input" value={formC.temperatura} onChange={e => setFormC(f => ({ ...f, temperatura: e.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Motivo / Anamnesis</label>
                  <textarea className="form-input" rows={3} value={formC.motivo} onChange={e => setFormC(f => ({ ...f, motivo: e.target.value }))} placeholder="¿Por qué viene a consulta?" />
                </div>

                <button className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} onClick={handleCrearConsulta} disabled={saving || !formC.mascota_id}>
                  {saving ? 'Guardando...' : '🚀 Iniciar Atención'}
                </button>
              </div>

              {/* Columna Historial Rápido */}
              {historialMascota && (
                <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: 8 }}>
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ color: 'var(--green-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>📜 Historial de {historialMascota.nombre}</h4>
                    <div style={{ display: 'flex', gap: 15, marginTop: 5, fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>
                      <span>⚖️ Último Peso: {historialMascota.peso_kg || '—'} kg</span>
                      <span>🌡️ Última Temp: {historialMascota.consultas?.[0]?.temperatura || '—'} °C</span>
                    </div>
                  </div>

                  <div className="tabs" style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Últimas Consultas y Estudios</div>
                  </div>

                  {historialMascota.consultas?.length === 0 && <div className="empty-state">Sin historial previo</div>}

                  {historialMascota.consultas?.slice(0, 5).map(c => (
                    <div key={c.id} className="card" style={{ marginBottom: 12, padding: 12, borderLeft: '4px solid var(--green-primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <strong>{new Date(c.fecha).toLocaleDateString()} — {c.tipo_consulta}</strong>
                        <span style={{ opacity: 0.7 }}>Dr. {c.veterinario_nombre}</span>
                      </div>
                      <div style={{ fontSize: 12 }}><strong>Diag:</strong> {c.diagnostico || 'N/A'}</div>
                      <div style={{ fontSize: 12 }}><strong>Trat:</strong> {c.tratamiento || 'N/A'}</div>
                      {c.recetas?.length > 0 && (
                        <div style={{ marginTop: 6, padding: 6, background: 'var(--bg-hover)', borderRadius: 4, fontSize: 11 }}>
                          <strong>💊 Recetado:</strong> {c.recetas.map(r => r.descripcion).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}

                  {historialMascota.estudios?.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📎 Estudios / Archivos Adjuntos</div>
                      <div className="form-grid-2">
                        {historialMascota.estudios.map(e => (
                          <div key={e.id} className="card" style={{ padding: 8, fontSize: 11 }}>
                            <div>📅 {new Date(e.consulta_fecha).toLocaleDateString()}</div>
                            <strong>{e.descripcion}</strong>
                            <a href={`/uploads/${e.url}`} target="_blank" className="btn btn-sm btn-ghost" style={{ marginTop: 4, width: '100%' }}>Ver PDF</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Consulta */}
      {modal === 'detalle' && selectedConsulta && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '95vw', width: '1200px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3>🩺 Consulta #{selectedConsulta.id} — {selectedConsulta.mascota_nombre}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            {error && <div className="alert-error">{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 30, overflowY: 'auto', padding: '10px 5px' }}>
              <div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Diagnóstico (Nuevo Cuadro)</label>
                    <textarea className="form-input" rows={6} value={selectedConsulta.diagnostico || ''} onChange={e => setSelectedConsulta(c => ({ ...c, diagnostico: e.target.value }))} placeholder="Escriba el diagnóstico actual..." />
                  </div>
                  <div className="form-group">
                    <label>Tratamiento / Plan</label>
                    <textarea className="form-input" rows={6} value={selectedConsulta.tratamiento || ''} onChange={e => setSelectedConsulta(c => ({ ...c, tratamiento: e.target.value }))} placeholder="Plan terapéutico..." />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Observaciones de esta Visita</label>
                    <textarea className="form-input" rows={3} value={selectedConsulta.observaciones || ''} onChange={e => setSelectedConsulta(c => ({ ...c, observaciones: e.target.value }))} />
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Peso (kg)</label>
                      <input type="number" step="0.1" className="form-input" value={selectedConsulta.peso_kg || ''} onChange={e => setSelectedConsulta(c => ({ ...c, peso_kg: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Temp (°C)</label>
                      <input type="number" step="0.1" className="form-input" value={selectedConsulta.temperatura || ''} onChange={e => setSelectedConsulta(c => ({ ...c, temperatura: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Estado de Atención</label>
                    <select className="form-input" value={selectedConsulta.estado} onChange={e => setSelectedConsulta(c => ({ ...c, estado: e.target.value }))}>
                      <option value="EN_CURSO">🏥 EN CURSO / OBSERVACIÓN</option>
                      <option value="FINALIZADA">✅ FINALIZAR CONSULTA</option>
                      <option value="CANCELADA">❌ ANULAR</option>
                    </select>
                  </div>
                </div>

                {/* Sub-tabs internos */}
                <div className="tabs" style={{ marginTop: 24, gap: 15 }}>
                  <button className="btn btn-gold" onClick={() => { setPvClienteId(selectedConsulta.dueno_id || ''); setModal('pre-venta') }}>💰 Enviar a Caja (Venta)</button>
                  <button className="btn btn-primary" onClick={() => setModal('receta')}>📋 Emitir Receta</button>
                  <button className="btn btn-danger" onClick={() => setShowInternarConfirm(true)}>🛏️ Hospitalizar / Internar</button>
                  <button className="btn btn-ghost" onClick={() => setModal('estudio')}>📎 Subir Estudio</button>
                </div>
              </div>

              {/* Columna Evolución Clínica (Historial del tratamiento actual) */}
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 25, background: 'var(--bg-hover)', borderRadius: 8, padding: 20 }}>
                <h4 style={{ fontSize: 14, marginBottom: 15, color: 'var(--green-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  📈 Evolución del Tratamiento
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                  {/* ESTUDIOS DE ESTA CONSULTA (NUEVOS) */}
                  {selectedConsulta.estudios?.length > 0 && (
                    <div className="card" style={{ padding: 15, background: 'rgba(76, 175, 80, 0.1)', border: '1px solid var(--green-primary)' }}>
                      <h5 style={{ fontSize: 13, marginBottom: 10, color: 'var(--green-primary)' }}>📎 Estudios Adjuntos Hoy</h5>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedConsulta.estudios.map(est => (
                          <div key={est.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 4 }}>
                            <span>📄 {est.descripcion || est.nombre}</span>
                            <a href={`/uploads/${est.url_path}`} target="_blank" className="btn btn-sm btn-ghost" style={{ fontSize: 10 }}>Ver</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {evolucion.length === 0 && !selectedConsulta.estudios?.length && <div className="empty-state" style={{ fontSize: 12 }}>Sin cambios registrados aún.</div>}
                  {evolucion.map((ev, i) => (
                    <div key={i} className="card" style={{ padding: 15, fontSize: 13, background: 'var(--bg-card)', borderLeft: '4px solid var(--gold)' }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 5 }}>
                        <span>📅 {new Date(ev.fecha).toLocaleDateString()}</span>
                        <span style={{ color: 'var(--green-primary)' }}>{ev.usuario_nombre}</span>
                      </div>

                      {/* VITALES EN EVOLUCION */}
                      <div style={{ display: 'flex', gap: 15, marginBottom: 10, fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                        {ev.peso_kg && <span>⚖️ {ev.peso_kg} kg</span>}
                        {ev.temperatura && <span>🌡️ {ev.temperatura} °C</span>}
                      </div>

                      <div style={{ marginBottom: 6 }}><strong>Diag:</strong> {ev.diagnostico}</div>
                      <div style={{ marginBottom: 8 }}><strong>Trat:</strong> {ev.tratamiento}</div>
                      <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: 8, borderRadius: 4 }}>
                        💬 {ev.justificacion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={handleUpdateConsulta} disabled={saving}>{saving ? 'Guardando...' : '💾 Guardar Consulta'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pre-Venta */}
      {modal === 'pre-venta' && (
        <div className="modal-overlay" onClick={() => setModal('detalle')}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h3>💊 Cargar Servicios / Medicamentos</h3>
              <button className="modal-close" onClick={() => setModal('detalle')}>✕</button>
            </div>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group">
              <label>Cliente para la venta</label>
              <select className="form-input" value={pvClienteId} onChange={e => setPvClienteId(e.target.value)}>
                <option value="">— Consumidor Final —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Agregar Insumo / Servicio Clínico</label>
              <select className="form-input" onChange={e => { if (e.target.value) addPvItem(e.target.value); e.target.value = '' }}>
                <option value="">— Seleccionar producto —</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} — Gs. {p.precio_venta_menor?.toLocaleString()}</option>)}
              </select>
            </div>
            {pvItems.length > 0 && (
              <table className="data-table" style={{ marginTop: 12 }}>
                <thead><tr><th>Producto</th><th>Precio</th><th>Cant.</th><th>Sub</th><th></th></tr></thead>
                <tbody>
                  {pvItems.map((it, i) => (
                    <tr key={i}>
                      <td>{it.nombre}</td>
                      <td>Gs. {it.precio?.toLocaleString()}</td>
                      <td>
                        <input type="number" min={1} className="form-input form-input-sm" style={{ width: 60 }} value={it.cantidad}
                          onChange={e => setPvItems(pvItems.map((x, j) => j === i ? { ...x, cantidad: +e.target.value } : x))} />
                      </td>
                      <td>Gs. {(it.precio * it.cantidad)?.toLocaleString()}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => setPvItems(pvItems.filter((_, j) => j !== i))}>✕</button></td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={3}>Total</td>
                    <td>Gs. {pvItems.reduce((s, i) => s + i.precio * i.cantidad, 0).toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal('detalle')}>Volver</button>
              <button className="btn btn-primary" onClick={handlePreVenta} disabled={saving || !pvItems.length}>{saving ? 'Enviando...' : '📤 Enviar a Caja'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Receta */}
      {modal === 'receta' && (
        <div className="modal-overlay" onClick={() => setModal('detalle')}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>📋 Emitir Receta</h3>
              <button className="modal-close" onClick={() => setModal('detalle')}>✕</button>
            </div>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-group">
              <label>Indicaciones Generales</label>
              <textarea className="form-input" rows={2} value={recIndicaciones} onChange={e => setRecIndicaciones(e.target.value)} placeholder="Ej: Administrar con alimentos. Reposo." />
            </div>
            {recItems.map((it, i) => (
              <div className="receta-item" key={i}>
                <input className="form-input" placeholder="Medicamento / Tratamiento" value={it.descripcion} onChange={e => setRecItems(r => r.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))} style={{ flex: 2 }} />
                <input type="number" min={1} className="form-input" placeholder="Cant." value={it.cantidad} onChange={e => setRecItems(r => r.map((x, j) => j === i ? { ...x, cantidad: +e.target.value } : x))} style={{ width: 70 }} />
                <input className="form-input" placeholder="Posología" value={it.posologia} onChange={e => setRecItems(r => r.map((x, j) => j === i ? { ...x, posologia: e.target.value } : x))} style={{ flex: 2 }} />
                {i > 0 && <button className="btn btn-sm btn-danger" onClick={() => setRecItems(r => r.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => setRecItems(r => [...r, { descripcion: '', cantidad: 1, posologia: '' }])}>+ Agregar ítem</button>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal('detalle')}>Volver</button>
              <button className="btn btn-primary" onClick={handleReceta} disabled={saving}>{saving ? 'Generando...' : '🖨 Emitir Receta (Ticket)'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Subir Estudio */}
      {modal === 'estudio' && (
        <div className="modal-overlay" onClick={() => setModal('detalle')}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>📎 Subir Estudio Clínico</h3>
              <button className="modal-close" onClick={() => setModal('detalle')}>✕</button>
            </div>
            {error && <div className="alert-error">{error}</div>}

            <div className="form-group" style={{ marginTop: 12 }}>
              <label>Archivo (PDF, Imágenes, Tomografías...)</label>
              <input
                type="file"
                className="form-input"
                style={{ padding: '8px' }}
                onChange={e => setEstudioFile(e.target.files[0])}
              />
            </div>
            <div className="form-group">
              <label>Descripción / Observación (Ej: Ecografía Abdominal)</label>
              <textarea
                className="form-input"
                rows={2}
                value={estudioDesc}
                onChange={e => setEstudioDesc(e.target.value)}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setModal('detalle')}>Volver</button>
              <button className="btn btn-primary" onClick={handleSubirEstudio} disabled={saving || !estudioFile}>
                {saving ? 'Subiendo...' : '⬆️ Subir y Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Constantes */}
      {modal && modal.startsWith && modal.startsWith('constantes_') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>📊 Historial de Constantes Vitales</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>Temp °C</th><th>FC lpm</th><th>FR rpm</th><th>Peso kg</th><th>Obs.</th><th>Usuario</th></tr></thead>
              <tbody>
                {constantes.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.5, padding: 24 }}>Sin registros aún</td></tr>}
                {constantes.map(c => (
                  <tr key={c.id}>
                    <td>{new Date(c.fecha).toLocaleString('es-PY')}</td>
                    <td>{c.temperatura || '—'}</td><td>{c.frecuencia_card || '—'}</td>
                    <td>{c.frecuencia_resp || '—'}</td><td>{c.peso_kg || '—'}</td>
                    <td>{c.observacion || '—'}</td><td>{c.usuario_nombre || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Justificación */}
      {showJustificacion && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>💬 Justificación del Cambio</h3>
            </div>
            <div className="form-group" style={{ padding: 20 }}>
              <p style={{ fontSize: 13, marginBottom: 10 }}>Has modificado el diagnóstico o tratamiento. Por favor, justifica el motivo de este cambio para el historial clínico.</p>
              <textarea className="form-input" rows={3} value={justificacion} onChange={e => setJustificacion(e.target.value)} placeholder="Ej: No hubo mejora con el tratamiento anterior. Nuevos síntomas detectados..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowJustificacion(false); setJustificacion('') }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleUpdateConsulta} disabled={!justificacion}>💾 Confirmar y Guardar</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Internar Confirm */}
      {showInternarConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>🛏️ Confirmar Internación</h3>
            </div>
            <div className="form-group" style={{ padding: 20 }}>
              <p style={{ fontSize: 13, marginBottom: 10 }}>¿Está seguro que desea hospitalizar a <strong>{selectedConsulta.mascota_nombre}</strong>?</p>
              <p style={{ fontSize: 12, opacity: 0.7 }}>Se creará un registro en el módulo de internaciones y se dará por finalizada esta consulta.</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowInternarConfirm(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleInternar} disabled={saving}>{saving ? 'Procesando...' : 'Confirmar Internación'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
