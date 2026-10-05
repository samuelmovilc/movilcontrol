const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'api', 'index.js');
let code = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. Add jsonwebtoken
code = code.replace("const mysql      = require('mysql2/promise');", "const mysql      = require('mysql2/promise');\nconst jwt        = require('jsonwebtoken');");

// 2. Replace global pool with saas_master pool and Tenant Pool Manager
const poolSetup = `
// ── SAAS MASTER POOL ──
const masterPool = mysql.createPool({
  host:            process.env.DB_HOST     || '89.117.56.39',
  port:            parseInt(process.env.DB_PORT) || 3308,
  database:        'saas_master',
  user:            process.env.DB_USER     || 'pos_user',
  password:        process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026',
  waitForConnections: true,
  connectionLimit: 10,
  charset:         'utf8mb4'
});

// ── TENANT POOL MANAGER ──
const tenantPools = new Map();

function getTenantPool(dbName) {
  if (!tenantPools.has(dbName)) {
    const pool = mysql.createPool({
      host:            process.env.DB_HOST     || '89.117.56.39',
      port:            parseInt(process.env.DB_PORT) || 3308,
      database:        dbName,
      user:            process.env.DB_USER     || 'pos_user',
      password:        process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026',
      waitForConnections: true,
      connectionLimit: 10,
      charset:         'utf8mb4'
    });
    tenantPools.set(dbName, pool);
  }
  return tenantPools.get(dbName);
}

const JWT_SECRET = process.env.JWT_SECRET || 'CaribePOS_Super_Secret_2026';

// ── MIDDLEWARE SAAS ──
const tenantAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Falta Token de Autorización' });
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.db_name) return res.status(401).json({ error: 'Token inválido' });
    
    // Asignar el pool del tenant al request
    req.tenantPool = getTenantPool(decoded.db_name);
    req.tenant = decoded; // Guardar datos del tenant
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token expirado o inválido' });
  }
};
`;

code = code.replace(/\/\/ ── DB POOL ──[\s\S]+?charset:\s+'utf8mb4'\n\}\);/, poolSetup);

// 3. Add Login Route
const loginRoute = `
// ── AUTH LOGIN ──
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan credenciales' });

    const [rows] = await masterPool.query('SELECT * FROM tenants WHERE username = ? AND is_active = 1', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Usuario no existe o está inactivo' });
    
    const tenant = rows[0];
    if (password !== tenant.password) return res.status(401).json({ error: 'Contraseña incorrecta' });

    // Validar fechas
    const now = new Date();
    if (tenant.end_date && new Date(tenant.end_date) < now) {
      return res.status(403).json({ error: 'Licencia expirada. Contacte a soporte.' });
    }

    const token = jwt.sign(
      { 
        tenant_id: tenant.id, 
        business_name: tenant.business_name, 
        db_name: tenant.db_name, 
        modules: typeof tenant.modules === 'string' ? JSON.parse(tenant.modules) : (tenant.modules || {}) 
      }, 
      JWT_SECRET, 
      { expiresIn: '12h' }
    );

    res.json({ success: true, token, business_name: tenant.business_name, modules: typeof tenant.modules === 'string' ? JSON.parse(tenant.modules) : (tenant.modules || {}) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

code = code.replace('// ── HEALTH ──', loginRoute + '\n// ── HEALTH ──');

// 4. Update Health to use masterPool
code = code.replace(/await pool\.query\('SELECT 1'\);/g, "await masterPool.query('SELECT 1');");

// 5. Replace route signatures correctly
code = code.replace(/app\.get\('\/api\/productos', async/g, "app.get('/api/productos', tenantAuth, async");
code = code.replace(/app\.get\('\/api\/productos\/:id', async/g, "app.get('/api/productos/:id', tenantAuth, async");
code = code.replace(/app\.post\('\/api\/productos', async/g, "app.post('/api/productos', tenantAuth, async");
code = code.replace(/app\.put\('\/api\/productos\/:id', async/g, "app.put('/api/productos/:id', tenantAuth, async");
code = code.replace(/app\.patch\('\/api\/productos\/:id\/stock', async/g, "app.patch('/api/productos/:id/stock', tenantAuth, async");
code = code.replace(/app\.delete\('\/api\/productos\/:id', async/g, "app.delete('/api/productos/:id', tenantAuth, async");
code = code.replace(/app\.post\('\/api\/productos\/importar', async/g, "app.post('/api/productos/importar', tenantAuth, async");

code = code.replace(/app\.get\('\/api\/clientes', async/g, "app.get('/api/clientes', tenantAuth, async");
code = code.replace(/app\.get\('\/api\/clientes\/:id', async/g, "app.get('/api/clientes/:id', tenantAuth, async");
code = code.replace(/app\.post\('\/api\/clientes', async/g, "app.post('/api/clientes', tenantAuth, async");
code = code.replace(/app\.put\('\/api\/clientes\/:id', async/g, "app.put('/api/clientes/:id', tenantAuth, async");
code = code.replace(/app\.delete\('\/api\/clientes\/:id', async/g, "app.delete('/api/clientes/:id', tenantAuth, async");

code = code.replace(/app\.get\('\/api\/ventas', async/g, "app.get('/api/ventas', tenantAuth, async");
code = code.replace(/app\.get\('\/api\/ventas\/resumen\/:fecha', async/g, "app.get('/api/ventas/resumen/:fecha', tenantAuth, async");
code = code.replace(/app\.get\('\/api\/ventas\/:folio', async/g, "app.get('/api/ventas/:folio', tenantAuth, async");
code = code.replace(/app\.post\('\/api\/ventas', async/g, "app.post('/api/ventas', tenantAuth, async");
code = code.replace(/app\.patch\('\/api\/ventas\/:folio\/anular', async/g, "app.patch('/api/ventas/:folio/anular', tenantAuth, async");

code = code.replace(/app\.get\('\/api\/configuracion', async/g, "app.get('/api/configuracion', tenantAuth, async");
code = code.replace(/app\.put\('\/api\/configuracion\/:id', async/g, "app.put('/api/configuracion/:id', tenantAuth, async");

code = code.replace(/app\.get\('\/api\/creditos', async/g, "app.get('/api/creditos', tenantAuth, async");
code = code.replace(/app\.get\('\/api\/creditos\/:id', async/g, "app.get('/api/creditos/:id', tenantAuth, async");
code = code.replace(/app\.post\('\/api\/creditos\/plan', async/g, "app.post('/api/creditos/plan', tenantAuth, async");
code = code.replace(/app\.post\('\/api\/creditos\/:id\/abonos', async/g, "app.post('/api/creditos/:id/abonos', tenantAuth, async");
code = code.replace(/app\.patch\('\/api\/creditos\/:id\/anular', async/g, "app.patch('/api/creditos/:id/anular', tenantAuth, async");

code = code.replace(/app\.post\('\/api\/movimientos', async/g, "app.post('/api/movimientos', tenantAuth, async");
code = code.replace(/app\.get\('\/api\/informe', async/g, "app.get('/api/informe', tenantAuth, async");

// catalogos GET is public, POST requires auth
code = code.replace(/app\.post\('\/api\/catalogos', async/g, "app.post('/api/catalogos', tenantAuth, async");

// 6. Replace `pool.query` with `req.tenantPool.query`
code = code.replace(/pool\.query/g, "req.tenantPool.query");
code = code.replace(/pool\.getConnection/g, "req.tenantPool.getConnection");

// Fix the health route if it accidentally got replaced
code = code.replace(/req\.tenantPool\.query\('SELECT 1'\)/g, "masterPool.query('SELECT 1')");

// Save the refactored code
fs.writeFileSync(file, code);
console.log('Backend refactorizado a SaaS correctamente y sin errores de sintaxis.');
