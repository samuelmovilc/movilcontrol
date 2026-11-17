/**
 * MIGRACIÓN: tabla `comision_pos_pagos_ventas` (liquidación exacta de Peluquería)
 * ---------------------------------------------------------------
 * Hasta ahora, qué ventas quedaban "liquidadas" al pagar una comisión POS se
 * calculaba estimando por fecha (FIFO). Ahora el dueño elige a mano, con
 * checkbox, exactamente qué ventas cubre cada pago — así que eso hay que
 * guardarlo de verdad, no estimarlo.
 *
 * Esta tabla liga cada pago (movimientos_caja, categoría "Comisión POS") con
 * las ventas puntuales que cubrió. La columna venta_id tiene UNIQUE KEY: eso
 * es justamente lo que garantiza, a nivel de base de datos, que una venta
 * jamás pueda quedar liquidada dos veces (ni por error de la app, ni por dos
 * pagos simultáneos).
 *
 * Exclusivo del módulo Peluquería. No toca nada de Órdenes de Servicio,
 * Egresos de sastrería, Caja ni Ventas.
 *
 * SOLO LECTURA por defecto. Con CONFIRMAR=1 crea la tabla donde falte.
 *
 * Uso:
 *   node migrar_comision_pos_ventas.js                 -> solo reporte
 *   CONFIRMAR=1 node migrar_comision_pos_ventas.js      -> aplica el fix
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
const TABLA = 'comision_pos_pagos_ventas';

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS comision_pos_pagos_ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pago_id INT NOT NULL,
    venta_id INT NOT NULL,
    comision_monto DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_venta_liquidada (venta_id)
  )
`;

function linea() { console.log('─'.repeat(70)); }

async function tablaExiste(conn, dbName) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?',
    [dbName, TABLA]
  );
  return rows[0].c > 0;
}

(async () => {
  let masterConn, conn;
  try {
    linea();
    console.log(CONFIRMAR ? 'MODO: APLICAR FIX (CONFIRMAR=1)' : 'MODO: SOLO LECTURA (diagnóstico, no modifica nada)');
    console.log('Exclusivo del módulo Peluquería. No toca nada de sastrería ni de Caja.');
    linea();

    masterConn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: MASTER_DB }));
    const [tenants] = await masterConn.query('SELECT business_name, db_name, is_active FROM tenants ORDER BY business_name');
    console.log('Tenants encontrados: ' + tenants.length);
    linea();

    for (const t of tenants) {
      conn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: t.db_name }));
      const existe = await tablaExiste(conn, t.db_name);
      if (existe) {
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> ✓ OK, ya existe');
      } else if (!CONFIRMAR) {
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> ❌ FALTA (se crearía al confirmar)');
      } else {
        await conn.query(CREATE_SQL);
        console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')  -> ✅ tabla creada');
      }
      await conn.end(); conn = null;
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log('Si se ve bien, corre:  CONFIRMAR=1 node migrar_comision_pos_ventas.js');
    } else {
      console.log('✅ LISTO. Tabla comision_pos_pagos_ventas creada donde hacía falta.');
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
