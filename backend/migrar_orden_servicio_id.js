/**
 * DIAGNÓSTICO + FIX: columna `orden_servicio_id` en creditos/ventas/movimientos_caja
 * ---------------------------------------------------------------
 * Bug reportado: en el tenant DEMO, el módulo de Órdenes de Servicio
 * falla con "Unknown column 'orden_servicio_id' in 'WHERE'".
 *
 * Esta columna la necesitan 3 tablas para que Órdenes de Servicio
 * funcione completo (ligar una orden con su venta/crédito/abono):
 *   - creditos.orden_servicio_id         INT NULL
 *   - ventas.orden_servicio_id           INT NULL
 *   - movimientos_caja.orden_servicio_id INT NULL
 *
 * Mismo patrón que las migraciones anteriores (comision_porcentaje,
 * etc.): quedaron creadas sin esta columna en los tenants que ya
 * existían antes de que se agregara el módulo de Órdenes de Servicio.
 *
 * SOLO LECTURA por defecto. Con CONFIRMAR=1 agrega la columna (ALTER
 * TABLE ... ADD COLUMN orden_servicio_id INT NULL) únicamente donde
 * haga falta. No borra ni toca ningún dato existente.
 *
 * Uso:
 *   node migrar_orden_servicio_id.js                 -> solo reporte
 *   CONFIRMAR=1 node migrar_orden_servicio_id.js      -> aplica el fix
 */

const mysql = require('mysql2/promise');

const MASTER_DB = 'saas_master';
const dbConfigBase = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026'
};

const CONFIRMAR = process.env.CONFIRMAR === '1';
const TABLAS = ['creditos', 'ventas', 'movimientos_caja'];

function linea() { console.log('─'.repeat(70)); }

async function tablaExiste(conn, dbName, tabla) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?',
    [dbName, tabla]
  );
  return rows[0].c > 0;
}

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
    linea();

    masterConn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: MASTER_DB }));
    const [tenants] = await masterConn.query('SELECT business_name, db_name, is_active FROM tenants ORDER BY business_name');
    console.log('Tenants encontrados: ' + tenants.length);
    linea();

    for (const t of tenants) {
      conn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: t.db_name }));
      console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')');

      for (const tabla of TABLAS) {
        const existeTabla = await tablaExiste(conn, t.db_name, tabla);
        if (!existeTabla) {
          console.log('   · ' + tabla + ' -> la tabla no existe en este tenant, se omite');
          continue;
        }
        const tieneColumna = await columnaExiste(conn, t.db_name, tabla, 'orden_servicio_id');
        if (tieneColumna) {
          console.log('   ✓ ' + tabla + '.orden_servicio_id -> OK, ya existe');
        } else if (!CONFIRMAR) {
          console.log('   ○ ' + tabla + '.orden_servicio_id -> ❌ FALTA (se agregaría al confirmar)');
        } else {
          await conn.query('ALTER TABLE `' + tabla + '` ADD COLUMN `orden_servicio_id` INT NULL');
          console.log('   ✅ ' + tabla + '.orden_servicio_id -> agregada');
        }
      }
      await conn.end(); conn = null;
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log('Si se ve bien, corre:  CONFIRMAR=1 node migrar_orden_servicio_id.js');
    } else {
      console.log('✅ LISTO. Fix aplicado donde hacía falta.');
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
