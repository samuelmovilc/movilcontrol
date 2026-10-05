const mysql = require('mysql2/promise');

async function checkRestaurante() {
    try {
        const conn = await mysql.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'root',
            password: 'R00t#C0nt4b0_P0S!2026',
            database: 'restaurante_app'
        });

        console.log("Tablas en restaurante_app:");
        const [tables] = await conn.query("SHOW TABLES");
        console.table(tables);

        // Fetch schema of the caja / turnos table
        const [cajaCols] = await conn.query("DESCRIBE turnos");
        console.log("Columnas de turnos:");
        console.table(cajaCols);

        const [ventasCols] = await conn.query("DESCRIBE pedidos");
        console.log("Columnas de pedidos:");
        console.table(ventasCols);

        await conn.end();
    } catch (e) {
        console.error("Error:", e.message);
    }
}

checkRestaurante();
