import { useState, useEffect } from 'react'
import api from '../api'

function Modal({ open, onClose, children, title }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const PERFILES = ['ADMIN', 'CAJERO_1', 'CAJERO_2', 'DEPOSITO']
const PERFIL_LABELS = { ADMIN: '👑 Administrador', CAJERO_1: '🧾 Cajero 1', CAJERO_2: '🧾 Cajero 2', DEPOSITO: '📦 Depósito' }
const EMPTY = { nombre_completo: '', usuario: '', password: '', perfil: 'CAJERO_1', filial_id: '', activo: true }

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [filiales, setFiliales] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = () => api.usuarios().then(setUsuarios)
  useEffect(() => { load(); api.filiales().then(setFiliales) }, [])

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowModal(true) }
  const openEdit = (u) => { setForm({ ...u, password: '', activo: u.activo === 1 }); setEditId(u.id); setShowModal(true) }

  const save = async () => {
    try {
      if (editId) await api.updateUsuario(editId, form)
      else await api.createUsuario(form)
      setMsg({ type: 'success', text: '✅ Usuario guardado' })
      setShowModal(false); load()
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
  }

  const toggleActive = async (u) => {
    try {
      await api.updateUsuario(u.id, { ...u, activo: !u.activo })
      load()
    } catch (e) { setMsg({ type: 'error', text: `❌ ${e.message}` }) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🔐 Usuarios</div>
          <div className="page-subtitle">Gestión de accesos y perfiles</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo Usuario</button>
      </div>

      {msg && <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}

      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        🔒 Cada usuario tiene acceso individual e irrestricto. <strong>No se permiten usuarios compartidos.</strong> Cada operación queda registrada con el nombre del operador.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {usuarios.map(u => (
          <div key={u.id} className="card" style={{ opacity: u.activo ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--green-primary), var(--green-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white' }}>
                {u.nombre_completo?.[0]}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{u.nombre_completo}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{u.usuario}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span className={`badge badge-${u.activo ? 'green' : 'gray'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="badge badge-blue">{PERFIL_LABELS[u.perfil]}</span>
            </div>
            {u.ultimo_acceso && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                Último acceso: {new Date(u.ultimo_acceso).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>✏️ Editar</button>
              <button className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-primary'}`} onClick={() => toggleActive(u)}>
                {u.activo ? '🚫 Desactivar' : '✅ Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <div className="modal-body">
          <div className="form-group">
            <label>Nombre Completo *</label>
            <input value={form.nombre_completo} onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Usuario (login) *</label>
              <input value={form.usuario} onChange={e => setForm(f => ({ ...f, usuario: e.target.value }))} disabled={!!editId} />
            </div>
            <div className="form-group">
              <label>{editId ? 'Nueva Contraseña (opcional)' : 'Contraseña *'}</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editId ? '••• dejar vacío para no cambiar' : '••••••••'} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Perfil</label>
              <select value={form.perfil} onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))}>
                {PERFILES.map(p => <option key={p} value={p}>{PERFIL_LABELS[p]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sucursal Asignada</label>
              <select value={form.filial_id || ''} onChange={e => setForm(f => ({ ...f, filial_id: e.target.value }))}>
                <option value="">Todas</option>
                {filiales.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>
          </div>
          <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <strong>Permisos del perfil seleccionado:</strong><br />
            {form.perfil === 'ADMIN' && '✅ Acceso total al sistema, configuración, auditorías y reportes'}
            {form.perfil === 'CAJERO_1' || form.perfil === 'CAJERO_2' ? '✅ Ventas, caja, consulta de stock. ❌ Sin precios de costo, sin configuración' : ''}
            {form.perfil === 'DEPOSITO' && '✅ Stock, compras, transferencias. ❌ Sin acceso a caja ni ventas'}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>✓ Guardar</button>
        </div>
      </Modal>
    </div>
  )
}
