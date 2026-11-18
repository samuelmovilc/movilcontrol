/**
 * MIGRACIÓN: cantidades/stock decimales (vender 0.5, 0.25, etc.)
 * -----------------------------------------------------------------------------------
 * Algunos negocios necesitan vender cantidades fraccionarias de un producto
 * (ej: 0.5 unidades, medio metro, etc.). Hoy las columnas de cantidad/stock son
 * INT, así que cualquier valor como 0.5 se trunca a 0 silenciosamente.
 *
 * Convierte, solo si hace falta:
 *   - productos.stock      INT  -> DECIMAL(10,2)
 *   - productos.entradas   INT  -> DECIMAL(10,2)
 *   - productos.salidas    INT  -> DECIMAL(10,2)
 *   - venta_productos.cantidad INT -> DECIMAL(10,2)
 *
 * MODIFY COLUMN conserva los datos existentes (un 50 sigue siendo 50.00) — no
 * borra ni recalcula nada, solo cambia el tipo de la columna para que admita
 * decimales a partir de ahora.
 *
 * SOLO LECTURA por defecto. Con CONFIRMAR=1 aplica el cambio donde falte.
 *
 * Uso:
 *   DB_PASSWORD='la_contraseña_actual' node migrar_cantidades_decimales.js
 *   DB_PASSWORD='la_contraseña_actual' CONFIRMAR=1 node migrar_cantidades_decimales.js
 */

const mysql = require('mysql2/promise');

const MASTER_DB = 'saas_master';

if (!process.env.DB_PASSWORD) {
  console.error('❌ Falta DB_PASSWORD. Corre así:');
  console.error("   DB_PASSWORD='la_contraseña_actual' node migrar_cantidades_decimales.js");
  process.exit(1);
}

const dbConfigBase = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD
};

const CONFIRMAR = process.env.CONFIRMAR === '1';

// Columnas a convertir: [tabla, columna, definición final]
const COLUMNAS = [
  ['productos', 'stock', 'DECIMAL(10,2) DEFAULT 0'],
  ['productos', 'entradas', 'DECIMAL(10,2) DEFAULT 0'],
  ['productos', 'salidas', 'DECIMAL(10,2) DEFAULT 0'],
  ['venta_productos', 'cantidad', 'DECIMAL(10,2) NOT NULL']
];

function linea() { console.log('─'.repeat(78)); }

async function tipoActual(conn, dbName, tabla, columna) {
  const [rows] = await conn.query(
    'SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',
    [dbName, tabla, columna]
  );
  return rows.length ? rows[0].DATA_TYPE : null; // 'int' | 'decimal' | null (no existe)
}

(async () => {
  let masterConn, conn;
  try {
    linea();
    console.log(CONFIRMAR ? 'MODO: APLICAR FIX (CONFIRMAR=1)' : 'MODO: SOLO LECTURA (diagnóstico, no modifica nada)');
    console.log('Convierte a DECIMAL(10,2): productos.stock, productos.entradas,');
    console.log('productos.salidas, venta_productos.cantidad (donde todavía sean INT).');
    linea();

    masterConn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: MASTER_DB }));
    const [tenants] = await masterConn.query('SELECT business_name, db_name, is_active FROM tenants ORDER BY business_name');
    console.log('Tenants encontrados: ' + tenants.length);
    linea();

    for (const t of tenants) {
      conn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: t.db_name }));
      console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')');

      for (const [tabla, columna, def] of COLUMNAS) {
        const tipo = await tipoActual(conn, t.db_name, tabla, columna);
        if (tipo === null) {
          console.log('     - ' + tabla + '.' + columna + '  -> ⚠️  no existe (se omite)');
        } else if (tipo === 'decimal') {
          console.log('     - ' + tabla + '.' + columna + '  -> ✓ OK, ya es DECIMAL');
        } else if (!CONFIRMAR) {
          console.log('     - ' + tabla + '.' + columna + '  -> ❌ es ' + tipo.toUpperCase() + ' (se convertiría al confirmar)');
        } else {
          await conn.query('ALTER TABLE `' + tabla + '` MODIFY COLUMN `' + columna + '` ' + def);
          console.log('     - ' + tabla + '.' + columna + '  -> ✅ convertida a DECIMAL(10,2)');
        }
      }
      await conn.end(); conn = null;
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log("Si se ve bien, corre:  DB_PASSWORD='...' CONFIRMAR=1 node migrar_cantidades_decimales.js");
    } else {
      console.log('✅ LISTO. Columnas convertidas a DECIMAL(10,2) donde hacía falta.');
      console.log('   Ya se pueden vender/registrar cantidades como 0.5, 0.25, etc.');
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
