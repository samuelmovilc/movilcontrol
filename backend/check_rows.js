const mysql = require('mysql2/promise');

async function checkRows() {
    try {
        const conn = await mysql.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'root',
            password: 'R00t#C0nt4b0_P0S!2026',
            database: 'restaurante_app'
        });

        console.log("Check before delete:");

        const [turnos] = await conn.query("SELECT id FROM turnos_caja WHERE id IN (1,2,3,4,5)");
        console.log("Turnos a eliminar:", turnos.map(t => t.id).join(", "));

        const [gastos] = await conn.query("SELECT id FROM gastos WHERE turno_id IN (1,2,3,4,5)");
        console.log("Gastos a eliminar:", gastos.length);

        const [ventas] = await conn.query("SELECT id FROM ventas WHERE turno_id IN (1,2,3,4,5)");
        console.log("Ventas a eliminar:", ventas.length);
        
        const [pedidos] = await conn.query("SELECT id FROM pedidos WHERE turno_id IN (1,2,3,4,5)");
        console.log("Pedidos a eliminar:", pedidos.length);

        await conn.end();
    } catch (e) {
        console.error("Error:", e.message);
    }
}

checkRows();
