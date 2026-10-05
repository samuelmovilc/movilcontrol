const mysql = require('mysql2/promise');

async function run() {
  try {
    const conn = await mysql.createConnection({
      host: '89.117.56.39',
      port: 3308,
      user: 'pos_user_moto',
      password: 'M0t0s!4#S3cur3_2026',
      database: 'motos_app'
    });

    console.log("Añadiendo columna imagen a productos...");
    // Ignoring error if column already exists
    try {
      await conn.query('ALTER TABLE productos ADD COLUMN imagen LONGTEXT DEFAULT NULL;');
      console.log("Columna añadida con éxito.");
    } catch(e) {
      console.log(e.message);
    }
    
    // Also let's update schema.sql so future installations have it!
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}
run();
