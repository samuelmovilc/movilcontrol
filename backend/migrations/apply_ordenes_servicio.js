// Aplica el esquema del módulo "Órdenes de Servicio" (2026_10_13_ordenes_servicio.sql)
// en TODAS las bases de datos de tenants existentes.
//
// Uso:
//   node backend/migrations/apply_ordenes_servicio.js
//
// Qué hace:
//   1. Se conecta a `saas_master` y lee la lista de tenants (db_name).
//   2. Para cada tenant, se conecta a su base y corre el script SQL
//      del módulo (tablas nuevas + columnas nuevas), statement por
//      statement, envolviendo cada uno en try/catch para que si una
//      columna/tabla ya existe (re-ejecución, o motor de MySQL que no
//      soporta "ADD COLUMN IF NOT EXISTS") no tumbe el resto del script.
//   3. Imprime un resumen final: qué tenants quedaron OK y cuáles
//      tuvieron algún error para revisar a mano.
//
// Las credenciales salen de las mismas variables de entorno que usa
// backend/api/index.js (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD), con
// los mismos valores por defecto, para no duplicar secretos nuevos.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || '89.117.56.39';
const DB_PORT = parseInt(process.env.DB_PORT) || 3308;
const DB_USER = process.env.DB_USER || 'pos_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026';

const sqlPath = path.join(__dirname, '2026_10_13_ordenes_servicio.sql');
const sqlRaw = fs.readFileSync(sqlPath, 'utf8');

// Quita comentarios de línea (--) y separa en statements por ";"
const statements = sqlRaw
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

async function applyToTenant(dbName) {
  const conn = await mysql.createConnection({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: dbName
  });
  const errors = [];
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
    } catch (e) {
      // "Duplicate column" / "already exists" son esperables en una
      // segunda corrida o en un motor viejo sin "IF NOT EXISTS" en ALTER.
      errors.push({ stmt: stmt.slice(0, 60) + '...', message: e.message });
    }
  }
  await conn.end();
  return errors;
}

async function run() {
  const masterConn = await mysql.createConnection({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: 'saas_master'
  });
  const [tenants] = await masterConn.query('SELECT id, business_name, db_name FROM tenants');
  await masterConn.end();

  console.log(`Encontrados ${tenants.length} tenants. Aplicando esquema de Órdenes de Servicio...\n`);

  const resumen = { ok: [], conErrores: [], fallidos: [] };

  for (const t of tenants) {
    process.stdout.write(`→ ${t.business_name} (${t.db_name}) ... `);
    try {
      const errors = await applyToTenant(t.db_name);
      if (errors.length === 0) {
        console.log('OK');
        resumen.ok.push(t.db_name);
      } else {
        console.log(`OK con ${errors.length} aviso(s) (probablemente ya aplicado antes)`);
        resumen.conErrores.push({ db: t.db_name, errors });
      }
    } catch (e) {
      console.log('FALLÓ: ' + e.message);
      resumen.fallidos.push({ db: t.db_name, message: e.message });
    }
  }

  console.log('\n──────── RESUMEN ────────');
  console.log(`OK sin avisos: ${resumen.ok.length}`);
  console.log(`OK con avisos: ${resumen.conErrores.length}`);
  console.log(`Fallidos:      ${resumen.fallidos.length}`);
  if (resumen.conErrores.length) {
    console.log('\nDetalle de avisos:');
    resumen.conErrores.forEach(r => {
      console.log(`  ${r.db}:`);
      r.errors.forEach(e => console.log(`    - ${e.stmt} → ${e.message}`));
    });
  }
  if (resumen.fallidos.length) {
    console.log('\nDetalle de fallos (revisar a mano):');
    resumen.fallidos.forEach(r => console.log(`  ${r.db}: ${r.message}`));
  }
  process.exit(resumen.fallidos.length ? 1 : 0);
}

run().catch(e => { console.error('Error general:', e.message); process.exit(1); });
