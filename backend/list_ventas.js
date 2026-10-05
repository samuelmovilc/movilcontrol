const mysql = require('mysql2/promise');

async function listVentas() {
    try {
        const conn = await mysql.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'pos_user',
            password: 'Pap3l3r!4#S3cur3_2026',
            database: 'ventanas_estilo'
        });

        console.log("Conectado a ventanas_estilo. Listando ventas recientes:");
        const [ventas] = await conn.query("SELECT * FROM ventas ORDER BY id DESC LIMIT 10");
        
        if (ventas.length === 0) {
            console.log("No hay ventas registradas en la base de datos.");
        } else {
            console.table(ventas);
        }

        await conn.end();
    } catch (e) {
        console.error("Error al consultar:", e.message);
    }
}

listVentas();
