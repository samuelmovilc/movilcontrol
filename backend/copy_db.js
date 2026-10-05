const m = require('mysql2/promise');

(async () => {
    try {
        const c = await m.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'root',
            password: 'R00t#C0nt4b0_P0S!2026'
        });

        console.log("Creando DB ventanas_estilo_pruebas...");
        await c.query("CREATE DATABASE IF NOT EXISTS ventanas_estilo_pruebas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        await c.query("GRANT ALL PRIVILEGES ON ventanas_estilo_pruebas.* TO 'pos_user'@'%'");
        await c.query("FLUSH PRIVILEGES");
        await c.query("SET FOREIGN_KEY_CHECKS=0");

        const [tables] = await c.query('SHOW TABLES FROM ventanas_estilo');
        
        for (const tObj of tables) {
            const t = Object.values(tObj)[0];
            await c.query(`DROP TABLE IF EXISTS ventanas_estilo_pruebas.${t}`);
            
            const [createStmt] = await c.query(`SHOW CREATE TABLE ventanas_estilo.${t}`);
            let ddl = createStmt[0]['Create Table'];
            
            // Reemplazar la creación
            ddl = ddl.replace(`CREATE TABLE \`${t}\``, `CREATE TABLE \`ventanas_estilo_pruebas\`.\`${t}\``);
            
            console.log(`Creando tabla ${t}...`);
            await c.query(ddl);
            
            console.log(`Copiando datos de ${t}...`);
            await c.query(`INSERT INTO ventanas_estilo_pruebas.${t} SELECT * FROM ventanas_estilo.${t}`);
        }

        await c.query("SET FOREIGN_KEY_CHECKS=1");
        console.log('¡Base de datos clonada exitosamente!');
        await c.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
