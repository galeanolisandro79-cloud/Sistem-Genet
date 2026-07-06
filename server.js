require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { iniciarBaseDeDatos } = require('./db');

const authRoutes = require('./routes/auth');
const productosRoutes = require('./routes/productos');
const ventasRoutes = require('./routes/ventas');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '8mb' })); // las imágenes viajan como base64 dentro del JSON

app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);

app.get('/api/salud', (req, res) => res.json({ ok: true }));

// Sirve el frontend (public/index.html) desde el mismo servidor.
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
