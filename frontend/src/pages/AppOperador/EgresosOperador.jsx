import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

const CONCEPTOS_BASE = [
  'PAGO A PROVEEDOR',
  'ALMUERZO / REFRIGERIO DE PERSONAL',
  'SERVICIOS BÁSICOS (LUZ / AGUA / INTERNET)',
  'FLETES Y TRANSPORTE',
  'ARTÍCULOS DE LIMPIEZA Y MANTENIMIENTO',
  'RETIRO DE EFECTIVO / SOCIO',
  'INSUMOS Y GASTOS VARIOS',
  'GASTOS ADMINISTRATIVOS / PAPELERÍA'
]

export default function EgresosOperador() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [apertura, setApertura] = useState(null)
  const [loadingApertura, setLoadingApertura] = useState(true)

  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')
  const [medioPago, setMedioPago] = useState('EFECTIVO')
  const [numTransferencia, setNumTransferencia] = useState('')

  // Lista de conceptos registrados
  const [conceptosRegistrados, setConceptosRegistrados] = useState(() => {
    const guardados = localStorage.getItem('conceptos_egresos')
    if (guardados) {
      try { return JSON.parse(guardados) } catch { return CONCEPTOS_BASE }
    }
    return CONCEPTOS_BASE
  })
  const [mostrarListaConceptos, setMostrarListaConceptos] = useState(false)

  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  useEffect(() => {
    // Cargar la apertura activa de caja
    const filialId = user?.filial_id || 1
    api.cajas(filialId)
      .then(async (cajas) => {
        const list = Array.isArray(cajas) ? cajas : []
        let apActiva = null
        for (const c of list) {
          try {
            const ap = await api.aperturaActiva(c.id)
            if (ap && ap.id) {
              apActiva = ap
              break
            }
          } catch {
            // continuar
          }
        }
        if (apActiva) {
          setApertura(apActiva)
        } else {
          setError('No hay una caja abierta para registrar egresos')
        }
      })
      .catch(err => setError(err.message || 'Error al verificar caja'))
      .finally(() => setLoadingApertura(false))
  }, [user?.filial_id])

  const agregarMontoRapido = (valor) => {
    const act = Number(String(monto).replace(/\D/g, '')) || 0
    const nuevo = act + valor
    setMonto(nuevo.toLocaleString('es-PY'))
  }

  const registrarNuevoConcepto = (nuevoCto) => {
    const normalizado = nuevoCto.trim().toUpperCase()
    if (!normalizado) return
    if (!conceptosRegistrados.includes(normalizado)) {
      const nuevaLista = [normalizado, ...conceptosRegistrados]
      setConceptosRegistrados(nuevaLista)
      localStorage.setItem('conceptos_egresos', JSON.stringify(nuevaLista))
    }
    setConcepto(normalizado)
    setMostrarListaConceptos(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!apertura) {
      setError('Debes tener una caja abierta para registrar egresos')
      return
    }
    const valMonto = Number(String(monto).replace(/\D/g, ''))
    if (!valMonto || valMonto <= 0) {
      setError('Ingresa un monto válido mayor a 0')
      return
    }
    if (!concepto.trim()) {
      setError('Ingresa o selecciona un concepto para el egreso')
      return
    }
    if (medioPago === 'TRANSFERENCIA' && !numTransferencia.trim()) {
      setError('El número de comprobante de transferencia es obligatorio')
      return
    }

    setProcesando(true)
    setError('')

    try {
      const conceptoFinal = medioPago === 'TRANSFERENCIA'
        ? `${concepto.trim().toUpperCase()} (Transf. N° ${numTransferencia.trim()})`
        : concepto.trim().toUpperCase()

      // Asegurar que el concepto quede guardado para el futuro
      registrarNuevoConcepto(concepto)

      await api.addMovCaja(apertura.id, {
        tipo: 'EGRESO',
        monto: valMonto,
        concepto: conceptoFinal,
        medio_pago: medioPago
      })

      setExito(true)
      setMonto('')
      setConcepto('')
      setNumTransferencia('')
    } catch (err) {
      setError(err.message || 'Error al registrar el egreso')
    } finally {
      setProcesando(false)
    }
  }

  const conceptosFiltrados = conceptosRegistrados.filter(c => 
    !concepto.trim() || c.toLowerCase().includes(concepto.toLowerCase())
  )
  const conceptoExactoExiste = conceptosRegistrados.some(c => 
    c.toLowerCase() === concepto.trim().toLowerCase()
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: '#121719',
      color: '#f0f3f4',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '500px',
      margin: '0 auto',
      boxShadow: '0 0 40px rgba(0,0,0,0.5)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        background: '#1a2225',
        padding: '14px 18px',
        borderBottom: '2px solid #283438',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button
          onClick={() => navigate('/operador')}
          style={{
            background: '#242f33',
            color: '#ff9ebb',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 14px',
            fontWeight: '700',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← Volver
        </button>
        <div style={{ fontWeight: '900', fontSize: '17px', color: '#ff9ebb' }}>
          🔴 REGISTRAR EGRESO
        </div>
        <div style={{ width: '40px' }} />
      </header>

      {/* Main Container */}
      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {loadingApertura ? (
          <div style={{ textAlign: 'center', color: '#9ba1a2', padding: '30px' }}>Verificando estado de caja...</div>
        ) : exito ? (
          <div style={{
            background: '#3d1e24',
            border: '2px solid #9e3646',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            marginTop: '20px',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>💸</div>
            <h3 style={{ color: '#ff9ebb', margin: '0 0 10px 0', fontSize: '20px' }}>Egreso Registrado</h3>
            <p style={{ color: '#ffc2d2', fontSize: '14px', marginBottom: '20px' }}>
              El egreso fue guardado correctamente en la caja del día.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setExito(false)}
                style={{
                  background: '#9e3646',
                  color: '#fff',
                  fontWeight: '800',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  cursor: 'pointer'
                }}
              >
                Otro Egreso 🔴
              </button>
              <button
                onClick={() => navigate('/operador')}
                style={{
                  background: '#283438',
                  color: '#fff',
                  fontWeight: '700',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  cursor: 'pointer'
                }}
              >
                Menú Principal 🏠
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {error && (
              <div style={{
                background: 'rgba(255, 107, 107, 0.15)',
                border: '1px solid #ff6b6b',
                color: '#ff8787',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '14px',
                textAlign: 'center',
                fontWeight: '700'
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Campo Monto */}
            <div>
              <label style={{ fontSize: '13px', color: '#ff9ebb', fontWeight: '700', marginBottom: '8px', display: 'block' }}>
                MONTO DEL EGRESO (₲ GUARANÍES)
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={monto}
                onChange={e => {
                  const num = Number(e.target.value.replace(/\D/g, '')) || 0
                  setMonto(num ? num.toLocaleString('es-PY') : '')
                }}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: '#1a2225',
                  border: '2px solid #9e3646',
                  borderRadius: '14px',
                  color: '#ff8787',
                  fontSize: '24px',
                  fontWeight: '900',
                  boxSizing: 'border-box',
                  outline: 'none',
                  textAlign: 'center'
                }}
                required
              />

              {/* Botones de incremento rápido */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => agregarMontoRapido(10000)}
                  style={{ background: '#281a1d', border: '1px solid #5a242c', color: '#ff9ebb', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  +10.000
                </button>
                <button
                  type="button"
                  onClick={() => agregarMontoRapido(50000)}
                  style={{ background: '#281a1d', border: '1px solid #5a242c', color: '#ff9ebb', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  +50.000
                </button>
                <button
                  type="button"
                  onClick={() => agregarMontoRapido(100000)}
                  style={{ background: '#281a1d', border: '1px solid #5a242c', color: '#ff9ebb', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  +100.000
                </button>
                <button
                  type="button"
                  onClick={() => setMonto('')}
                  style={{ background: '#282828', border: '1px solid #444', color: '#aaa', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Borrar
                </button>
              </div>
            </div>

            {/* Campo Concepto con Lista Uniforme y Botón Registrar */}
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: '700', marginBottom: '8px', display: 'block' }}>
                CONCEPTO / MOTIVO DEL GASTO
              </label>
              <input
                type="text"
                placeholder="Escribe o selecciona un concepto..."
                value={concepto}
                onFocus={() => setMostrarListaConceptos(true)}
                onChange={e => {
                  setConcepto(e.target.value)
                  setMostrarListaConceptos(true)
                }}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: '#1a2225',
                  border: '1px solid #3a4a50',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontWeight: '600'
                }}
                required
              />

              {/* Botón rápido para registrar nuevo concepto si no existe */}
              {concepto.trim() && !conceptoExactoExiste && (
                <div style={{ marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => registrarNuevoConcepto(concepto)}
                    style={{
                      background: '#2a1a1f',
                      border: '1px dashed #9e3646',
                      color: '#ff9ebb',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    ➕ Registrar concepto nuevo: &quot;{concepto.toUpperCase()}&quot;
                  </button>
                </div>
              )}

              {/* Menú Desplegable de Conceptos Registrados */}
              {mostrarListaConceptos && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#141c1f',
                  border: '1px solid #2e3d42',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                  zIndex: 50,
                  maxHeight: '180px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}>
                  <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ba1a2', fontWeight: '700', borderBottom: '1px solid #202b2f' }}>
                    Conceptos Frecuentes
                  </div>
                  {conceptosFiltrados.map((c, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setConcepto(c)
                        setMostrarListaConceptos(false)
                      }}
                      style={{
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: '#f0f3f4',
                        cursor: 'pointer',
                        borderBottom: '1px solid #1a2327',
                        fontWeight: '600'
                      }}
                    >
                      • {c}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Medio de Pago */}
            <div>
              <label style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: '700', marginBottom: '8px', display: 'block' }}>
                MEDIO DE PAGO
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setMedioPago('EFECTIVO')}
                  style={{
                    background: medioPago === 'EFECTIVO' ? '#9e3646' : '#1a2225',
                    color: '#fff',
                    border: `2px solid ${medioPago === 'EFECTIVO' ? '#ff9ebb' : '#3a4a50'}`,
                    borderRadius: '12px',
                    padding: '14px',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  💵 Efectivo (Caja)
                </button>
                <button
                  type="button"
                  onClick={() => setMedioPago('TRANSFERENCIA')}
                  style={{
                    background: medioPago === 'TRANSFERENCIA' ? '#9e3646' : '#1a2225',
                    color: '#fff',
                    border: `2px solid ${medioPago === 'TRANSFERENCIA' ? '#ff9ebb' : '#3a4a50'}`,
                    borderRadius: '12px',
                    padding: '14px',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  🏦 Transferencia
                </button>
              </div>
            </div>

            {/* Campo N° de Transferencia (Obligatorio si es Transferencia) */}
            {medioPago === 'TRANSFERENCIA' && (
              <div style={{
                background: '#1a2225',
                border: '2px solid #ff9ebb',
                borderRadius: '12px',
                padding: '14px',
                animation: 'fadeIn 0.2s ease'
              }}>
                <label style={{ fontSize: '13px', color: '#ff9ebb', fontWeight: '800', marginBottom: '6px', display: 'block' }}>
                  N° DE COMPROBANTE / REFERENCIA DE TRANSFERENCIA *
                </label>
                <input
                  type="text"
                  placeholder="Ej: 984521 o N° de Operación"
                  value={numTransferencia}
                  onChange={e => setNumTransferencia(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    background: '#0e1416',
                    border: '1px solid #5a242c',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '700',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={procesando}
              style={{
                marginTop: '10px',
                width: '100%',
                background: 'linear-gradient(135deg, #9e3646, #d9536f)',
                color: '#fff',
                border: 'none',
                borderRadius: '14px',
                padding: '16px',
                fontSize: '18px',
                fontWeight: '900',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(217, 83, 111, 0.4)'
              }}
            >
              {procesando ? 'Guardando Egreso...' : 'REGISTRAR EGRESO 💸'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

