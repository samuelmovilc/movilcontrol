const mysql = require('mysql2/promise');
async function clearDB() {
  const pool = mysql.createPool({
    host: '89.117.56.39',
    port: 3308,
    database: 'papeleria_app',
    user: 'pos_user',
    password: 'Pap3l3r!4#S3cur3_2026'
  });
  try {
    await pool.query('SET FOREIGN_KEY_CHECKS = 0;');
    await pool.query('TRUNCATE TABLE venta_productos;');
    await pool.query('TRUNCATE TABLE ventas;');
    await pool.query('TRUNCATE TABLE productos;');
    await pool.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Tables TRUNCATED successfully.');
  } catch(e) {
    console.error('Error:', e);
  } finally {
    pool.end();
  }
}
clearDB();
