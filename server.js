require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, iniciarBaseDeDatos } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'clave-de-desarrollo-cambiar';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '8mb' })); // las imágenes viajan como base64 dentro del JSON

/* =========================================================
   MIDDLEWARE DE AUTENTICACIÓN (admin)
========================================================= */
function authAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Iniciá sesión como administrador.' });
  }
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesión inválida o vencida. Volvé a iniciar sesión.' });
  }
}

/* =========================================================
   AUTENTICACIÓN
========================================================= */
app.post('/api/auth/login', async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Falta usuario o contraseña.' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM admin_usuarios WHERE usuario = $1', [usuario]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

    const token = jwt.sign({ id: admin.id, usuario: admin.usuario }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, usuario: admin.usuario });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor al iniciar sesión.' });
  }
});

/* =========================================================
   PRODUCTOS
========================================================= */

// GET /api/productos?q=texto&page=1&limit=60 — público
app.get('/api/productos', async (req, res) => {
  const q = (req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 60));
  const offset = (page - 1) * limit;

  try {
    let where = '';
    let params = [];
    if (q) {
      where = 'WHERE lower(codigo) LIKE $1 OR lower(nombre) LIKE $1';
      params.push(`%${q.toLowerCase()}%`);
    }

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM productos ${where}`, params);
    const total = totalRes.rows[0].total;

    const dataParams = [...params, limit, offset];
    const dataRes = await pool.query(
      `SELECT id, codigo, nombre, precio, cantidad, imagen
       FROM productos ${where}
       ORDER BY lower(nombre) ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    res.json({ productos: dataRes.rows, total, page, limit });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo obtener el catálogo.' });
  }
});

// POST /api/productos — crear producto (admin)
app.post('/api/productos', authAdmin, async (req, res) => {
  const { codigo, nombre, precio, cantidad, imagen } = req.body || {};
  if (!codigo || !nombre || precio === undefined || cantidad === undefined) {
    return res.status(400).json({ error: 'Completá código, nombre, precio y cantidad.' });
  }
  try {
    const existe = await pool.query('SELECT id FROM productos WHERE lower(codigo) = lower($1)', [codigo]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un artículo con ese código.' });
    }
    const { rows } = await pool.query(
      `INSERT INTO productos (codigo, nombre, precio, cantidad, imagen)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [codigo, nombre, precio, cantidad, imagen || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo crear el artículo.' });
  }
});

// PUT /api/productos/:id — editar producto (admin)
app.put('/api/productos/:id', authAdmin, async (req, res) => {
  const { id } = req.params;
  const { codigo, nombre, precio, cantidad, imagen } = req.body || {};
  if (!codigo || !nombre || precio === undefined || cantidad === undefined) {
    return res.status(400).json({ error: 'Completá código, nombre, precio y cantidad.' });
  }
  try {
    const dup = await pool.query(
      'SELECT id FROM productos WHERE lower(codigo) = lower($1) AND id != $2',
      [codigo, id]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe otro artículo con ese código.' });
    }
    const { rows } = await pool.query(
      `UPDATE productos SET codigo=$1, nombre=$2, precio=$3, cantidad=$4, imagen=$5, actualizado_en=now()
       WHERE id=$6 RETURNING *`,
      [codigo, nombre, precio, cantidad, imagen || null, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Artículo no encontrado.' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo actualizar el artículo.' });
  }
});

// DELETE /api/productos/:id — eliminar producto (admin)
app.delete('/api/productos/:id', authAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM productos WHERE id=$1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Artículo no encontrado.' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo eliminar el artículo.' });
  }
});

/* =========================================================
   VENTAS
========================================================= */

// POST /api/ventas — registrar venta y descontar stock de forma segura (público)
app.post('/api/ventas', async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const detalle = [];
    let total = 0;

    for (const item of items) {
      const { rows } = await client.query('SELECT * FROM productos WHERE id = $1 FOR UPDATE', [item.id]);
      const producto = rows[0];
      if (!producto) throw { status: 404, mensaje: 'Un artículo del carrito ya no existe en el catálogo.' };
      if (producto.cantidad < item.cantidad) {
        throw { status: 409, mensaje: `No hay suficiente stock de "${producto.nombre}". Disponible: ${producto.cantidad}.` };
      }
      await client.query('UPDATE productos SET cantidad = cantidad - $1, actualizado_en = now() WHERE id = $2', [item.cantidad, item.id]);

      const subtotal = Number(producto.precio) * item.cantidad;
      total += subtotal;
      detalle.push({
        id: producto.id, codigo: producto.codigo, nombre: producto.nombre,
        precio: Number(producto.precio), cantidad: item.cantidad, subtotal
      });
    }

    const ventaRes = await client.query(
      'INSERT INTO ventas (total, detalle) VALUES ($1, $2) RETURNING id, fecha',
      [total, JSON.stringify(detalle)]
    );
    await client.query('COMMIT');
    res.status(201).json({ id: ventaRes.rows[0].id, fecha: ventaRes.rows[0].fecha, total, detalle });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.status) res.status(e.status).json({ error: e.mensaje });
    else { console.error(e); res.status(500).json({ error: 'No se pudo registrar la venta.' }); }
  } finally {
    client.release();
  }
});

// GET /api/ventas — historial (admin)
app.get('/api/ventas', authAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
  const offset = (page - 1) * limit;
  try {
    const totalRes = await pool.query('SELECT COUNT(*)::int AS total FROM ventas');
    const dataRes = await pool.query('SELECT * FROM ventas ORDER BY fecha DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ ventas: dataRes.rows, total: totalRes.rows[0].total, page, limit });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo obtener el historial de ventas.' });
  }
});

/* =========================================================
   SALUD + FRONTEND
========================================================= */
app.get('/api/salud', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================================================
   INICIO
========================================================= */
iniciarBaseDeDatos()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Sistema de GENET corriendo en el puerto ${PORT}`);
    });
  })
  .catch((e) => {
    console.error('No se pudo iniciar la base de datos:', e);
    process.exit(1);
  });
