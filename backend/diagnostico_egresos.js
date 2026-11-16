/**
 * DIAGNÓSTICO (solo lectura): reproduce exactamente las consultas que usan
 * GET /api/movimientos y GET /api/tecnicos/resumen, para ver el error real
 * de SQL que el navegador solo muestra como "Error 500" sin detalle.
 *
 * No modifica nada. Uso:
 *   node diagnostico_egresos.js tenancy_demo
 * (si no se pasa el nombre de la BD, usa tenancy_demo por defecto)
 */

const mysql = require('mysql2/promise');

const TENANT_DB = process.argv[2] || 'tenancy_demo';

const dbConfig = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026',
  database: TENANT_DB
};

function linea() { console.log('─'.repeat(70)); }

async function tablaExiste(conn, tabla) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?',
    [TENANT_DB, tabla]
  );
  return rows[0].c > 0;
}

(async () => {
  let conn;
  try {
    linea();
    console.log('Diagnóstico de Egresos/Técnicos en: ' + TENANT_DB);
    linea();
    conn = await mysql.createConnection(dbConfig);

    for (const t of ['movimientos_caja', 'tecnicos', 'orden_prendas', 'ordenes_servicio']) {
      console.log((await tablaExiste(conn, t)) ? ('✓ tabla ' + t + ' existe') : ('❌ tabla ' + t + ' NO existe'));
    }
    linea();

    console.log('Probando: GET /api/movimientos (SELECT * FROM movimientos_caja)...');
    try {
      const [rows] = await conn.query("SELECT * FROM movimientos_caja WHERE 1=1 ORDER BY COALESCE(fecha, DATE(created_at)) DESC, created_at DESC");
      console.log('   ✅ OK, ' + rows.length + ' filas');
    } catch (e) {
      console.log('   ❌ ERROR: ' + e.message);
    }
    linea();

    console.log('Probando: GET /api/tecnicos/resumen...');
    try {
      const [tecnicos] = await conn.query('SELECT * FROM tecnicos ORDER BY nombre ASC');
      console.log('   ✅ SELECT tecnicos OK, ' + tecnicos.length + ' filas');
    } catch (e) {
      console.log('   ❌ ERROR en SELECT tecnicos: ' + e.message);
    }
    try {
      const [ganado] = await conn.query(`
        SELECT op.tecnico_id, SUM(op.comision_monto) as ganado
        FROM orden_prendas op
        JOIN ordenes_servicio o ON o.id = op.orden_id
        WHERE op.tecnico_id IS NOT NULL AND op.estado='entregada' AND o.estado='terminada'
        GROUP BY op.tecnico_id`);
      console.log('   ✅ SELECT ganado (orden_prendas/ordenes_servicio) OK, ' + ganado.length + ' filas');
    } catch (e) {
      console.log('   ❌ ERROR en SELECT ganado: ' + e.message);
    }
    try {
      const [pagado] = await conn.query(`SELECT tecnico_id, SUM(monto) as pagado FROM movimientos_caja
        WHERE tipo='egreso' AND categoria='Pago Técnico' AND tecnico_id IS NOT NULL GROUP BY tecnico_id`);
      console.log('   ✅ SELECT pagado (movimientos_caja.tecnico_id) OK, ' + pagado.length + ' filas');
    } catch (e) {
      console.log('   ❌ ERROR en SELECT pagado: ' + e.message);
    }
    linea();

  } catch (err) {
    console.error('❌ FALLÓ LA CONEXIÓN:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
