/**
 * CARGA DE PRODUCTOS DE EJEMPLO — tenancy_demo
 * ---------------------------------------------------------------
 * Agrega 15 productos de muestra (5 de Ropa y Calzado, 5 de
 * Ferretería, 5 de Repuestos de Auto) al tenant DEMO, con precios
 * promedio del mercado colombiano, para simular/explicar el
 * sistema a prospectos.
 *
 * NO borra nada — solo agrega. Usa IDs con prefijo (ROP-, FER-,
 * AUT-) para no chocar con productos que ya existan en tenancy_demo.
 *
 * Uso:
 *   node cargar_productos_demo.js
 */

const mysql = require('mysql2/promise');

const TENANT_DB = 'tenancy_demo';

const dbConfig = {
  host: process.env.DB_HOST || '89.117.56.39',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'pos_user',
  password: process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026',
  database: TENANT_DB
};

// [id, nombre, precio_venta, precio_compra, stock]
const PRODUCTOS = [
  // Ropa y Calzado
  ['ROP-1', 'Camiseta básica algodón', 35000, 20000, 10],
  ['ROP-2', 'Jean para hombre', 89000, 55000, 8],
  ['ROP-3', 'Zapatillas deportivas', 150000, 95000, 6],
  ['ROP-4', 'Chaqueta impermeable', 120000, 75000, 5],
  ['ROP-5', 'Camisa formal manga larga', 65000, 38000, 7],

  // Ferretería
  ['FER-1', 'Martillo de carpintero', 28000, 17000, 15],
  ['FER-2', 'Taladro eléctrico 1/2"', 180000, 130000, 4],
  ['FER-3', 'Caja de tornillos surtidos (100u)', 12000, 7000, 20],
  ['FER-4', 'Cinta métrica 5m', 15000, 9000, 12],
  ['FER-5', 'Juego de destornilladores (6pz)', 45000, 28000, 10],

  // Repuestos de Auto
  ['AUT-1', 'Pastillas de freno (juego)', 95000, 60000, 8],
  ['AUT-2', 'Filtro de aceite', 25000, 14000, 20],
  ['AUT-3', 'Batería 12V 45Ah', 380000, 290000, 3],
  ['AUT-4', 'Bujía (unidad)', 18000, 10000, 25],
  ['AUT-5', 'Correa de distribución', 150000, 95000, 5]
];

function linea() { console.log('─'.repeat(70)); }

(async () => {
  let conn;
  try {
    linea();
    console.log('Conectando a "' + TENANT_DB + '"...');
    conn = await mysql.createConnection(dbConfig);
    console.log('   OK.');

    const [antesRows] = await conn.query('SELECT COUNT(*) AS c FROM productos');
    console.log('   Productos actuales en tenancy_demo (sin tocar): ' + antesRows[0].c);

    linea();
    console.log('Insertando ' + PRODUCTOS.length + ' productos de ejemplo...');
    for (const p of PRODUCTOS) {
      await conn.query('INSERT INTO productos (id, nombre, precio_venta, precio_compra, stock) VALUES (?,?,?,?,?)', p);
      console.log('   ✅ ' + p[0] + ' - ' + p[1] + ' ($' + p[2].toLocaleString('es-CO') + ')');
    }

    const [despuesRows] = await conn.query('SELECT COUNT(*) AS c FROM productos');

    linea();
    console.log('✅ LISTO. "' + TENANT_DB + '" pasó de ' + antesRows[0].c + ' a ' + despuesRows[0].c + ' productos.');
    linea();

  } catch (err) {
    console.error('❌ FALLÓ:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
})();
