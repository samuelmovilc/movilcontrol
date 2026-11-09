// Crea un tenant NUEVO (base de datos limpia) para el cliente de sastrería,
// replicando EXACTAMENTE lo que hace POST /api/saas/tenants en producción
// (backend/api/index.js), para no depender del panel saas_admin.html ni de
// Vercel: esto se corre directo contra el servidor MySQL de Contabo.
//
// Como la base de datos se crea desde cero, el esquema ya incluye las
// tablas de "Órdenes de Servicio" (tecnicos, ordenes_servicio, orden_prendas)
// tal como quedaron definidas en el código — CERO riesgo de chocar con
// tablas viejas de otro tenant, porque esta base no existe todavía.
//
// ════════════════════════════════════════════════════════════════
// 1) EDITA ESTOS 3 DATOS ANTES DE CORRER EL SCRIPT:
// ════════════════════════════════════════════════════════════════
const BUSINESS_NAME = 'NOMBRE_DEL_NEGOCIO_AQUI';   // Ej: 'Sastrería Elegance'
const USERNAME       = 'usuario_aqui';              // Ej: 'sastreria' (solo minúsculas/números/_)
const PASSWORD       = 'clave_aqui';                // La que le vas a entregar al cliente
// Opcionales (puedes dejarlos así si no aplican):
const EMAIL          = '';
const TELEFONO       = '';
// ════════════════════════════════════════════════════════════════

const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || '89.117.56.39';
const DB_PORT = parseInt(process.env.DB_PORT) || 3308;
const DB_USER = process.env.DB_USER || 'pos_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026';

const DB_NAME = 'tenancy_' + USERNAME.toLowerCase().replace(/[^a-z0-9_]/g, '');

// Módulos habilitados para este tenant: todos los básicos + Órdenes de
// Servicio activado desde ya (a diferencia de los tenants viejos, donde
// queda apagado por defecto).
const MODULES = {
  pos: true,
  productos: true,
  clientes: true,
  cartera: true,
  finanzas: true,
  config: true,
  ordenes: true
};

// Mismo schemaSQL EXACTO que usa backend/api/index.js en POST /api/saas/tenants
// (copiado tal cual, no reescrito, para garantizar que el resultado sea
// idéntico al que produce la app en producción).
const schemaSQL = `
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
    orden_servicio_id INT NULL,
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
    tecnico_id VARCHAR(50) NULL,
    orden_servicio_id INT NULL,
    fecha DATE NULL,
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
    orden_servicio_id INT NULL,
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
  CREATE TABLE IF NOT EXISTS tecnicos (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(50),
    comision_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS ordenes_servicio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(50) NOT NULL UNIQUE,
    cliente_id VARCHAR(50) NOT NULL,
    cliente VARCHAR(150),
    fecha_recibido DATE NOT NULL,
    fecha_entrega_estimada DATE NULL,
    fecha_entregado DATETIME NULL,
    observaciones TEXT,
    estado ENUM('cotizacion','terminada','anulada') NOT NULL DEFAULT 'cotizacion',
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    venta_id INT NULL,
    credito_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orden_prendas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orden_id INT NOT NULL,
    tipo_prenda VARCHAR(100) NOT NULL,
    tipo_trabajo ENUM('reparacion','diseno','otro') NOT NULL DEFAULT 'reparacion',
    descripcion TEXT,
    observaciones TEXT,
    precio DECIMAL(10,2) NOT NULL DEFAULT 0,
    tecnico_id VARCHAR(50) NULL,
    comision_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
    comision_monto DECIMAL(10,2) NOT NULL DEFAULT 0,
    estado ENUM('en_taller','lista','entregada') NOT NULL DEFAULT 'en_taller',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orden_id) REFERENCES ordenes_servicio(id) ON DELETE CASCADE
  );
  INSERT IGNORE INTO configuracion (id, nombre_negocio, metodos_pago) VALUES (1, ?, '["Efectivo","Tarjeta débito","Tarjeta crédito","Transferencia","CREDITO","Otro"]');
  INSERT IGNORE INTO clientes (id, nombre) VALUES ('222222', 'CLIENTE POS');
`;

async function run() {
  if (BUSINESS_NAME === 'NOMBRE_DEL_NEGOCIO_AQUI' || USERNAME === 'usuario_aqui' || PASSWORD === 'clave_aqui') {
    console.error('✋ Primero edita BUSINESS_NAME, USERNAME y PASSWORD al inicio del archivo, luego vuelve a correrlo.');
    process.exit(1);
  }

  const masterPool = mysql.createPool({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD,
    database: 'saas_master', waitForConnections: true, connectionLimit: 3
  });

  try {
    // Evitar duplicados si se corre dos veces por error.
    const [existentes] = await masterPool.query('SELECT id FROM tenants WHERE db_name=? OR username=?', [DB_NAME, USERNAME]);
    if (existentes.length) {
      console.error(`✋ Ya existe un tenant con db_name="${DB_NAME}" o username="${USERNAME}" (id=${existentes[0].id}). No se creó nada para evitar duplicar. Si quieres recrearlo, bórralo primero desde el panel SaaS admin.`);
      process.exit(1);
    }

    console.log(`→ Creando base de datos "${DB_NAME}"...`);
    await masterPool.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME};`);
    await masterPool.query(`GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'%';`);
    await masterPool.query('FLUSH PRIVILEGES;');

    console.log('→ Creando tablas (incluye Órdenes de Servicio desde el inicio)...');
    const tPool = mysql.createPool({
      host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USER, password: DB_PASSWORD,
      waitForConnections: true, connectionLimit: 5
    });
    const statements = schemaSQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await tPool.query(stmt, stmt.includes('INSERT IGNORE INTO configuracion') ? [BUSINESS_NAME] : []);
    }
    await tPool.end();

    console.log('→ Registrando el tenant en saas_master.tenants...');
    const [result] = await masterPool.query(
      'INSERT INTO tenants (business_name, username, password, db_name, email, phone, start_date, end_date, observations, modules, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [BUSINESS_NAME, USERNAME, PASSWORD, DB_NAME, EMAIL, TELEFONO, new Date().toISOString().slice(0,10), null, 'Creado por script crear_tenant_sastreria.js', JSON.stringify(MODULES), 1]
    );

    console.log('\n✅ Tenant creado con éxito.');
    console.log('   ID interno:        ' + result.insertId);
    console.log('   Negocio:           ' + BUSINESS_NAME);
    console.log('   Base de datos:     ' + DB_NAME);
    console.log('   Usuario de login:  ' + USERNAME);
    console.log('   Contraseña:        ' + PASSWORD);
    console.log('   Módulos activos:   ' + Object.keys(MODULES).filter(k => MODULES[k]).join(', '));
    console.log('\nYa puede iniciar sesión en la app con ese usuario y contraseña, y va a ver la pestaña "Órdenes" y "Egresos" activas desde el primer login.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error: ' + e.message);
    process.exit(1);
  }
}

run();
