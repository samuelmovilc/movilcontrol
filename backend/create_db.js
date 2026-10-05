const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
  try {
    const conn = await mysql.createConnection({
      host: '89.117.56.39',
      port: 3308,
      user: 'pos_user_moto',
      password: 'M0t0s!4#S3cur3_2026',
      database: 'motos_app',
      multipleStatements: true
    });

    console.log("Conectado a motos_app exitosamente.");
    
    console.log("Leyendo schema...");
    const schema = fs.readFileSync('C:\\Users\\SAMUEL CARIBEP\\Desktop\\ANTIGRAVITY\\AMOVILCONTROL - DESARROLLOS\\APP PAPELERIA\\CLIENTE MOTOS\\schema.sql', 'utf8');
    
    console.log("Ejecutando schema.sql...");
    await conn.query(schema);

    console.log("¡Tablas creadas con éxito!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

run();
