const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDB() {
    try {
        console.log("Conectando al servidor MariaDB en Contabo...");
        const conn = await mysql.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'root',
            password: 'R00t#C0nt4b0_P0S!2026',
            multipleStatements: true
        });

        console.log("Creando base de datos ventanas_estilo...");
        await conn.query("CREATE DATABASE IF NOT EXISTS ventanas_estilo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
        await conn.query("USE ventanas_estilo;");
        await conn.query("GRANT ALL PRIVILEGES ON ventanas_estilo.* TO 'pos_user'@'%'; FLUSH PRIVILEGES;");
        
        console.log("Ejecutando schema.sql...");
        const schemaPath = 'C:\\Users\\SAMUEL CARIBEP\\Desktop\\ANTIGRAVITY\\AMOVILCONTROL - DESARROLLOS\\APP VENTANAS Y ESTILOS\\schema.sql';
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        // Remove the `USE papeleria_dangedav;` or `USE papeleria_app;` if it exists in the schema
        const cleanSchema = schemaSql.replace(/USE [a-zA-Z0-9_]+;/g, '');
        
        await conn.query(cleanSchema);
        
        // Update the default config name to "Ventanas y Estilo"
        await conn.query("UPDATE configuracion SET nombre_negocio = 'Ventanas y Estilo' WHERE id = 1;");
        
        console.log("¡Base de datos ventanas_estilo configurada exitosamente!");
        await conn.end();
    } catch (e) {
        console.error("Error al configurar la BD:", e.message);
    }
}

setupDB();
