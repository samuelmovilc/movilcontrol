/**
 * CARGA INICIAL DE CLIENTES Y PRODUCTOS — tenancy_electrohogar
 * ---------------------------------------------------------------
 * Inserta los 12 clientes y los 12 productos reales que el dueño
 * de Electro Hogar entregó, para que el negocio arranque con su
 * propio registro (después de que tenancy_electrohogar quedó
 * vacía con reset_tenant_data.js).
 *
 * Uso:
 *   node cargar_datos_electrohogar.js
 *
 * Es seguro re-ejecutar SOLO si las tablas están vacías; si ya
 * corriste esto una vez, correrlo de nuevo fallará por ID duplicado
 * (eso es intencional, para no duplicar registros por accidente).
 */

const mysql = require('mysql2/promise');

const TENANT_DB = 'tenancy_electrohogar';

const dbConfig = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026',
  database: TENANT_DB
};

const CLIENTES = [
  ['1', 'LUISA', '999999999', 'SIN DIRECCION'],
  ['2', 'MAYO', '999999999', 'SIN DIRECCION'],
  ['3', 'JONATTAN', '999999999', 'SIN DIRECCION'],
  ['4', 'ROSA', '999999999', 'SIN DIRECCION'],
  ['5', 'ANY', '999999999', 'SIN DIRECCION'],
  ['6', 'JOEL', '999999999', 'SIN DIRECCION'],
  ['7', 'KATE', '999999999', 'SIN DIRECCION'],
  ['8', 'VERONOCICA', '999999999', 'SIN DIRECCION'],
  ['9', 'ELIAS', '999999999', 'SIN DIRECCION'],
  ['10', 'PAPA DE LUISA', '999999999', 'SIN DIRECCION'],
  ['11', 'KAREN', '999999999', 'SIN DIRECCION'],
  ['12', 'DAYANA', '999999999', 'SIN DIRECCION']
];

const PRODUCTOS = [
  ['1', 'CELULAR', 736000, 640000, 1],
  ['2', 'AIRE', 1230500, 1070000, 1],
  ['3', 'CELULAR', 402500, 350000, 1],
  ['4', 'CELULAR', 1035000, 900000, 1],
  ['5', 'FREIDORA', 264500, 230000, 1],
  ['6', 'LAVADORA', 632500, 550000, 1],
  ['7', 'TV', 460000, 400000, 1],
  ['8', 'CELULAR', 414000, 360000, 1],
  ['9', 'ABANICO', 97750, 85000, 1],
  ['10', 'PARLANTE', 322000, 280000, 1],
  ['11', 'FREIDORA', 224250, 195000, 1],
  ['12', 'ABANICO', 258750, 225000, 1]
];

function linea() { console.log('─'.repeat(70)); }

(async () => {
  let conn;
  try {
    linea();
    console.log('Conectando a "' + TENANT_DB + '"...');
    conn = await mysql.createConnection(dbConfig);
    console.log('   OK.');

    const [clientesAntesRows] = await conn.query('SELECT COUNT(*) AS c FROM clientes');
    const [productosAntesRows] = await conn.query('SELECT COUNT(*) AS c FROM productos');
    const clientesAntes = clientesAntesRows[0].c;
    const productosAntes = productosAntesRows[0].c;

    linea();
    console.log('ANTES: clientes=' + clientesAntes + '  productos=' + productosAntes);
    if (clientesAntes > 0 || productosAntes > 0) {
      console.log('   ⚠️  Ya hay datos en estas tablas. Si corres esto igual, puede fallar por ID duplicado.');
    }

    linea();
    console.log('Insertando ' + CLIENTES.length + ' clientes...');
    for (const c of CLIENTES) {
      await conn.query('INSERT INTO clientes (id, nombre, telefono, direccion) VALUES (?,?,?,?)', c);
      console.log('   ✅ Cliente ' + c[0] + ' - ' + c[1]);
    }

    linea();
    console.log('Insertando ' + PRODUCTOS.length + ' productos...');
    for (const p of PRODUCTOS) {
      await conn.query('INSERT INTO productos (id, nombre, precio_venta, precio_compra, stock) VALUES (?,?,?,?,?)', p);
      console.log('   ✅ Producto ' + p[0] + ' - ' + p[1] + ' ($' + p[2] + ')');
    }

    const [clientesDespuesRows] = await conn.query('SELECT COUNT(*) AS c FROM clientes');
    const [productosDespuesRows] = await conn.query('SELECT COUNT(*) AS c FROM productos');
    const clientesDespues = clientesDespuesRows[0].c;
    const productosDespues = productosDespuesRows[0].c;

    linea();
    console.log('✅ LISTO. "' + TENANT_DB + '" quedó con ' + clientesDespues + ' clientes y ' + productosDespues + ' productos.');
    linea();

  } catch (err) {
    console.error('❌ FALLÓ:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
