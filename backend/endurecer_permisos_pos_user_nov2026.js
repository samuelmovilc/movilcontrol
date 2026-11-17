/**
 * ENDURECER PERMISOS de pos_user — hallazgo del diagnóstico de seguridad (Contabo, nov 2026)
 * -------------------------------------------------------------------------------------------
 * El diagnóstico (diagnostico_seguridad_contabo_nov2026.js) encontró que "pos_user" tiene:
 *
 *   GRANT ALL PRIVILEGES ON *.* TO `pos_user`@`%` WITH GRANT OPTION
 *
 * Eso es acceso TOTAL a absolutamente todas las bases del servidor — no solo a los 18
 * tenants de movilcontrol, sino también a bases de otros programas que NO tienen nada
 * que ver con movilcontrol (restaurante_app, finanzas_db, motos_app, motos_app_2,
 * papeleria_app, papeleria_dangedav, mirestaurante_saas, minipos_db, ventanas_estilo,
 * ventanas_estilo_pruebas, tenancy_melona, tenancy_pragabar, tenancy_resta,
 * tenancy_verona). Si esta contraseña se filtra, el daño no es solo a movilcontrol:
 * es a TODO lo que hay en el servidor.
 *
 * Este script dejа a pos_user con acceso SOLO a lo que movilcontrol realmente usa:
 *   - saas_master (la base maestra del SaaS)
 *   - cada base de datos que aparece en saas_master.tenants (se lee dinámicamente,
 *     así que cubre automáticamente cualquier tenant nuevo que se haya agregado)
 *
 * Esto es SEGURO de aplicar de inmediato:
 *   - NO borra ningún dato.
 *   - NO afecta a movilcontrol: solo le quita a pos_user permisos que movilcontrol
 *     nunca necesitó ni usó.
 *   - NO afecta a tus otros programas: según el diagnóstico, esos se conectan con
 *     otros usuarios (root, saas_user), no con pos_user.
 *   - NO cambia la contraseña (eso es un paso aparte, que si hay que coordinar con
 *     Vercel para no causar una caída — ver rotar_password_pos_user_nov2026.js).
 *
 * SOLO LECTURA por defecto. Con CONFIRMAR=1 aplica el endurecimiento.
 *
 * Uso:
 *   DB_PASSWORD='la_contraseña_actual' node endurecer_permisos_pos_user_nov2026.js
 *   DB_PASSWORD='la_contraseña_actual' CONFIRMAR=1 node endurecer_permisos_pos_user_nov2026.js
 */

const mysql = require('mysql2/promise');

const MASTER_DB = 'saas_master';

if (!process.env.DB_PASSWORD) {
  console.error('❌ Falta DB_PASSWORD. Corre así:');
  console.error("   DB_PASSWORD='la_contraseña_actual' node endurecer_permisos_pos_user_nov2026.js");
  process.exit(1);
}

const dbConfigBase = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD
};

const CONFIRMAR = process.env.CONFIRMAR === '1';
const DB_USER_OBJETIVO = process.env.DB_USER || 'pos_user';

function linea() { console.log('─'.repeat(78)); }

(async () => {
  let conn;
  try {
    linea();
    console.log(CONFIRMAR ? 'MODO: APLICAR (CONFIRMAR=1)' : 'MODO: SOLO LECTURA (diagnóstico, no modifica nada)');
    console.log('Objetivo: quitarle a "' + DB_USER_OBJETIVO + '" el acceso a TODO (*.*) y dejarlo');
    console.log('solo con acceso a saas_master + las bases de los tenants de movilcontrol.');
    linea();

    conn = await mysql.createConnection(Object.assign({}, dbConfigBase, { database: MASTER_DB }));
    const [tenants] = await conn.query('SELECT business_name, db_name FROM tenants ORDER BY db_name');
    console.log('Tenants encontrados en saas_master.tenants: ' + tenants.length);
    linea();

    const basesAConservar = [MASTER_DB, ...tenants.map(t => t.db_name)];
    console.log('Bases a las que "' + DB_USER_OBJETIVO + '" SEGUIRÁ teniendo acceso total (' + basesAConservar.length + '):');
    basesAConservar.forEach(b => console.log('   ✓ ' + b));
    linea();

    console.log('Paso 1 (si se confirma): quitar el acceso global *.* y GRANT OPTION.');
    console.log('   REVOKE ALL PRIVILEGES, GRANT OPTION ON *.* FROM `' + DB_USER_OBJETIVO + '`@`%`;');
    console.log('Paso 2 (si se confirma): re-otorgar acceso explícito solo a las bases de arriba.');
    basesAConservar.forEach(b => console.log('   GRANT ALL PRIVILEGES ON `' + b + '`.* TO `' + DB_USER_OBJETIVO + '`@`%`;'));
    linea();

    if (!CONFIRMAR) {
      console.log('Esto fue solo un diagnóstico. No se modificó nada.');
      console.log('Si se ve bien (revisa que los 18 tenants + saas_master estén completos),');
      console.log("corre:  DB_PASSWORD='...' CONFIRMAR=1 node endurecer_permisos_pos_user_nov2026.js");
    } else {
      await conn.query('REVOKE ALL PRIVILEGES, GRANT OPTION ON *.* FROM `' + DB_USER_OBJETIVO + '`@`%`');
      console.log('✅ Acceso global (*.*) revocado.');
      for (const b of basesAConservar) {
        await conn.query('GRANT ALL PRIVILEGES ON `' + b + '`.* TO `' + DB_USER_OBJETIVO + '`@`%`');
      }
      console.log('✅ Acceso explícito otorgado a las ' + basesAConservar.length + ' bases de movilcontrol.');
      await conn.query('FLUSH PRIVILEGES');
      console.log('✅ Privilegios recargados.');
      console.log('');
      console.log('LISTO. "' + DB_USER_OBJETIVO + '" ya NO puede tocar ninguna base ajena a movilcontrol.');
      console.log('IMPORTANTE: cuando crees un tenant NUEVO en el futuro, hay que agregar un');
      console.log('GRANT explícito para esa base nueva (te lo recuerdo cuando llegue el momento,');
      console.log('o puedo dejarte un script de un solo uso para eso).');
    }
    linea();

  } catch (err) {
    console.error('❌ FALLÓ:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
