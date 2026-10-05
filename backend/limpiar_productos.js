const mysql = require('mysql2/promise');

async function cleanDummyProducts() {
    try {
        const conn = await mysql.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'root',
            password: 'R00t#C0nt4b0_P0S!2026',
            database: 'ventanas_estilo'
        });

        console.log("Conectado a ventanas_estilo. Limpiando productos de prueba (papeleria)...");
        await conn.query("DELETE FROM productos");
        await conn.query("DELETE FROM ventas");
        await conn.query("DELETE FROM venta_productos");
        console.log("¡Productos eliminados correctamente!");
        await conn.end();
    } catch (e) {
        console.error("Error al limpiar:", e.message);
    }
}

cleanDummyProducts();
