const express = require('express');
const { pool } = require('../db');
const authAdmin = require('../middleware/authAdmin');

const router = express.Router();

// GET /api/productos?q=texto&page=1&limit=60
// Público: lo usa el punto de venta y el admin para listar/buscar.
router.get('/', async (req, res) => {
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

// POST /api/productos — crear producto (requiere admin)
router.post('/', authAdmin, async (req, res) => {
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

// PUT /api/productos/:id — editar producto (requiere admin)
router.put('/:id', authAdmin, async (req, res) => {
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

// DELETE /api/productos/:id — eliminar producto (requiere admin)
router.delete('/:id', authAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM productos WHERE id=$1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Artículo no encontrado.' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo eliminar el artículo.' });
  }
});

module.exports = router;
