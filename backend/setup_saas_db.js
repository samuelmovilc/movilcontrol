const mysql = require('mysql2/promise');

async function setupSaaSDB() {
  const connection = await mysql.createConnection({
    host: '89.117.56.39',
    port: 3308,
    user: 'pos_user',
    password: 'Pap3l3r!4#S3cur3_2026'
  });

  try {
    console.log("Creando base de datos saas_master...");
    await connection.query('CREATE DATABASE IF NOT EXISTS saas_master;');
    await connection.query('USE saas_master;');

    console.log("Creando tabla tenants...");
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        business_name VARCHAR(255) NOT NULL,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        db_name VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(100),
        phone VARCHAR(50),
        start_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        modules JSON,
        observations TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await connection.query(createTableQuery);
    
    // Insert initial demo tenant or admin if necessary (not really needed, admin is separate)
    console.log("Base de datos SaaS Master configurada correctamente.");
  } catch (error) {
    console.error("Error configurando SaaS Master:", error);
  } finally {
    await connection.end();
  }
}

setupSaaSDB();
