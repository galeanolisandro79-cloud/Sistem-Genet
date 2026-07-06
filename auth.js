const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Falta usuario o contraseña.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM admin_usuarios WHERE usuario = $1',
      [usuario]
    );
    const admin = rows[0];
    if (!admin) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    const token = jwt.sign(
      { id: admin.id, usuario: admin.usuario },
      process.env.JWT_SECRET || 'clave-de-desarrollo-cambiar',
      { expiresIn: '12h' }
    );
    res.json({ token, usuario: admin.usuario });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor al iniciar sesión.' });
  }
});

module.exports = router;
