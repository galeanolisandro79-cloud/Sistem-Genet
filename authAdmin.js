const jwt = require('jsonwebtoken');

function authAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Iniciá sesión como administrador.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'clave-de-desarrollo-cambiar');
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesión inválida o vencida. Volvé a iniciar sesión.' });
  }
}

module.exports = authAdmin;
