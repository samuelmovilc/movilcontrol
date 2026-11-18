/**
 * MIGRACIÓN: Caja profesional (apertura/cierre de turno)
 * -----------------------------------------------------------------------------------
 * Convierte el módulo Caja de un simple historial de ventas a un flujo real de
 * apertura/cierre de turno: mientras no haya una caja abierta, no se puede vender,
 * anular una venta, registrar un gasto, ni registrar un abono a crédito.
 *
 * Agrega, solo si falta:
 *   - Tabla nueva: caja_sesiones (cada apertura/cierre de turno, con sus totales)
 *   - ventas.caja_sesion_id           INT NULL
 *   - movimientos_caja.caja_sesion_id INT NULL
 *
 * Estas dos columnas son las que permiten que cada venta/gasto/abono quede ligado
 * al turno exacto en el que ocurrió (en vez de por rango de fechas, que se presta a
 * confusión cuando hay varios turnos el mismo día). Las ventas/movimientos de ANTES
 * de esta migración quedan con caja_sesion_id en NULL — no se tocan ni se reclasifican.
 *
 * SOLO LECTURA por defecto. Con CONFIRMAR=1 aplica los cambios donde falten.
 *
 * Uso:
 *   DB_PASSWORD='la_contraseña_actual' node migrar_caja_sesiones.js
 *   DB_PASSWORD='la_contraseña_actual' CONFIRMAR=1 node migrar_caja_sesiones.js
 */

const mysql = require('mysql2/promise');

const MASTER_DB = 'saas_master';

if (!process.env.DB_PASSWORD) {
  console.error('❌ Falta DB_PASSWORD. Corre así:');
  console.error("   DB_PASSWORD='la_contraseña_actual' node migrar_caja_sesiones.js");
  process.exit(1);
}

const dbConfigBase = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD
};

const CONFIRMAR = process.env.CONFIRMAR === '1';

const CREATE_CAJA_SESIONES = `
  CREATE TABLE IF NOT EXISTS caja_sesiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fecha_apertura DATE NOT NULL,
    hora_apertura TIME NOT NULL,
    saldo_apertura DECIMAL(10,2) NOT NULL DEFAULT 0,
    estado ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta',
    fecha_cierre DATE NULL,
    hora_cierre TIME NULL,
    total_ventas DECIMAL(10,2) NULL,
    total_ingresos_otros DECIMAL(10,2) NULL,
    total_egresos DECIMAL(10,2) NULL,
    total_caja DECIMAL(10,2) NULL,
    desglose_metodos JSON NULL,
    observaciones TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

// [tabla, columna, definición]
const COLUMNAS = [
  ['ventas', 'caja_sesion_id', 'INT NULL'],
  ['movimientos_caja', 'caja_sesion_id', 'INT NULL']
];

function linea() { console.log('─'.repeat(78)); }

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
    console.log('Crea la tabla caja_sesiones y agrega caja_sesion_id a ventas y movimientos_caja.');
    linea();

    masterConn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: MASTER_DB }));
    const [tenants] = await masterConn.query('SELECT business_name, db_name, is_active FROM tenants ORDER BY business_name');
    console.log('Tenants encontrados: ' + tenants.length);
    linea();

    for (const t of tenants) {
      conn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: t.db_name }));
      console.log((t.is_active ? '🟢' : '⚪') + ' ' + t.business_name + '  (' + t.db_name + ')');

      const tieneTabla = await tablaExiste(conn, t.db_name, 'caja_sesiones');
      if (tieneTabla) {
        console.log('     - tabla caja_sesiones  -> ✓ OK, ya existe');
      } else if (!CONFIRMAR) {
        console.log('     - tabla caja_sesiones  -> ❌ falta (se crearía al confirmar)');
      } else {
        await conn.query(CREATE_CAJA_SESIONES);
        console.log('     - tabla caja_sesiones  -> ✅ creada');
      }

      for (const [tabla, columna, def] of COLUMNAS) {
        const tieneCol = await columnaExiste(conn, t.db_name, tabla, columna);
        if (tieneCol) {
          console.log('     - ' + tabla + '.' + columna + '  -> ✓ OK, ya existe');
        } else if (!CONFIRMAR) {
          console.log('     - ' + tabla + '.' + columna + '  -> ❌ falta (se agregaría al confirmar)');
        } else {
          await conn.query('ALTER TABLE `' + tabla + '` ADD COLUMN `' + columna + '` ' + def);
          console.log('     - ' + tabla + '.' + columna + '  -> ✅ agregada');
        }
      }
      await conn.end(); conn = null;
    }

    linea();
    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log("Si se ve bien, corre:  DB_PASSWORD='...' CONFIRMAR=1 node migrar_caja_sesiones.js");
    } else {
      console.log('✅ LISTO. Ya se puede abrir/cerrar caja y todo queda ligado al turno correcto.');
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
