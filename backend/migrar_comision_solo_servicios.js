/**
 * MIGRACIÓN: switch "Comisión solo por Servicios" en Configuración
 * -----------------------------------------------------------------------------------
 * Agrega la columna configuracion.comision_solo_servicios (BOOLEAN, apagada por
 * defecto). Cuando el dueño la activa desde Configuración, la comisión de técnicos
 * por ventas del POS (módulo Peluquería) se calcula SOLO sobre la parte de cada venta
 * que sea de productos con categoria = "Servicios" — no sobre productos normales.
 * Apagada (comportamiento de siempre), la comisión sigue siendo sobre el total de
 * la venta, igual que antes de esta migración.
 *
 * SOLO LECTURA por defecto. Con CONFIRMAR=1 aplica el cambio donde falte.
 *
 * Uso:
 *   DB_PASSWORD='la_contraseña_actual' node migrar_comision_solo_servicios.js
 *   DB_PASSWORD='la_contraseña_actual' CONFIRMAR=1 node migrar_comision_solo_servicios.js
 */

const mysql = require('mysql2/promise');

const MASTER_DB = 'saas_master';

if (!process.env.DB_PASSWORD) {
  console.error('❌ Falta DB_PASSWORD. Corre así:');
  console.error("   DB_PASSWORD='la_contraseña_actual' node migrar_comision_solo_servicios.js");
  process.exit(1);
}

const dbConfigBase = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD
};

const CONFIRMAR = process.env.CONFIRMAR === '1';

function linea() { console.log('─'.repeat(78)); }

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
    console.log('Agrega configuracion.comision_solo_servicios (apagada por defecto).');
    linea();

    masterConn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: MASTER_DB }));
    const [tenants] = await masterConn.query('SELECT business_name, db_name, is_active FROM tenants ORDER BY business_name');
    console.log('Tenants encontrados: ' + tenants.length);
    linea();

    for (const t of tenants) {
      conn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: t.db_name }));
      console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')');

      const tieneCol = await columnaExiste(conn, t.db_name, 'configuracion', 'comision_solo_servicios');
      if (tieneCol) {
        console.log('     - configuracion.comision_solo_servicios  -> ✓ OK, ya existe');
      } else if (!CONFIRMAR) {
        console.log('     - configuracion.comision_solo_servicios  -> ❌ falta (se agregaría al confirmar)');
      } else {
        await conn.query('ALTER TABLE `configuracion` ADD COLUMN `comision_solo_servicios` BOOLEAN DEFAULT FALSE');
        console.log('     - configuracion.comision_solo_servicios  -> ✅ agregada');
      }
      await conn.end(); conn = null;
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log("Si se ve bien, corre:  DB_PASSWORD='...' CONFIRMAR=1 node migrar_comision_solo_servicios.js");
    } else {
      console.log('✅ LISTO. El switch ya existe (apagado) en Configuración de todos los tenants.');
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
