/**
 * DIAGNÓSTICO DE SEGURIDAD — por el aviso de Contabo del 14 de noviembre de 2026
 * -------------------------------------------------------------------------------
 * Contabo reportó acceso no autorizado a sus sistemas (reinicio de contraseñas
 * VNC, rotación de credenciales internas). Este script revisa, DESDE LA BASE DE
 * DATOS, todo lo que el usuario pos_user puede ver, para detectar cualquier
 * indicio de que algo cambió ahí sin que tú lo hicieras:
 *
 *   1. Versión y uptime del servidor MariaDB (¿se reinició? ¿cuándo?)
 *   2. TODAS las bases de datos que ve pos_user, comparadas contra la lista
 *      oficial de tenants en saas_master.tenants — cualquier base "extra" que
 *      no está en esa lista se marca para que la revises (puede ser otro
 *      programa tuyo usando el mismo usuario, o algo que no debería estar ahí).
 *   3. Los permisos exactos (GRANTS) que tiene pos_user — para documentar
 *      hasta dónde llega el daño si esa contraseña fue expuesta.
 *   4. Los usuarios de MySQL que existen en el servidor (si pos_user tiene
 *      permiso para verlos — normalmente un usuario de aplicación NO lo tiene,
 *      y eso es lo esperable, no un error).
 *   5. Conexiones activas en este momento (si pos_user tiene permiso para
 *      verlas) — para detectar alguna conexión que no reconozcas.
 *   6. Qué tablas hay en saas_master además de "tenants" (por si hay una tabla
 *      de administradores/credenciales que también debería revisarse).
 *
 * ESTE SCRIPT NO MODIFICA NADA. Es 100% diagnóstico, de principio a fin.
 * No necesita CONFIRMAR=1 porque no hace ningún cambio bajo ninguna condición.
 *
 * IMPORTANTE: esto solo ve lo que la base de datos expone. No reemplaza una
 * revisión del servidor mismo (SSH, procesos del sistema operativo, accesos
 * VNC/consola) — esa parte solo la puede hacer quien tenga acceso directo al
 * VPS (tú, o soporte de Contabo).
 *
 * La contraseña YA NO se escribe aquí como valor por defecto (antes sí estaba
 * hardcodeada en los scripts de este repo — con el aviso de Contabo, ese es
 * justamente un hábito a corregir). Este script EXIGE que se la pases por
 * variable de entorno.
 *
 * Uso:
 *   DB_PASSWORD='la_contraseña_actual' node diagnostico_seguridad_contabo_nov2026.js
 */

const mysql = require('mysql2/promise');

const MASTER_DB = 'saas_master';

if (!process.env.DB_PASSWORD) {
  console.error('❌ Falta DB_PASSWORD. Corre así:');
  console.error("   DB_PASSWORD='la_contraseña_actual' node diagnostico_seguridad_contabo_nov2026.js");
  process.exit(1);
}

const dbConfigBase = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD
};

function linea() { console.log('═'.repeat(78)); }
function sub() { console.log('─'.repeat(78)); }

(async () => {
  let masterConn;
  try {
    linea();
    console.log('DIAGNÓSTICO DE SEGURIDAD — incidente Contabo 14/nov/2026');
    console.log('100% de solo lectura. No se modifica nada en ningún momento.');
    linea();

    masterConn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: MASTER_DB }));
    console.log('✅ Conexión exitosa a ' + MASTER_DB + ' con usuario "' + dbConfigBase.user + '"');

    // 1) Versión y uptime del servidor
    sub();
    console.log('1) VERSIÓN Y UPTIME DEL SERVIDOR');
    const [[verRow]] = await masterConn.query('SELECT VERSION() as version');
    console.log('   Versión MariaDB/MySQL: ' + verRow.version);
    try {
      const [uptimeRows] = await masterConn.query("SHOW STATUS LIKE 'Uptime'");
      if (uptimeRows.length) {
        const segs = parseInt(uptimeRows[0].Value, 10);
        const dias = (segs / 86400).toFixed(1);
        console.log('   Uptime del servidor: ' + segs + ' segundos (~' + dias + ' días)');
        console.log('   -> Si esto es MENOS tiempo del que ha pasado desde el 14-nov-2026,');
        console.log('      el servidor se reinició después del incidente (puede ser el propio');
        console.log('      mantenimiento de Contabo, o algo a confirmar con ellos).');
      }
    } catch (e) { console.log('   (no se pudo leer el uptime: ' + e.message + ')'); }

    // 2) Tenants oficiales vs. bases de datos realmente visibles
    sub();
    console.log('2) BASES DE DATOS VISIBLES PARA "' + dbConfigBase.user + '" vs. TENANTS OFICIALES');
    const [tenants] = await masterConn.query('SELECT business_name, db_name, is_active FROM tenants ORDER BY db_name');
    const dbNamesOficiales = new Set(tenants.map(t => t.db_name));
    console.log('   Tenants registrados en saas_master.tenants: ' + tenants.length);

    const [dbsVisibles] = await masterConn.query('SHOW DATABASES');
    const nombresVisibles = dbsVisibles.map(r => r.Database);
    const SISTEMA = new Set(['information_schema', 'mysql', 'performance_schema', 'sys', MASTER_DB]);
    const extras = nombresVisibles.filter(n => !SISTEMA.has(n) && !dbNamesOficiales.has(n));
    const faltantes = [...dbNamesOficiales].filter(n => !nombresVisibles.includes(n));

    console.log('   Bases de datos visibles en total: ' + nombresVisibles.length);
    if (extras.length) {
      console.log('   ⚠️  BASES QUE NO ESTÁN EN LA LISTA DE TENANTS (revisar qué son):');
      extras.forEach(n => console.log('      - ' + n));
    } else {
      console.log('   ✓ No hay bases "extra" sin explicación — todo lo visible corresponde a un tenant registrado.');
    }
    if (faltantes.length) {
      console.log('   ⚠️  Tenants registrados pero cuya base NO es visible para este usuario:');
      faltantes.forEach(n => console.log('      - ' + n));
    }

    // 3) Permisos exactos de pos_user
    sub();
    console.log('3) PERMISOS (GRANTS) DE "' + dbConfigBase.user + '"');
    try {
      const [grants] = await masterConn.query('SHOW GRANTS');
      grants.forEach(g => console.log('   ' + Object.values(g)[0]));
    } catch (e) { console.log('   (no se pudo leer: ' + e.message + ')'); }

    // 4) Usuarios de MySQL en el servidor (normalmente un usuario de app NO puede ver esto)
    sub();
    console.log('4) USUARIOS DE MYSQL EN EL SERVIDOR');
    try {
      const [users] = await masterConn.query('SELECT user, host FROM mysql.user ORDER BY user, host');
      console.log('   Total de usuarios: ' + users.length);
      users.forEach(u => console.log('   - ' + u.user + '@' + u.host));
      const sospechosos = users.filter(u => u.host === '%' && (u.user === 'root' || u.user === ''));
      if (sospechosos.length) {
        console.log('   ⚠️  Usuarios con acceso amplio que conviene revisar:');
        sospechosos.forEach(u => console.log('      - ' + u.user + '@' + u.host));
      }
    } catch (e) {
      console.log('   (Sin permiso para ver esto — es lo ESPERABLE para un usuario de aplicación,');
      console.log('    no es un error. Mensaje: ' + e.message + ')');
    }

    // 5) Conexiones activas ahora mismo
    sub();
    console.log('5) CONEXIONES ACTIVAS EN ESTE MOMENTO');
    try {
      const [proc] = await masterConn.query('SHOW FULL PROCESSLIST');
      console.log('   Total de conexiones activas: ' + proc.length);
      proc.forEach(p => console.log('   - Usuario=' + p.User + '  Host=' + p.Host + '  DB=' + (p.db||'-') + '  Comando=' + p.Command + '  Tiempo=' + p.Time + 's'));
      console.log('   -> Revisa si todos los "Host" te son familiares (deberían ser de tu backend en Vercel).');
    } catch (e) {
      console.log('   (Sin permiso para ver esto — es lo ESPERABLE para un usuario de aplicación,');
      console.log('    no es un error. Mensaje: ' + e.message + ')');
    }

    // 6) Tablas dentro de saas_master (por si hay una tabla de administradores)
    sub();
    console.log('6) TABLAS DENTRO DE ' + MASTER_DB);
    const [tablasMaster] = await masterConn.query('SHOW TABLES');
    tablasMaster.forEach(t => console.log('   - ' + Object.values(t)[0]));

    linea();
    console.log('FIN DEL DIAGNÓSTICO. No se modificó absolutamente nada.');
    console.log('Pega toda esta salida completa para que se analice.');
    linea();

  } catch (err) {
    console.error('❌ FALLÓ EL DIAGNÓSTICO:', err.message);
    process.exit(1);
  } finally {
    if (masterConn) await masterConn.end();
  }
})();
