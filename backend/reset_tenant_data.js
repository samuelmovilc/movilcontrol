/**
 * RESET DE DATOS DE UN TENANT (clientes + transacciones + productos)
 * ---------------------------------------------------------------
 * Deja un tenant existente con la CONFIGURACIÓN del negocio intacta,
 * pero todo lo demás en blanco:
 *   - productos
 *   - clientes
 *   - ventas (y sus venta_productos)
 *   - créditos (y sus credito_cuotas / abonos)
 *   - movimientos_caja
 *
 * NO toca: configuracion, catalogos, tecnicos,
 * ordenes_servicio, orden_prendas (si existieran).
 *
 * Uso:
 *   1. Cambia TENANT_DB abajo si vas a reutilizar este script
 *      para otro tenant.
 *   2. node reset_tenant_data.js
 *
 * Es IRREVERSIBLE (no se pidió respaldo antes de correrlo).
 * Solo trunca tablas que existan de verdad en ese tenant, así que
 * es seguro correrlo aunque el schema tenga pequeñas diferencias.
 */

const mysql = require('mysql2/promise');

const TENANT_DB = 'tenancy_electrohogar';

// Tablas que se vacían (en este orden, aunque con FK_CHECKS=0 el orden no importa)
const TABLAS_A_BORRAR = [
  'credito_cuotas',
  'creditos',
  'venta_productos',
  'ventas',
  'movimientos_caja',
  'clientes',
  'productos'
];

// Tablas que deben quedar SIN TOCAR — solo para mostrar antes/después como verificación
const TABLAS_INTACTAS = ['configuracion', 'catalogos', 'tecnicos'];

const dbConfig = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026',
  database: TENANT_DB
};

function linea() { console.log('─'.repeat(70)); }

async function contarFilas(conn, tabla) {
  try {
    const [rows] = await conn.query('SELECT COUNT(*) AS c FROM `' + tabla + '`');
    return rows[0].c;
  } catch (e) {
    return null; // la tabla no existe en este tenant
  }
}

(async () => {
  let conn;
  try {
    linea();
    console.log('Conectando a la base de datos "' + TENANT_DB + '"...');
    conn = await mysql.createConnection(dbConfig);
    console.log('   OK.');

    linea();
    console.log('ANTES de borrar:');
    linea();
    for (const t of TABLAS_A_BORRAR) {
      const c = await contarFilas(conn, t);
      console.log('   ' + t.padEnd(18) + (c === null ? '(tabla no existe en este tenant)' : c + ' filas'));
    }
    console.log('');
    console.log('   (Tablas que NO se van a tocar, solo informativo)');
    for (const t of TABLAS_INTACTAS) {
      const c = await contarFilas(conn, t);
      console.log('   ' + t.padEnd(18) + (c === null ? '(tabla no existe en este tenant)' : c + ' filas'));
    }

    linea();
    console.log('BORRANDO (TRUNCATE) clientes y transacciones...');
    linea();
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    for (const t of TABLAS_A_BORRAR) {
      try {
        await conn.query('TRUNCATE TABLE `' + t + '`');
        console.log('   ✅ ' + t + ' -> vaciada');
      } catch (e) {
        console.log('   ⚠️  ' + t + ' -> no se pudo vaciar (' + e.message + ')');
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS=1');

    linea();
    console.log('DESPUÉS de borrar (verificación):');
    linea();
    for (const t of TABLAS_A_BORRAR) {
      const c = await contarFilas(conn, t);
      console.log('   ' + t.padEnd(18) + (c === null ? '(tabla no existe en este tenant)' : c + ' filas'));
    }
    console.log('');
    console.log('   (Confirmando que esto quedó IGUAL que antes, sin tocar)');
    for (const t of TABLAS_INTACTAS) {
      const c = await contarFilas(conn, t);
      console.log('   ' + t.padEnd(18) + (c === null ? '(tabla no existe en este tenant)' : c + ' filas'));
    }

    linea();
    console.log('✅ LISTO. "' + TENANT_DB + '" quedó con productos, clientes y transacciones en blanco.');
    console.log('   Solo la configuración del negocio (nombre, logo, etc.) NO se tocó.');
    linea();

  } catch (err) {
    console.error('❌ FALLÓ:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
