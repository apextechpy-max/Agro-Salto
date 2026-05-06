const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'agrosalto_secret_2026';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.perfil)) return res.status(403).json({ error: 'Sin permisos' });
    next();
  };
}

module.exports = { authMiddleware, requireRole, SECRET };
