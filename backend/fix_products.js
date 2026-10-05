const mysql = require('mysql2/promise');

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
    
    console.log("Eliminando productos de papelería que se colaron por el schema...");
    await conn.query('DELETE FROM productos;');

    console.log("Insertando repuestos de motos de ejemplo...");
    const motosSql = `
      INSERT INTO productos (id, nombre, precio_venta, precio_compra, stock, entradas) VALUES
      ('MOT-001','Aceite de Motor 4T', 15.00, 10.00, 20, 20),
      ('MOT-002','Bujía NGK', 5.00, 2.50, 50, 50),
      ('MOT-003','Filtro de Aire Alto Flujo', 25.00, 15.00, 15, 15),
      ('MOT-004','Pastillas de Freno Delanteras', 12.00, 7.00, 30, 30),
      ('MOT-005','Kit de Arrastre (Cadena, Corona, Piñón)', 85.00, 60.00, 10, 10),
      ('MOT-006','Batería 12V 7Ah', 45.00, 32.00, 12, 12),
      ('MOT-007','Llanta Trasera 130/70-17', 120.00, 90.00, 8, 8),
      ('MOT-008','Casco Integral', 95.00, 70.00, 25, 25),
      ('MOT-009','Guantes de Cuero', 22.00, 14.00, 40, 40),
      ('MOT-010','Faro LED Frontal', 35.00, 24.00, 18, 18);
    `;
    await conn.query(motosSql);

    console.log("¡Productos de motos insertados con éxito!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

run();
