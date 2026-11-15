/**
 * MIGRACIÓN: columnas del usuario "vendedor" en saas_master.tenants
 * ---------------------------------------------------------------
 * Agrega a la tabla MAESTRA `tenants` (saas_master) las 5 columnas que
 * necesita el nuevo sistema de usuario vendedor (un usuario extra por
 * negocio, con su propio login y permisos por módulo):
 *   - vendedor_username   VARCHAR(100) NULL
 *   - vendedor_password   VARCHAR(255) NULL
 *   - vendedor_nombre     VARCHAR(150) NULL
 *   - vendedor_modulos    JSON NULL           (ej: ["pos","caja"])
 *   - vendedor_activo     BOOLEAN DEFAULT FALSE
 *
 * A diferencia de las migraciones anteriores (que tocaban la base de
 * datos de CADA tenant), esto es UNA SOLA TABLA en saas_master, así
 * que solo hay que correr esto UNA VEZ, no por cada negocio.
 *
 * Mientras vendedor_activo quede en FALSE (su valor por defecto), el
 * login de vendedor simplemente no existe para ningún tenant — cero
 * impacto para los negocios que ya están usando el sistema hasta que
 * el dueño configure su propio vendedor desde Configuración.
 *
 * Uso:
 *   node migrar_vendedor.js                 -> solo diagnóstico
 *   CONFIRMAR=1 node migrar_vendedor.js      -> aplica el ALTER TABLE
 */

const mysql = require('mysql2/promise');

const MASTER_DB = 'saas_master';
const dbConfig = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026',
  database: MASTER_DB
};

const CONFIRMAR = process.env.CONFIRMAR === '1';

const COLUMNAS = [
  { nombre: 'vendedor_username', ddl: 'VARCHAR(100) NULL' },
  { nombre: 'vendedor_password', ddl: 'VARCHAR(255) NULL' },
  { nombre: 'vendedor_nombre',   ddl: 'VARCHAR(150) NULL' },
  { nombre: 'vendedor_modulos',  ddl: 'JSON NULL' },
  { nombre: 'vendedor_activo',   ddl: 'BOOLEAN DEFAULT FALSE' }
];

function linea() { console.log('─'.repeat(70)); }

async function columnaExiste(conn, columna) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='tenants' AND COLUMN_NAME=?`,
    [MASTER_DB, columna]
  );
  return rows[0].c > 0;
}

(async () => {
  let conn;
  try {
    linea();
    console.log(CONFIRMAR ? 'MODO: APLICAR FIX (CONFIRMAR=1)' : 'MODO: SOLO LECTURA (diagnóstico, no modifica nada)');
    console.log('Tabla objetivo: saas_master.tenants (una sola tabla, no por tenant)');
    linea();

    conn = await mysql.createConnection(dbConfig);

    for (const col of COLUMNAS) {
      const existe = await columnaExiste(conn, col.nombre);
      if (existe) {
        console.log('   ✓ ' + col.nombre + ' -> ya existe, se omite');
        continue;
      }
      if (!CONFIRMAR) {
        console.log('   ○ ' + col.nombre + ' -> NO existe (se agregaría al confirmar)');
      } else {
        await conn.query('ALTER TABLE `tenants` ADD COLUMN `' + col.nombre + '` ' + col.ddl);
        console.log('   ✅ ' + col.nombre + ' -> agregada');
      }
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log('Si se ve bien, corre:  CONFIRMAR=1 node migrar_vendedor.js');
    } else {
      console.log('✅ LISTO. saas_master.tenants quedó con las columnas del usuario vendedor.');
    }
    linea();

  } catch (err) {
    console.error('❌ FALLÓ:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
