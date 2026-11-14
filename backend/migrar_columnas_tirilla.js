/**
 * MIGRACIÓN: agrega a TODOS los tenants existentes las 3 columnas nuevas
 * de configuracion que controlan si nombre/dirección/teléfono se
 * imprimen o no en la tirilla:
 *   - mostrar_nombre_tirilla
 *   - mostrar_direccion_tirilla
 *   - mostrar_telefono_tirilla
 * Las 3 quedan en TRUE por defecto, así que ningún tenant existente
 * cambia de comportamiento hasta que el dueño del negocio desmarque
 * alguna casilla en Configuración.
 *
 * SOLO AGREGA COLUMNAS (ALTER TABLE ... ADD COLUMN IF NOT EXISTS).
 * No borra ni modifica ningún dato existente. Es seguro re-ejecutar
 * (si la columna ya existe, se salta esa columna en ese tenant).
 *
 * PASO 1 (léelo antes de correr nada): este script primero solo
 * CONSULTA (no modifica) la lista de tenants activos y si ya tienen
 * o no cada columna, y lo imprime. Lee ese reporte con calma.
 *
 * PASO 2: si el reporte se ve bien, corre el script de nuevo con la
 * variable de entorno CONFIRMAR=1 para que aplique los ALTER TABLE:
 *   CONFIRMAR=1 node migrar_columnas_tirilla.js
 *
 * Sin CONFIRMAR=1, el script NO escribe nada, solo informa.
 */

const mysql = require('mysql2/promise');

const MASTER_DB = 'saas_master';
const COLUMNAS = [
  { nombre: 'mostrar_nombre_tirilla', ddl: 'BOOLEAN DEFAULT TRUE' },
  { nombre: 'mostrar_direccion_tirilla', ddl: 'BOOLEAN DEFAULT TRUE' },
  { nombre: 'mostrar_telefono_tirilla', ddl: 'BOOLEAN DEFAULT TRUE' }
];

const dbConfigBase = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026'
};

const CONFIRMAR = process.env.CONFIRMAR === '1';

function linea() { console.log('─'.repeat(70)); }

async function columnaExiste(conn, dbName, columna) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='configuracion' AND COLUMN_NAME=?`,
    [dbName, columna]
  );
  return rows[0].c > 0;
}

(async () => {
  let masterConn, conn;
  try {
    linea();
    console.log(CONFIRMAR ? 'MODO: APLICAR CAMBIOS (CONFIRMAR=1)' : 'MODO: SOLO LECTURA (reporte, no modifica nada)');
    linea();

    masterConn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: MASTER_DB }));
    const [tenants] = await masterConn.query('SELECT business_name, username, db_name, is_active FROM tenants ORDER BY business_name');

    console.log('Tenants encontrados en saas_master.tenants: ' + tenants.length);
    linea();

    for (const t of tenants) {
      conn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: t.db_name }));
      console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')');

      for (const col of COLUMNAS) {
        const existe = await columnaExiste(conn, t.db_name, col.nombre);
        if (existe) {
          console.log('   ✓ ' + col.nombre + ' -> ya existe, se omite');
          continue;
        }
        if (!CONFIRMAR) {
          console.log('   ○ ' + col.nombre + ' -> NO existe (se agregaría al confirmar)');
        } else {
          await conn.query('ALTER TABLE `configuracion` ADD COLUMN `' + col.nombre + '` ' + col.ddl);
          console.log('   ✅ ' + col.nombre + ' -> agregada');
        }
      }
      await conn.end();
      conn = null;
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un reporte. No se modificó nada.');
      console.log('Si el reporte se ve bien, corre:  CONFIRMAR=1 node migrar_columnas_tirilla.js');
    } else {
      console.log('✅ LISTO. Todas las columnas quedaron agregadas (o ya existían) en todos los tenants.');
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
