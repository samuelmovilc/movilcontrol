const m = require('mysql2/promise');

(async () => {
    try {
        const c = await m.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'root',
            password: 'R00t#C0nt4b0_P0S!2026',
            database: 'ventanas_estilo',
            multipleStatements: true
        });

        console.log("Creando tabla catalogos en PRODUCCIÓN...");

        const sql = `
            CREATE TABLE IF NOT EXISTS catalogos (
                slug VARCHAR(50) PRIMARY KEY,
                configuracion JSON NOT NULL,
                productos JSON NOT NULL,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await c.query(sql);
        console.log("Tabla catalogos creada o verificada.");
        await c.end();
    } catch (e) {
        console.error(e);
    }
})();
