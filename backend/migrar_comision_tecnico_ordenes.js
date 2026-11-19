/**
 * MIGRACIÓN: tabla `comision_tecnico_pagos_prendas` (liquidación exacta de
 * Técnicos en Órdenes de Servicio / sastrería)
 * ---------------------------------------------------------------
 * Hasta ahora, qué órdenes/prendas quedaban "liquidadas" al pagar una comisión
 * a un técnico se calculaba estimando por fecha (FIFO). Ahora el dueño elige
 * a mano, con checkbox, exactamente qué órdenes cubre cada pago — igual que ya
 * funciona en Peluquería — así que eso hay que guardarlo de verdad, no estimarlo.
 *
 * Esta tabla liga cada pago (movimientos_caja, categoría "Pago Técnico") con
 * las prendas/órdenes puntuales que cubrió. La columna prenda_id tiene UNIQUE
 * KEY: eso es justamente lo que garantiza, a nivel de base de datos, que una
 * orden jamás pueda quedar liquidada dos veces (ni por error de la app, ni por
 * dos pagos simultáneos).
 *
 * Exclusivo del módulo Órdenes de Servicio (sastrería). No toca nada de
 * Peluquería, Egresos, Caja ni Ventas.
 *
 * SOLO LECTURA por defecto. Con CONFIRMAR=1 crea la tabla donde falte.
 *
 * Uso:
 *   node migrar_comision_tecnico_ordenes.js                 -> solo reporte
 *   CONFIRMAR=1 node migrar_comision_tecnico_ordenes.js      -> aplica el fix
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
const TABLA = 'comision_tecnico_pagos_prendas';

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS comision_tecnico_pagos_prendas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pago_id INT NOT NULL,
    prenda_id INT NOT NULL,
    comision_monto DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_prenda_liquidada (prenda_id)
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
    console.log('Exclusivo de Órdenes de Servicio (sastrería). No toca Peluquería, Caja ni Egresos.');
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
      console.log('Si se ve bien, corre:  CONFIRMAR=1 node migrar_comision_tecnico_ordenes.js');
    } else {
      console.log('✅ LISTO. Tabla comision_tecnico_pagos_prendas creada donde hacía falta.');
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
