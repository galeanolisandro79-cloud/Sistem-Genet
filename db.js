const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Railway inyecta DATABASE_URL automáticamente al agregar el plugin de PostgreSQL.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : (process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false)
});

async function iniciarBaseDeDatos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      precio NUMERIC(12,2) NOT NULL DEFAULT 0,
      cantidad INTEGER NOT NULL DEFAULT 0,
      imagen TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ventas (
      id SERIAL PRIMARY KEY,
      fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
      total NUMERIC(12,2) NOT NULL,
      detalle JSONB NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_usuarios (
      id SERIAL PRIMARY KEY,
      usuario TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos (lower(nombre));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos (lower(codigo));`);

  // Sembrar el usuario administrador por defecto si todavía no existe ninguno.
  const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM admin_usuarios');
  if (rows[0].total === 0) {
    const usuario = process.env.ADMIN_USER || 'admin';
    const passwordPlano = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(passwordPlano, 10);
    await pool.query(
      'INSERT INTO admin_usuarios (usuario, password_hash) VALUES ($1, $2)',
      [usuario, hash]
    );
    console.log(`Usuario administrador creado: "${usuario}". Cambiá la contraseña por defecto en producción.`);
  }
}

module.exports = { pool, iniciarBaseDeDatos };
