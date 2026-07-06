const express = require('express');
const { pool } = require('../db');
const authAdmin = require('../middleware/authAdmin');

const router = express.Router();

// POST /api/ventas — registrar una venta y descontar stock de forma segura.
// items: [{ id, cantidad }]
// Público: lo usa cualquier vendedor desde el punto de venta.
router.post('/', async (req, res) => {
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
      // SELECT ... FOR UPDATE bloquea la fila hasta que termine la transacción,
      // así dos vendedores no pueden vender el mismo último artículo a la vez.
      const { rows } = await client.query(
        'SELECT * FROM productos WHERE id = $1 FOR UPDATE',
        [item.id]
      );
      const producto = rows[0];
      if (!producto) {
        throw { status: 404, mensaje: `Un artículo del carrito ya no existe en el catálogo.` };
      }
      if (producto.cantidad < item.cantidad) {
        throw { status: 409, mensaje: `No hay suficiente stock de "${producto.nombre}". Disponible: ${producto.cantidad}.` };
      }

      await client.query(
        'UPDATE productos SET cantidad = cantidad - $1, actualizado_en = now() WHERE id = $2',
        [item.cantidad, item.id]
      );

      const subtotal = Number(producto.precio) * item.cantidad;
      total += subtotal;
      detalle.push({
        id: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        precio: Number(producto.precio),
        cantidad: item.cantidad,
        subtotal
      });
    }

    const ventaRes = await client.query(
      'INSERT INTO ventas (total, detalle) VALUES ($1, $2) RETURNING id, fecha',
      [total, JSON.stringify(detalle)]
    );

    await client.query('COMMIT');

    res.status(201).json({
      id: ventaRes.rows[0].id,
      fecha: ventaRes.rows[0].fecha,
      total,
      detalle
    });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.status) {
      res.status(e.status).json({ error: e.mensaje });
    } else {
      console.error(e);
      res.status(500).json({ error: 'No se pudo registrar la venta.' });
    }
  } finally {
    client.release();
  }
});

// GET /api/ventas — historial de ventas (requiere admin)
router.get('/', authAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
  const offset = (page - 1) * limit;

  try {
    const totalRes = await pool.query('SELECT COUNT(*)::int AS total FROM ventas');
    const dataRes = await pool.query(
      'SELECT * FROM ventas ORDER BY fecha DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json({ ventas: dataRes.rows, total: totalRes.rows[0].total, page, limit });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo obtener el historial de ventas.' });
  }
});

module.exports = router;
