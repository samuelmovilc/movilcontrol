const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'api', 'index.js');
let code = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const adminAPI = `
// ════════════════════════════════
// SAAS ADMIN API
// ════════════════════════════════
const saasAdminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (token !== 'CaribeAdminSaaS2026!') return res.status(403).json({ error: 'No autorizado' });
  next();
};

app.get('/api/saas/tenants', saasAdminAuth, async (req, res) => {
  try {
    const [rows] = await masterPool.query('SELECT * FROM tenants ORDER BY created_at DESC');
    // Parse modules back to object
    rows.forEach(r => {
      try { r.modules = typeof r.modules === 'string' ? JSON.parse(r.modules) : r.modules; } catch(e) { r.modules = {}; }
    });
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/saas/tenants', saasAdminAuth, async (req, res) => {
  try {
    const { business_name, username, password, db_name, email, phone, start_date, end_date, observations, modules, is_active } = req.body;
    
    // Create DB dynamically for the new tenant
    await masterPool.query(\`CREATE DATABASE IF NOT EXISTS \${db_name};\`);
    await masterPool.query(\`GRANT ALL PRIVILEGES ON \${db_name}.* TO 'pos_user'@'%';\`);
    await masterPool.query('FLUSH PRIVILEGES;');
    
    // Create the basic tables for this new tenant
    const tPool = mysql.createPool({
      host:            process.env.DB_HOST     || '89.117.56.39',
      port:            parseInt(process.env.DB_PORT) || 3308,
      database:        db_name,
      user:            process.env.DB_USER     || 'pos_user',
      password:        process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026',
      waitForConnections: true,
      connectionLimit: 5
    });

    const schemaSQL = \`
      CREATE TABLE IF NOT EXISTS productos (
        id VARCHAR(50) PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        precio_venta DECIMAL(10,2) NOT NULL,
        precio_min DECIMAL(10,2),
        precio_compra DECIMAL(10,2),
        stock INT DEFAULT 0,
        entradas INT DEFAULT 0,
        salidas INT DEFAULT 0,
        imagen LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS clientes (
        id VARCHAR(50) PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        telefono VARCHAR(50),
        direccion VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ventas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folio VARCHAR(50) NOT NULL UNIQUE,
        fecha DATE NOT NULL,
        hora TIME NOT NULL,
        cliente VARCHAR(150),
        cliente_id VARCHAR(50),
        observaciones TEXT,
        metodo_pago VARCHAR(50),
        metodos_pago TEXT,
        total DECIMAL(10,2) NOT NULL,
        cambio DECIMAL(10,2),
        estado ENUM('aceptada','anulada') DEFAULT 'aceptada',
        estado_pago ENUM('contado','credito') DEFAULT 'contado',
        credito_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS venta_productos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        venta_id INT NOT NULL,
        producto_id VARCHAR(50) NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        cantidad INT NOT NULL,
        precio_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS configuracion (
        id INT PRIMARY KEY DEFAULT 1,
        nombre_negocio VARCHAR(100) NOT NULL,
        direccion VARCHAR(200),
        telefono VARCHAR(50),
        logo LONGTEXT,
        metodos_pago JSON,
        mensaje_tirilla VARCHAR(200),
        stock_critico INT DEFAULT 10,
        tamano_ticket VARCHAR(20) DEFAULT '80mm',
        mostrarPrecios BOOLEAN DEFAULT TRUE,
        pin VARCHAR(20) DEFAULT '3195122754',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS catalogos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(50) UNIQUE NOT NULL,
        configuracion JSON,
        productos JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS movimientos_caja (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo ENUM('ingreso','egreso') NOT NULL,
        categoria VARCHAR(100) NOT NULL,
        monto DECIMAL(10,2) NOT NULL,
        metodo_pago VARCHAR(50),
        observaciones TEXT,
        cliente_id VARCHAR(50) NULL,
        credito_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS creditos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id VARCHAR(50) NOT NULL,
        venta_id INT NULL,
        precio_contado DECIMAL(10,2) NOT NULL,
        porcentaje_recargo DECIMAL(5,2) DEFAULT 0,
        total_credito DECIMAL(10,2) NOT NULL,
        inicial DECIMAL(10,2) DEFAULT 0,
        num_cuotas INT NOT NULL,
        frecuencia ENUM('semanal','quincenal','mensual') DEFAULT 'quincenal',
        fecha_inicio DATE NULL,
        estado ENUM('aprobado','activo','pagado','anulado') DEFAULT 'aprobado',
        productos_cotizados JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS credito_cuotas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        credito_id INT NOT NULL,
        numero_cuota INT NOT NULL,
        fecha_vence DATE NOT NULL,
        valor DECIMAL(10,2) NOT NULL,
        pagado DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY (credito_id) REFERENCES creditos(id) ON DELETE CASCADE
      );
      INSERT IGNORE INTO configuracion (id, nombre_negocio, metodos_pago) VALUES (1, ?, '["Efectivo","Tarjeta débito","Tarjeta crédito","Transferencia","Otro"]');
      INSERT IGNORE INTO clientes (id, nombre) VALUES ('222222', 'CLIENTE POS');
    \`;

    const statements = schemaSQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (let stmt of statements) {
      await tPool.query(stmt, stmt.includes('INSERT IGNORE INTO configuracion') ? [business_name] : []);
    }
    tPool.end(); // close pool after setup

    const [result] = await masterPool.query(
      'INSERT INTO tenants (business_name, username, password, db_name, email, phone, start_date, end_date, observations, modules, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [business_name, username, password, db_name, email, phone, start_date||null, end_date||null, observations||'', JSON.stringify(modules||{}), is_active]
    );

    res.json({ success: true, id: result.insertId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/saas/tenants/:id', saasAdminAuth, async (req, res) => {
  try {
    const { business_name, username, password, email, phone, start_date, end_date, observations, modules, is_active } = req.body;
    await masterPool.query(
      'UPDATE tenants SET business_name=?, username=?, password=?, email=?, phone=?, start_date=?, end_date=?, observations=?, modules=?, is_active=? WHERE id=?',
      [business_name, username, password, email, phone, start_date||null, end_date||null, observations||'', JSON.stringify(modules||{}), is_active, req.params.id]
    );
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/saas/tenants/:id', saasAdminAuth, async (req, res) => {
  try {
    // Optionally delete the database? Better not to delete data, just deactivate. But if requested...
    await masterPool.query('DELETE FROM tenants WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

`;

// Insert the adminAPI right before "const PORT"
code = code.replace('const PORT = process.env.PORT', adminAPI + '\nconst PORT = process.env.PORT');

fs.writeFileSync(file, code);
console.log('API Admin SaaS inyectada correctamente.');
