const mysql = require('mysql2/promise');

async function cleanVentas() {
    try {
        const conn = await mysql.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'pos_user',
            password: 'Pap3l3r!4#S3cur3_2026',
            database: 'ventanas_estilo'
        });

        console.log("Conectado a ventanas_estilo. Eliminando ventas de prueba...");
        await conn.query("SET FOREIGN_KEY_CHECKS = 0;");
        await conn.query("TRUNCATE TABLE venta_productos;");
        await conn.query("TRUNCATE TABLE ventas;");
        await conn.query("SET FOREIGN_KEY_CHECKS = 1;");
        console.log("¡Ventas y detalles eliminados correctamente! Los contadores de ID volverán a empezar desde 1.");

        // Optionally clean up entrances/outputs in products if any
        await conn.query("UPDATE productos SET stock = entradas, salidas = 0;");
        console.log("Stock de productos restaurado a sus entradas iniciales.");

        await conn.end();
    } catch (e) {
        console.error("Error al limpiar ventas:", e.message);
    }
}

cleanVentas();
