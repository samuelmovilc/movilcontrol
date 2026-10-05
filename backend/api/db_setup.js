const mysql = require('mysql2/promise');

async function run() {
  const c = await mysql.createConnection({
    host: '89.117.56.39',
    port: 3308,
    user: 'pos_user',
    password: 'Pap3l3r!4#S3cur3_2026',
    database: 'ventanas_estilo'
  });
  
  try {
    await c.query(`
      CREATE TABLE IF NOT EXISTS catalogos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        configuracion JSON NOT NULL,
        productos JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Tabla catalogos creada o ya existe.");
  } catch(e) {
    console.error(e);
  } finally {
    c.end();
  }
}
run();
