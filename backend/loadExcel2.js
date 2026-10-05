const xlsx = require('xlsx');
const mysql = require('mysql2/promise');

async function loadData() {
  const pool = mysql.createPool({
    host: '89.117.56.39',
    port: 3308,
    database: 'papeleria_app',
    user: 'pos_user',
    password: 'Pap3l3r!4#S3cur3_2026'
  });
  
  const workbook = xlsx.readFile('C:\\Users\\SAMUEL CARIBEP\\Downloads\\PLANTILLA INVENTARIO (5).xlsx');
  const sheet_name_list = workbook.SheetNames;
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
  
  let inserted = 0;
  for (const row of data) {
    if (!row.codigo || !row.nombre) continue;
    try {
      await pool.query(
        'INSERT INTO productos (id, nombre, precio_venta, precio_compra, stock) VALUES (?, ?, ?, ?, ?)',
        [
          String(row.codigo),
          row.nombre,
          parseFloat(row.precioVenta) || 0,
          parseFloat(row.precioCompra) || 0,
          parseInt(row.entradas) || 0
        ]
      );
      inserted++;
    } catch(e) {
      console.error('Error inserting row', row.codigo, e.message);
    }
  }
  console.log('Finished inserting', inserted, 'products.');
  pool.end();
}
loadData();
