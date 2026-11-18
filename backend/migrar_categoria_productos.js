/**
 * MIGRACIÓN: columna `productos.categoria` (categorización libre de productos/servicios)
 * -----------------------------------------------------------------------------------
 * Cada negocio puede escribir la categoría que quiera en cada producto (no hay una
 * lista fija) — sirve tanto para agrupar productos (Cabello, Uñas, Bebidas...) como
 * para diferenciar productos de servicios (ej: categoría "Servicios").
 *
 * Agrega, solo si falta:
 *   - productos.categoria VARCHAR(100) NULL
 *
 * Exclusivo de esta columna. No toca ningún otro dato existente.
 *
 * SOLO LECTURA por defecto. Con CONFIRMAR=1 agrega la columna donde falte.
 *
 * Uso:
 *   DB_PASSWORD='la_contraseña_actual' node migrar_categoria_productos.js
 *   DB_PASSWORD='la_contraseña_actual' CONFIRMAR=1 node migrar_categoria_productos.js
 */

const mysql = require('mysql2/promise');

const MASTER_DB = 'saas_master';

if (!process.env.DB_PASSWORD) {
  console.error('❌ Falta DB_PASSWORD. Corre así:');
  console.error("   DB_PASSWORD='la_contraseña_actual' node migrar_categoria_productos.js");
  process.exit(1);
}

const dbConfigBase = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD
};

const CONFIRMAR = process.env.CONFIRMAR === '1';

function linea() { console.log('─'.repeat(70)); }

async function columnaExiste(conn, dbName, tabla, columna) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',
    [dbName, tabla, columna]
  );
  return rows[0].c > 0;
}

(async () => {
  let masterConn, conn;
  try {
    linea();
    console.log(CONFIRMAR ? 'MODO: APLICAR FIX (CONFIRMAR=1)' : 'MODO: SOLO LECTURA (diagnóstico, no modifica nada)');
    console.log('Agrega productos.categoria (VARCHAR 100, NULL) donde falte.');
    linea();

    masterConn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: MASTER_DB }));
    const [tenants] = await masterConn.query('SELECT business_name, db_name, is_active FROM tenants ORDER BY business_name');
    console.log('Tenants encontrados: ' + tenants.length);
    linea();

    for (const t of tenants) {
      conn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: t.db_name }));
      const tieneColumna = await columnaExiste(conn, t.db_name, 'productos', 'categoria');
      if (tieneColumna) {
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> ✓ OK, ya existe');
      } else if (!CONFIRMAR) {
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> ❌ FALTA (se agregaría al confirmar)');
      } else {
        await conn.query('ALTER TABLE productos ADD COLUMN categoria VARCHAR(100) NULL');
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> ✅ columna agregada');
      }
      await conn.end(); conn = null;
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log("Si se ve bien, corre:  DB_PASSWORD='...' CONFIRMAR=1 node migrar_categoria_productos.js");
    } else {
      console.log('✅ LISTO. productos.categoria agregada donde hacía falta.');
    }
    linea();

  } catch (err) {
    console.error('❌ FALLÓ:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
    if (masterConn) await masterConn.end();
  }
})();
