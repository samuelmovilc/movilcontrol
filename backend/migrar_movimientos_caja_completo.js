/**
 * DIAGNÓSTICO + FIX completo de `movimientos_caja` en todos los tenants
 * ---------------------------------------------------------------
 * Ya van dos veces que este módulo falla por una columna que falta en
 * movimientos_caja (orden_servicio_id, y ahora fecha + tecnico_id).
 * En vez de seguir arreglando columna por columna, este script revisa
 * TODAS las columnas que la tabla debería tener según el schema actual
 * (backend/api/index.js) y agrega las que falten, en todos los
 * tenants, de una sola vez.
 *
 * Columnas que debe tener movimientos_caja:
 *   metodo_pago VARCHAR(50)
 *   observaciones TEXT
 *   cliente_id VARCHAR(50) NULL
 *   credito_id INT NULL
 *   tecnico_id VARCHAR(50) NULL
 *   orden_servicio_id INT NULL
 *   fecha DATE NULL
 *
 * SOLO LECTURA por defecto. Con CONFIRMAR=1 agrega las que falten.
 * No borra ni toca ningún dato existente.
 *
 * Uso:
 *   node migrar_movimientos_caja_completo.js                 -> solo reporte
 *   CONFIRMAR=1 node migrar_movimientos_caja_completo.js      -> aplica el fix
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

const COLUMNAS = [
  { nombre: 'metodo_pago', ddl: 'VARCHAR(50)' },
  { nombre: 'observaciones', ddl: 'TEXT' },
  { nombre: 'cliente_id', ddl: 'VARCHAR(50) NULL' },
  { nombre: 'credito_id', ddl: 'INT NULL' },
  { nombre: 'tecnico_id', ddl: 'VARCHAR(50) NULL' },
  { nombre: 'orden_servicio_id', ddl: 'INT NULL' },
  { nombre: 'fecha', ddl: 'DATE NULL' }
];

function linea() { console.log('─'.repeat(70)); }

async function tablaExiste(conn, dbName) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME='movimientos_caja'",
    [dbName]
  );
  return rows[0].c > 0;
}

async function columnaExiste(conn, dbName, columna) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='movimientos_caja' AND COLUMN_NAME=?",
    [dbName, columna]
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
      const existeTabla = await tablaExiste(conn, t.db_name);
      if (!existeTabla) {
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> NO tiene tabla movimientos_caja, se omite');
        await conn.end(); conn = null;
        continue;
      }

      const faltantes = [];
      for (const col of COLUMNAS) {
        if (!(await columnaExiste(conn, t.db_name, col.nombre))) faltantes.push(col);
      }

      if (faltantes.length === 0) {
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> OK, tiene todas las columnas');
      } else {
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')');
        for (const col of faltantes) {
          if (!CONFIRMAR) {
            console.log('   ○ ' + col.nombre + ' -> ❌ FALTA (se agregaría al confirmar)');
          } else {
            await conn.query('ALTER TABLE `movimientos_caja` ADD COLUMN `' + col.nombre + '` ' + col.ddl);
            console.log('   ✅ ' + col.nombre + ' -> agregada');
          }
        }
      }
      await conn.end(); conn = null;
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log('Si se ve bien, corre:  CONFIRMAR=1 node migrar_movimientos_caja_completo.js');
    } else {
      console.log('✅ LISTO. movimientos_caja quedó completa en todos los tenants.');
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
