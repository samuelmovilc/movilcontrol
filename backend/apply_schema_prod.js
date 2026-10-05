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

        console.log("Creando tablas para Crédito y Cartera en PRODUCCIÓN...");

        const sql = `
            -- TABLA CLIENTES
            CREATE TABLE IF NOT EXISTS clientes (
                id VARCHAR(50) PRIMARY KEY,
                nombre VARCHAR(200) NOT NULL,
                telefono VARCHAR(50),
                direccion VARCHAR(300),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            -- INSERTAR CLIENTE POR DEFECTO
            INSERT IGNORE INTO clientes (id, nombre) VALUES ('222222', 'CLIENTE POS');

            -- TABLA CREDITOS (Planes de crédito)
            CREATE TABLE IF NOT EXISTS creditos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cliente_id VARCHAR(50) NOT NULL,
                venta_id INT DEFAULT NULL,
                precio_contado DECIMAL(12,2) NOT NULL,
                porcentaje_recargo DECIMAL(5,2) NOT NULL,
                total_credito DECIMAL(12,2) NOT NULL,
                inicial DECIMAL(12,2) DEFAULT 0,
                num_cuotas INT NOT NULL,
                frecuencia ENUM('semanal', 'quincenal', 'mensual') NOT NULL,
                fecha_inicio DATE NOT NULL,
                estado ENUM('aprobado', 'activo', 'pagado', 'anulado') DEFAULT 'aprobado',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            -- TABLA CUOTAS DE CREDITO
            CREATE TABLE IF NOT EXISTS credito_cuotas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                credito_id INT NOT NULL,
                numero_cuota INT NOT NULL,
                fecha_vence DATE NOT NULL,
                valor DECIMAL(12,2) NOT NULL,
                pagado DECIMAL(12,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (credito_id) REFERENCES creditos(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

            -- TABLA MOVIMIENTOS CAJA (Ingresos y Egresos)
            CREATE TABLE IF NOT EXISTS movimientos_caja (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tipo ENUM('ingreso', 'egreso') NOT NULL,
                categoria VARCHAR(100) NOT NULL,
                monto DECIMAL(12,2) NOT NULL,
                metodo_pago VARCHAR(50) NOT NULL,
                observaciones TEXT,
                turno_id INT DEFAULT NULL,
                usuario VARCHAR(100) DEFAULT NULL,
                cliente_id VARCHAR(50) DEFAULT NULL,
                credito_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (credito_id) REFERENCES creditos(id) ON DELETE SET NULL,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await c.query(sql);
        console.log("Tablas creadas.");

        console.log("Agregando columnas a la tabla ventas...");
        try {
            await c.query("ALTER TABLE ventas ADD COLUMN cliente_id VARCHAR(50) DEFAULT NULL AFTER cliente;");
            await c.query("ALTER TABLE ventas ADD COLUMN estado_pago ENUM('contado', 'credito') DEFAULT 'contado' AFTER estado;");
            await c.query("ALTER TABLE ventas ADD COLUMN credito_id INT DEFAULT NULL AFTER estado_pago;");
            
            await c.query("ALTER TABLE ventas ADD CONSTRAINT fk_ventas_cliente_prod FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;");
            await c.query("ALTER TABLE ventas ADD CONSTRAINT fk_ventas_credito_prod FOREIGN KEY (credito_id) REFERENCES creditos(id) ON DELETE SET NULL;");
            console.log("Columnas agregadas a ventas.");
        } catch(e) {
            console.log("Columnas posiblemente ya existían en ventas:", e.message);
        }

        const [cfgRows] = await c.query('SELECT metodos_pago FROM configuracion LIMIT 1');
        if (cfgRows.length > 0) {
            let metodos = [];
            try {
                if(typeof cfgRows[0].metodos_pago === 'string') {
                    const parsed = JSON.parse(cfgRows[0].metodos_pago);
                    metodos = parsed.metodos_pago || parsed; 
                } else {
                    metodos = cfgRows[0].metodos_pago.metodos_pago || cfgRows[0].metodos_pago;
                }
            } catch(e) {}
            
            if (Array.isArray(metodos) && !metodos.includes("Crédito")) {
                metodos.push("Crédito");
                const newJson = JSON.stringify(metodos);
                await c.query("UPDATE configuracion SET metodos_pago = ? WHERE id = 1", [newJson]);
                console.log("Método 'Crédito' agregado a configuración.");
            }
        }

        console.log('¡Estructura de PRODUCCIÓN lista!');
        await c.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
