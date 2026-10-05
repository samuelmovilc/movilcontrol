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
    
    console.log("Eliminando productos de ejemplo anteriores...");
    await conn.query('DELETE FROM productos;');

    console.log("Insertando los productos del catálogo en pesos colombianos...");
    const motosSql = `
      INSERT INTO productos (id, nombre, precio_venta, precio_compra, stock, entradas) VALUES
      ('DJ-059', 'BATERIA YTX4-BS ECO/CB110/DREAM NEO', 48500, 35000, 10, 10),
      ('DJ-057', 'BATERIA YB5-LBS PULSAR/DISCOVER/XTZ-125', 57500, 42000, 10, 10),
      ('DJ-056', 'BATERIA YB2.5L-BS BOXER/ECO 100+/RX', 36000, 26000, 10, 10),
      
      ('DJ-264', 'DIRECCIONAL BOXER CT AMBAR', 12000, 8000, 10, 10),
      ('DJ-285', 'DIRECCIONAL DT 125 PAR', 15000, 10000, 10, 10),
      ('DJ-278', 'DIRECCIONAL RX-115 CROMADO PAR', 15000, 10000, 10, 10),
      ('DJ-3579', 'DIRECCIONAL RX-115 CROMADO REDONDO PAR', 15000, 10000, 10, 10),
      
      ('DJ-2433', 'STOP COMPLETO CON PORTAPLACA XL-125', 20000, 14000, 10, 10),
      ('DJ-2436', 'STOP COMPLETO CB-110', 18000, 12000, 10, 10),
      ('DJ-2437', 'STOP COMPLETO ECO DELUX', 22000, 15000, 10, 10),
      ('DJ-2440', 'STOP COMPLETO XTZ-125', 22000, 15000, 10, 10),
      ('DJ-2441', 'STOP COMPLETO AKT NKD HUMO', 25000, 18000, 10, 10),
      
      ('DJ-2413', 'SUICHE TAPA DE GASOLINA SEGURO AX-100', 35000, 25000, 10, 10),
      ('DJ-2414', 'SUICHE TAPA DE GASOLINA CB-110', 44000, 32000, 10, 10),
      ('DJ-2422', 'SUICHE TAPA DE GASOLINA SEGURO DISCOVER 125-ST', 52000, 38000, 10, 10),
      ('DJ-2421', 'SUICHE TAPA DE GASOLINA CB125F', 50000, 36000, 10, 10);
    `;
    await conn.query(motosSql);

    console.log("¡Productos insertados con éxito!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

run();
