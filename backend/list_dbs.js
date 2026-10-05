const mysql = require('mysql2/promise');

async function listDatabases() {
    try {
        const conn = await mysql.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'root',
            password: 'R00t#C0nt4b0_P0S!2026'
        });

        console.log("Conectado a Contabo. Listando bases de datos...");
        const [rows] = await conn.query("SHOW DATABASES");
        rows.forEach(r => console.log(r.Database));
        await conn.end();
    } catch (e) {
        console.error("Error al conectar:", e.message);
    }
}

listDatabases();
