/**
 * MIGRACIÓN: columnas nuevas para el módulo de Peluquería (ventas por técnico)
 * ---------------------------------------------------------------
 * Esto es exclusivo del nuevo módulo "Peluquería" (ventas del POS asignadas a un
 * técnico/peluquero). NO toca nada de Órdenes de Servicio / sastrería ni cambia
 * ningún dato existente.
 *
 * Agrega, solo si faltan:
 *   - configuracion.pos_atendido_por BOOLEAN DEFAULT FALSE
 *       (controla si el selector "Atendido por" aparece en el POS; apagado por
 *        defecto, así ningún tenant existente ve nada nuevo hasta activarlo)
 *   - ventas.tecnico_id VARCHAR(50) NULL
 *       (a qué técnico se le asigna la venta; NULL = sin asignar, no entra a
 *        ninguna liquidación)
 *
 * SOLO LECTURA por defecto. Con CONFIRMAR=1 agrega las columnas que falten.
 * No borra ni toca ningún dato existente, ni ninguna tabla de sastrería.
 *
 * Uso:
 *   node migrar_peluqueria.js                 -> solo reporte
 *   CONFIRMAR=1 node migrar_peluqueria.js      -> aplica el fix
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

const CAMBIOS = [
  { tabla: 'configuracion', columna: 'pos_atendido_por', ddl: 'BOOLEAN DEFAULT FALSE' },
  { tabla: 'ventas', columna: 'tecnico_id', ddl: 'VARCHAR(50) NULL' }
];

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
    console.log('Exclusivo del módulo Peluquería. No toca nada de sastrería.');
    linea();

    masterConn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: MASTER_DB }));
    const [tenants] = await masterConn.query('SELECT business_name, db_name, is_active FROM tenants ORDER BY business_name');
    console.log('Tenants encontrados: ' + tenants.length);
    linea();

    for (const t of tenants) {
      conn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: t.db_name }));
      console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')');

      for (const cambio of CAMBIOS) {
        const existeTabla = await tablaExiste(conn, t.db_name, cambio.tabla);
        if (!existeTabla) {
          console.log('   · ' + cambio.tabla + '.' + cambio.columna + ' -> la tabla ' + cambio.tabla + ' no existe en este tenant, se omite');
          continue;
        }
        const tieneColumna = await columnaExiste(conn, t.db_name, cambio.tabla, cambio.columna);
        if (tieneColumna) {
          console.log('   ✓ ' + cambio.tabla + '.' + cambio.columna + ' -> OK, ya existe');
        } else if (!CONFIRMAR) {
          console.log('   ○ ' + cambio.tabla + '.' + cambio.columna + ' -> ❌ FALTA (se agregaría al confirmar)');
        } else {
          await conn.query('ALTER TABLE `' + cambio.tabla + '` ADD COLUMN `' + cambio.columna + '` ' + cambio.ddl);
          console.log('   ✅ ' + cambio.tabla + '.' + cambio.columna + ' -> agregada');
        }
      }
      await conn.end(); conn = null;
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log('Si se ve bien, corre:  CONFIRMAR=1 node migrar_peluqueria.js');
    } else {
      console.log('✅ LISTO. Columnas del módulo Peluquería agregadas donde hacía falta.');
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
