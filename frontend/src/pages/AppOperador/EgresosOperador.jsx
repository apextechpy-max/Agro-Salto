import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

export default function EgresosOperador() {
  const navigate = useNavigate()

  const [apertura, setApertura] = useState(null)
  const [loadingApertura, setLoadingApertura] = useState(true)

  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')
  const [medioPago, setMedioPago] = useState('EFECTIVO')

  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  useEffect(() => {
    // Cargar la apertura activa de caja
    api.get('/caja/apertura-activa')
      .then(data => {
        if (data && data.id) {
          setApertura(data)
        } else {
          setError('No hay una caja abierta para registrar egresos')
        }
      })
      .catch(err => setError(err.message || 'Error al verificar caja'))
      .finally(() => setLoadingApertura(false))
  }, [])

  const agregarMontoRapido = (valor) => {
    const act = Number(monto) || 0
    setMonto(String(act + valor))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!apertura) {
      setError('Debes tener una caja abierta para registrar egresos')
      return
    }
    const valMonto = Number(monto)
    if (!valMonto || valMonto <= 0) {
      setError('Ingresa un monto válido mayor a 0')
      return
    }
    if (!concepto.trim()) {
      setError('Ingresa un concepto o motivo para el egreso')
      return
    }

    setProcesando(true)
    setError('')

    try {
      await api.addMovCaja(apertura.id, {
        tipo: 'EGRESO',
        monto: valMonto,
        concepto: concepto.trim(),
        medio_pago: medioPago
      })
      setExito(true)
      setMonto('')
      setConcepto('')
    } catch (err) {
      setError(err.message || 'Error al registrar el egreso')
    } finally {
      setProcesando(false)
    }
  }

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
            marginTop: '20px'
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
                textAlign: 'center'
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
                type="number"
                placeholder="Ej: 50000"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: '#1a2225',
                  border: '2px solid #9e3646',
                  borderRadius: '14px',
                  color: '#fff',
                  fontSize: '24px',
                  fontWeight: '800',
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

            {/* Campo Concepto */}
            <div>
              <label style={{ fontSize: '13px', color: '#9ba1a2', fontWeight: '700', marginBottom: '8px', display: 'block' }}>
                CONCEPTO / MOTIVO DEL GASTO
              </label>
              <input
                type="text"
                placeholder="Ej: Flete, Almuerzo, Insumos de limpieza..."
                value={concepto}
                onChange={e => setConcepto(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: '#1a2225',
                  border: '1px solid #3a4a50',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
                required
              />
            </div>

            {/* Medio de Pago */}
            <div>
              <label style={{ fontSize: '13px', color: '#9ba1a2', fontWeight: '700', marginBottom: '8px', display: 'block' }}>
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
