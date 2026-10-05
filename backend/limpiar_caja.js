const mysql = require('mysql2/promise');

async function cleanCajas() {
    try {
        const conn = await mysql.createConnection({
            host: '89.117.56.39',
            port: 3308,
            user: 'root',
            password: 'R00t#C0nt4b0_P0S!2026',
            database: 'restaurante_app'
        });

        console.log("Conectado. Eliminando registros asociados a turnos 1,2,3,4,5...");
        
        const [ventas] = await conn.query("SELECT id FROM ventas WHERE turno_id IN (1,2,3,4,5)");
        const ventaIds = ventas.map(v => v.id);
        
        if (ventaIds.length > 0) {
            await conn.query(`DELETE FROM venta_metodos_pago WHERE venta_id IN (?)`, [ventaIds]);
            // If there's a venta_productos or something similar
            const [tables] = await conn.query("SHOW TABLES LIKE 'venta_productos'");
            if (tables.length > 0) {
                 await conn.query(`DELETE FROM venta_productos WHERE venta_id IN (?)`, [ventaIds]);
            }
            await conn.query(`DELETE FROM ventas WHERE id IN (?)`, [ventaIds]);
            console.log(`Eliminadas ${ventaIds.length} ventas y sus detalles.`);
        }

        const [gastos] = await conn.query("DELETE FROM gastos WHERE turno_id IN (1,2,3,4,5)");
        console.log("Gastos eliminados:", gastos.affectedRows);

        const [saldos] = await conn.query("DELETE FROM turno_saldos_iniciales WHERE turno_id IN (1,2,3,4,5)");
        console.log("Saldos iniciales eliminados:", saldos.affectedRows);

        const [turnos] = await conn.query("DELETE FROM turnos_caja WHERE id IN (1,2,3,4,5)");
        console.log("Turnos eliminados:", turnos.affectedRows);

        await conn.end();
    } catch (e) {
        console.error("Error:", e.message);
    }
}

cleanCajas();
