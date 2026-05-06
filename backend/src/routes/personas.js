const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { tipo, buscar, activo = 1 } = req.query;
  try {
    let q = 'SELECT * FROM personas WHERE activo=$1';
    const params = [parseInt(activo)];
    if (tipo) { 
      q += ` AND tipo=$${params.length + 1}`; 
      params.push(tipo); 
    }
    if (buscar) { 
      q += ` AND (razon_social ILIKE $${params.length + 1} OR ruc ILIKE $${params.length + 2} OR telefono ILIKE $${params.length + 3})`; 
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`); 
    }
    q += ' ORDER BY razon_social';
    const result = await db.query(q, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM personas WHERE id=$1', [req.params.id]);
    const p = result.rows[0];
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    
    const cuentasRes = await db.query('SELECT * FROM cuentas_corrientes WHERE persona_id=$1 ORDER BY creado_en DESC', [p.id]);
    p.cuentas = cuentasRes.rows;
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { tipo, razon_social, ruc, ci, telefono, email, direccion, condicion_iva, condicion_pago, limite_credito, comision_pct } = req.body;
  if (!tipo || !razon_social) return res.status(400).json({ error: 'Tipo y nombre son requeridos' });
  try {
    const result = await db.query(
      'INSERT INTO personas (tipo,razon_social,ruc,ci,telefono,email,direccion,condicion_iva,condicion_pago,limite_credito,comision_pct) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
      [tipo, razon_social, ruc || '', ci || '', telefono || '', email || '', direccion || '', condicion_iva || 'CONTRIBUYENTE', condicion_pago || 'CONTADO', limite_credito || 0, comision_pct || 0]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { tipo, razon_social, ruc, ci, telefono, email, direccion, condicion_iva, condicion_pago, limite_credito, comision_pct, activo } = req.body;
  try {
    await db.query(
      'UPDATE personas SET tipo=$1,razon_social=$2,ruc=$3,ci=$4,telefono=$5,email=$6,direccion=$7,condicion_iva=$8,condicion_pago=$9,limite_credito=$10,comision_pct=$11,activo=$12 WHERE id=$13',
      [tipo, razon_social, ruc, ci, telefono, email, direccion, condicion_iva, condicion_pago, limite_credito, comision_pct, activo !== undefined ? (activo ? 1 : 0) : 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar pago de cuenta corriente
router.post('/:id/pago', async (req, res) => {
  const { cuenta_id, monto, tipo_pago, observacion } = req.body;
  try {
    const result = await db.query('SELECT * FROM cuentas_corrientes WHERE id=$1', [cuenta_id]);
    const cuenta = result.rows[0];
    if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });
    
    const nuevo_saldo = Math.max(0, cuenta.saldo - monto);
    const estado = nuevo_saldo === 0 ? 'PAGADO' : 'PARCIAL';
    
    // Usamos el pool para asegurar que las operaciones se completen
    await db.query('UPDATE cuentas_corrientes SET saldo=$1, estado=$2 WHERE id=$3', [nuevo_saldo, estado, cuenta_id]);
    await db.query('INSERT INTO pagos_cc (cuenta_id, monto, tipo_pago, usuario_id, observacion) VALUES ($1,$2,$3,$4,$5)', [cuenta_id, monto, tipo_pago || 'EFECTIVO', req.user.id, observacion || '']);
    await db.query('UPDATE personas SET saldo_cuenta = saldo_cuenta - $1 WHERE id = $2', [monto, req.params.id]);
    
    res.json({ ok: true, nuevo_saldo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
