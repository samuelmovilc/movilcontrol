/**
 * DIAGNÓSTICO + FIX: columna `comision_porcentaje` en la tabla `tecnicos`
 * ---------------------------------------------------------------
 * Bug reportado: al crear un técnico en el módulo de Órdenes de Servicio
 * (probado en Sastrería Claudine) sale:
 *   "Error: Unknown column 'comision_porcentaje' in 'INSERT INTO'"
 *
 * Esto pasa cuando la tabla `tecnicos` YA existe en ese tenant pero sin
 * esa columna (quedó creada en algún momento con una estructura más
 * vieja, y `CREATE TABLE IF NOT EXISTS` no la actualiza si la tabla ya
 * existe).
 *
 * Este script:
 *   1) Revisa, para cada tenant, si la tabla `tecnicos` existe:
 *        - si NO existe -> se reporta (ese tenant no tiene el módulo
 *          de Órdenes de Servicio inicializado; no se toca nada aquí).
 *        - si existe pero le falta `comision_porcentaje` -> se reporta
 *          como "a corregir".
 *        - si ya la tiene -> se reporta como "OK".
 *   2) SOLO LECTURA por defecto. Con CONFIRMAR=1 agrega la columna
 *      (ALTER TABLE ... ADD COLUMN comision_porcentaje DECIMAL(5,2)
 *      NOT NULL DEFAULT 0) únicamente a los tenants donde haga falta.
 *      No borra ni toca ningún dato existente.
 *
 * Uso:
 *   node migrar_columna_comision.js                 -> solo reporte
 *   CONFIRMAR=1 node migrar_columna_comision.js      -> aplica el fix
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

function linea() { console.log('─'.repeat(70)); }

async function tablaExiste(conn, dbName, tabla) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`,
    [dbName, tabla]
  );
  return rows[0].c > 0;
}

async function columnaExiste(conn, dbName, tabla, columna) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
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
      const existeTabla = await tablaExiste(conn, t.db_name, 'tecnicos');

      if (!existeTabla) {
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> NO tiene tabla `tecnicos` (módulo Órdenes de Servicio no inicializado, no se toca)');
        await conn.end(); conn = null;
        continue;
      }

      const tieneColumna = await columnaExiste(conn, t.db_name, 'tecnicos', 'comision_porcentaje');
      if (tieneColumna) {
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> OK, ya tiene comision_porcentaje');
      } else {
        if (!CONFIRMAR) {
          console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> ❌ FALTA comision_porcentaje (se agregaría al confirmar)');
        } else {
          await conn.query('ALTER TABLE `tecnicos` ADD COLUMN `comision_porcentaje` DECIMAL(5,2) NOT NULL DEFAULT 0');
          console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> ✅ comision_porcentaje agregada');
        }
      }
      await conn.end(); conn = null;
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log('Si se ve bien, corre:  CONFIRMAR=1 node migrar_columna_comision.js');
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
