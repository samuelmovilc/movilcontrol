const mysql = require('mysql2/promise');
const fs = require('fs');

async function uploadLogo() {
    try {
        const logoData = fs.readFileSync('C:\\Users\\SAMUEL CARIBEP\\Desktop\\ANTIGRAVITY\\AMOVILCONTROL - DESARROLLOS\\APP VENTANAS Y ESTILOS\\frontend\\logo.jpeg');
        const base64Logo = 'data:image/jpeg;base64,' + logoData.toString('base64');
        
        const conn = await mysql.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'root',
            password: 'R00t#C0nt4b0_P0S!2026',
            database: 'ventanas_estilo'
        });

        await conn.query("UPDATE configuracion SET logo = ? WHERE id = 1;", [base64Logo]);
        console.log("Logo actualizado exitosamente");
        await conn.end();
    } catch (e) {
        console.error("Error al subir logo:", e.message);
    }
}

uploadLogo();
