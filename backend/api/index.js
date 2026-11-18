require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const mysql      = require('mysql2/promise');
const jwt        = require('jsonwebtoken');

const app = express();


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

// Exige que, si quien hace la petición es el usuario "vendedor" (no el dueño del
// negocio), tenga habilitado al menos uno de los módulos indicados. El dueño
// (cualquier token sin role==='vendedor', incluidos los tokens viejos emitidos
// antes de que existiera este sistema) siempre pasa sin restricción.
function requireModulo() {
  const modulos = Array.prototype.slice.call(arguments);
  return (req, res, next) => {
    if (req.tenant && req.tenant.role === 'vendedor') {
      const permitidos = req.tenant.vendedor_modulos || [];
      const tienePermiso = modulos.some(m => permitidos.indexOf(m) !== -1);
      if (!tienePermiso) return res.status(403).json({ error: 'No tienes permiso para acceder a este módulo' });
    }
    next();
  };
}

// Exige que quien hace la petición sea el dueño del negocio, nunca el vendedor
// (se usa para la gestión del propio usuario vendedor: un vendedor jamás debe
// poder cambiar sus propios permisos aunque tenga el módulo Config habilitado).
function requireOwner(req, res, next) {
  if (req.tenant && req.tenant.role === 'vendedor') {
    return res.status(403).json({ error: 'Solo el dueño del negocio puede hacer esto' });
  }
  next();
}


// ── MIDDLEWARE ──
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-api-key']
}));
app.use(rateLimit({ windowMs: 60*1000, max: 300 }));


// ── AUTH LOGIN ──
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan credenciales' });

    const NOT_FOUND_MSG = 'Hola Empresario Exitoso. Contáctame para Verificar Tu Base de Datos. Att: Samuel M, Asesor De Confianza MovilControl. +573195122754 este es el número para que me contacten por WhatsApp.';

    const [rows] = await masterPool.query('SELECT * FROM tenants WHERE username = ? AND is_active = 1', [username]);
    let tenant, role;

    if (rows.length > 0) {
      // Login del dueño del negocio
      tenant = rows[0];
      if (password !== tenant.password) return res.status(401).json({ error: 'Contraseña incorrecta' });
      role = 'owner';
    } else {
      // ¿Es el usuario vendedor de algún tenant?
      const [vrows] = await masterPool.query('SELECT * FROM tenants WHERE vendedor_username = ? AND vendedor_activo = 1 AND is_active = 1', [username]);
      if (vrows.length === 0) return res.status(401).json({ error: NOT_FOUND_MSG });
      tenant = vrows[0];
      if (password !== tenant.vendedor_password) return res.status(401).json({ error: 'Contraseña incorrecta' });
      role = 'vendedor';
    }

    // Validar fechas (la licencia es del negocio, aplica igual al dueño y al vendedor)
    const now = new Date();
    if (tenant.end_date && new Date(tenant.end_date) < now) {
      return res.status(403).json({ error: 'Licencia expirada. Contacte a soporte.' });
    }

    const tenantModules = typeof tenant.modules === 'string' ? JSON.parse(tenant.modules) : (tenant.modules || {});
    const vendedorModulos = role === 'vendedor'
      ? (typeof tenant.vendedor_modulos === 'string' ? JSON.parse(tenant.vendedor_modulos || '[]') : (tenant.vendedor_modulos || []))
      : [];

    const token = jwt.sign(
      {
        tenant_id: tenant.id,
        business_name: tenant.business_name,
        db_name: tenant.db_name,
        modules: tenantModules,
        role: role,
        vendedor_modulos: vendedorModulos
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      token,
      business_name: tenant.business_name,
      modules: tenantModules,
      role: role,
      vendedor_modulos: vendedorModulos,
      vendedor_nombre: role === 'vendedor' ? tenant.vendedor_nombre : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── HEALTH ──
app.get('/api/health', async (req, res) => {
  try {
    await masterPool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date() });
  } catch(e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

// ════════════════════════════════
// PRODUCTOS
// ════════════════════════════════

// GET todos
app.get('/api/productos', tenantAuth, requireModulo('pos','productos'), async (req, res) => {
  try {
    const { nombre, codigo, categoria, stock_max, precio_min, precio_max, orden } = req.query;
    let sql = 'SELECT * FROM productos WHERE 1=1';
    const params = [];
    if (nombre)     { sql += ' AND nombre LIKE ?';        params.push('%'+nombre+'%'); }
    if (codigo)     { sql += ' AND id LIKE ?';            params.push('%'+codigo+'%'); }
    if (categoria)  { sql += ' AND categoria = ?';        params.push(categoria); }
    if (stock_max)  { sql += ' AND stock <= ?';           params.push(parseInt(stock_max)); }
    if (precio_min) { sql += ' AND precio_venta >= ?';    params.push(parseFloat(precio_min)); }
    if (precio_max) { sql += ' AND precio_venta <= ?';    params.push(parseFloat(precio_max)); }
    if (orden === 'salidas')     sql += ' ORDER BY salidas DESC';
    else if (orden === 'stock')  sql += ' ORDER BY stock DESC';
    else                         sql += ' ORDER BY nombre ASC';
    const [rows] = await req.tenantPool.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET uno
app.get('/api/productos/:id', tenantAuth, requireModulo('pos','productos'), async (req, res) => {
  try {
    const [rows] = await req.tenantPool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST crear
app.post('/api/productos', tenantAuth, requireModulo('productos'), async (req, res) => {
  try {
    const { id, nombre, categoria, precio_venta, precio_compra, stock, imagen } = req.body;
    if (!id || !nombre || precio_venta == null || stock == null)
      return res.status(400).json({ error: 'Faltan campos' });
    await req.tenantPool.query(
      'INSERT INTO productos (id,nombre,categoria,precio_venta,precio_compra,stock,entradas,salidas,imagen) VALUES (?,?,?,?,?,?,?,0,?)',
      [id, nombre, categoria || null, precio_venta, precio_compra, stock, stock, imagen || null]
    );
    const [rows] = await req.tenantPool.query('SELECT * FROM productos WHERE id=?', [id]);
    res.status(201).json(rows[0]);
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Código ya existe' });
    res.status(500).json({ error: e.message });
  }
});

// PUT actualizar
app.put('/api/productos/:id', tenantAuth, requireModulo('productos'), async (req, res) => {
  try {
    const { nombre, categoria, precio_venta, precio_compra, stock, imagen } = req.body;
    const [old] = await req.tenantPool.query('SELECT stock, entradas FROM productos WHERE id=?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'No encontrado' });
    const diffE = stock > old[0].stock ? stock - old[0].stock : 0;
    await req.tenantPool.query(
      'UPDATE productos SET nombre=?, categoria=?, precio_venta=?, precio_compra=?, stock=?, entradas=entradas+?, imagen=? WHERE id=?',
      [nombre, categoria || null, precio_venta, precio_compra, stock, diffE, imagen !== undefined ? imagen : null, req.params.id]
    );
    const [rows] = await req.tenantPool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH solo stock
app.patch('/api/productos/:id/stock', tenantAuth, requireModulo('productos'), async (req, res) => {
  try {
    const { stock } = req.body;
    const [old] = await req.tenantPool.query('SELECT stock FROM productos WHERE id=?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'No encontrado' });
    const diffE = stock > old[0].stock ? stock - old[0].stock : 0;
    await req.tenantPool.query(
      'UPDATE productos SET stock=?, entradas=entradas+? WHERE id=?',
      [stock, diffE, req.params.id]
    );
    const [rows] = await req.tenantPool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE eliminar (solo sin ventas)
app.delete('/api/productos/:id', tenantAuth, requireModulo('productos'), async (req, res) => {
  try {
    const [check] = await req.tenantPool.query('SELECT COUNT(*) as cnt FROM venta_productos WHERE producto_id=?', [req.params.id]);
    if (check[0].cnt > 0) return res.status(409).json({ error: 'Tiene ventas asociadas' });
    await req.tenantPool.query('DELETE FROM productos WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST importar masivo
app.post('/api/productos/importar', tenantAuth, requireModulo('productos'), async (req, res) => {
  try {
    const { productos } = req.body;
    if (!Array.isArray(productos)) return res.status(400).json({ error: 'Array requerido' });
    let added=0, updated=0, errors=0;
    for (const p of productos) {
      const { id, nombre, categoria, precio_venta, precio_compra, stock, imagen } = p;
      if (!id || !nombre) { errors++; continue; }
      const [old] = await req.tenantPool.query('SELECT stock,entradas,imagen FROM productos WHERE id=?', [id]);
      if (old.length) {
        const dE = stock > old[0].stock ? stock - old[0].stock : 0;
        await req.tenantPool.query(
          'UPDATE productos SET nombre=?,categoria=?,precio_venta=?,precio_compra=?,stock=?,entradas=entradas+?,imagen=? WHERE id=?',
          [nombre, categoria || null, precio_venta, precio_compra, stock, dE, imagen !== undefined ? imagen : old[0].imagen, id]
        );
        updated++;
      } else {
        await req.tenantPool.query(
          'INSERT INTO productos (id,nombre,categoria,precio_venta,precio_compra,stock,entradas,salidas,imagen) VALUES (?,?,?,?,?,?,?,0,?)',
          [id, nombre, categoria || null, precio_venta, precio_compra, stock, stock, imagen || null]
        );
        added++;
      }
    }
    res.json({ added, updated, errors });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════
// CLIENTES
// ════════════════════════════════

// GET todos
app.get('/api/clientes', tenantAuth, async (req, res) => {
  try {
    const { busqueda } = req.query;
    let sql = 'SELECT * FROM clientes WHERE 1=1';
    const params = [];
    if (busqueda) { 
      sql += ' AND (id LIKE ? OR nombre LIKE ?)'; 
      params.push('%'+busqueda+'%', '%'+busqueda+'%'); 
    }
    sql += ' ORDER BY nombre ASC';
    const [rows] = await req.tenantPool.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET uno
app.get('/api/clientes/:id', tenantAuth, async (req, res) => {
  try {
    const [rows] = await req.tenantPool.query('SELECT * FROM clientes WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST crear
app.post('/api/clientes', tenantAuth, async (req, res) => {
  try {
    const { id, nombre, telefono, direccion } = req.body;
    if (!id || !nombre) return res.status(400).json({ error: 'Faltan campos' });
    await req.tenantPool.query(
      'INSERT INTO clientes (id, nombre, telefono, direccion) VALUES (?, ?, ?, ?)',
      [id, nombre, telefono || null, direccion || null]
    );
    const [rows] = await req.tenantPool.query('SELECT * FROM clientes WHERE id=?', [id]);
    res.status(201).json(rows[0]);
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El ID o Cédula ya existe' });
    res.status(500).json({ error: e.message });
  }
});

// PUT actualizar
app.put('/api/clientes/:id', tenantAuth, async (req, res) => {
  try {
    const { nombre, telefono, direccion } = req.body;
    const [old] = await req.tenantPool.query('SELECT id FROM clientes WHERE id=?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'No encontrado' });
    await req.tenantPool.query(
      'UPDATE clientes SET nombre=?, telefono=?, direccion=? WHERE id=?',
      [nombre, telefono || null, direccion || null, req.params.id]
    );
    const [rows] = await req.tenantPool.query('SELECT * FROM clientes WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE eliminar
app.delete('/api/clientes/:id', tenantAuth, async (req, res) => {
  try {
    const [check] = await req.tenantPool.query('SELECT COUNT(*) as cnt FROM ventas WHERE cliente_id=?', [req.params.id]);
    if (check[0].cnt > 0) return res.status(409).json({ error: 'El cliente tiene ventas asociadas y no puede ser eliminado' });
    
    // Si queremos ser muy cuidadosos, también revisamos la tabla de creditos
    const [checkCreditos] = await req.tenantPool.query('SELECT COUNT(*) as cnt FROM creditos WHERE cliente_id=?', [req.params.id]);
    if (checkCreditos[0].cnt > 0) return res.status(409).json({ error: 'El cliente tiene créditos asociados' });
    
    // No permitir borrar el cliente por defecto
    if (req.params.id === '222222') return res.status(403).json({ error: 'No se puede eliminar el cliente POS por defecto' });

    await req.tenantPool.query('DELETE FROM clientes WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════
// VENTAS
// ════════════════════════════════

// GET ventas por fecha/estado
app.get('/api/ventas', tenantAuth, requireModulo('pos','caja'), async (req, res) => {
  try {
    const { fecha, estado } = req.query;
    let sql = 'SELECT * FROM ventas WHERE 1=1';
    const params = [];
    if (fecha)  { sql += ' AND fecha=?';  params.push(fecha); }
    if (estado) { sql += ' AND estado=?'; params.push(estado); }
    sql += ' ORDER BY created_at DESC';
    const [ventas] = await req.tenantPool.query(sql, params);
    // cargar productos de cada venta
    for (const v of ventas) {
      const [prods] = await req.tenantPool.query('SELECT * FROM venta_productos WHERE venta_id=?', [v.id]);
      v.productos = prods;
      v.metodos_pago = typeof v.metodos_pago === 'string' ? JSON.parse(v.metodos_pago||'[]') : (v.metodos_pago||[]);
    }
    res.json(ventas);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET resumen del día
app.get('/api/ventas/resumen/:fecha', tenantAuth, requireModulo('pos','caja'), async (req, res) => {
  try {
    const [ventas] = await req.tenantPool.query(
      'SELECT v.*, vp.precio_unitario, vp.cantidad, vp.subtotal, vp.producto_id FROM ventas v LEFT JOIN venta_productos vp ON v.id=vp.venta_id WHERE v.fecha=? AND v.estado="aceptada"',
      [req.params.fecha]
    );
    const totalVendido = [...new Set(ventas.map(v=>v.id))].reduce((s,id) => {
      const v = ventas.find(x=>x.id===id); return s + parseFloat(v.total||0);
    }, 0);
    // por método
    const byMethod = {};
    const seen = new Set();
    for (const v of ventas) {
      if (seen.has(v.id)) continue; seen.add(v.id);
      const mp = typeof v.metodos_pago === 'string' ? JSON.parse(v.metodos_pago||'[]') : (v.metodos_pago||[]);
      mp.forEach(r => { byMethod[r.metodo] = (byMethod[r.metodo]||0) + parseFloat(r.monto||0); });
    }
    // utilidad
    const prodIds = [...new Set(ventas.map(v=>v.producto_id).filter(Boolean))];
    let costoMap = {};
    if (prodIds.length) {
      const [prods] = await req.tenantPool.query('SELECT id, precio_compra FROM productos WHERE id IN (?)', [prodIds]);
      prods.forEach(p => { costoMap[p.id] = parseFloat(p.precio_compra); });
    }
    let utilidad = 0;
    ventas.forEach(v => { utilidad += (parseFloat(v.precio_unitario||0) - (costoMap[v.producto_id]||0)) * parseInt(v.cantidad||0); });
    res.json({ totalVendido, utilidad, pct: totalVendido>0?(utilidad/totalVendido*100):0, byMethod, cantVentas: seen.size });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET venta por folio
app.get('/api/ventas/:folio', tenantAuth, requireModulo('pos','caja'), async (req, res) => {
  try {
    const [ventas] = await req.tenantPool.query('SELECT * FROM ventas WHERE folio=?', [req.params.folio]);
    if (!ventas.length) return res.status(404).json({ error: 'No encontrado' });
    const venta = ventas[0];
    const [prods] = await req.tenantPool.query('SELECT * FROM venta_productos WHERE venta_id=?', [venta.id]);
    venta.productos = prods;
    venta.metodos_pago = typeof venta.metodos_pago === 'string' ? JSON.parse(venta.metodos_pago||'[]') : (venta.metodos_pago||[]);
    res.json(venta);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST crear venta
app.post('/api/ventas', tenantAuth, requireModulo('pos'), async (req, res) => {
  const conn = await req.tenantPool.getConnection();
  try {
    await conn.beginTransaction();
    const { folio, fecha, hora, cliente, observaciones, metodo_pago, metodos_pago, total, cambio, productos, tecnico_id } = req.body;
    if (!folio||!fecha||!hora||!total||!productos?.length) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const clienteStr = cliente || '222222 - CLIENTE POS';
    let clienteId = clienteStr.split(' - ')[0].trim();
    if (!clienteId) clienteId = '222222';

    // metodo_pago es VARCHAR(50) en la BD: lo recortamos por seguridad aunque el
    // frontend ya debería mandar algo corto (nombres de método, sin montos).
    const metodoPagoSafe = (metodo_pago || '').toString().substring(0, 50);

    const isCredito = (metodo_pago && (metodo_pago.toLowerCase().includes('crédito') || metodo_pago.toLowerCase().includes('credito')))
      || (metodos_pago && metodos_pago.some(m => { const l = String(m.metodo).toLowerCase(); return l.includes('crédito') || l.includes('credito'); }));
    const estadoPago = isCredito ? 'credito' : 'contado';

    // Si la venta viene de un plan de crédito pre-aprobado (Cartera -> Cargar Cotización),
    // el cliente de la venta DEBE ser el mismo del plan. Sin esta validación, si en el
    // POS se cambia el cliente seleccionado después de cargar la cotización, la venta
    // queda a nombre de un cliente mientras las cuotas/abonos del crédito siguen bajo
    // el cliente original del plan — un descuadre de cartera.
    if (isCredito && req.body.credito_plan_id) {
      const [[planCheck]] = await conn.query('SELECT cliente_id, estado FROM creditos WHERE id=?', [req.body.credito_plan_id]);
      if (!planCheck) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ error: 'El plan de crédito indicado no existe' });
      }
      if (planCheck.cliente_id !== clienteId) {
        await conn.rollback(); conn.release();
        return res.status(409).json({ error: 'El cliente seleccionado (' + clienteId + ') no coincide con el cliente del plan de crédito (' + planCheck.cliente_id + ')' });
      }
      if (planCheck.estado !== 'aprobado') {
        await conn.rollback(); conn.release();
        return res.status(409).json({ error: 'Ese plan de crédito ya no está en estado aprobado (está ' + planCheck.estado + ')' });
      }
    }

    // Insertar venta
    // tecnico_id es exclusivo del módulo Peluquería (quién atendió la venta); opcional,
    // NULL si no se manda (tiendas y demás negocios que no usan esto no se ven afectados).
    const [result] = await conn.query(
      'INSERT INTO ventas (folio,fecha,hora,cliente,cliente_id,observaciones,metodo_pago,metodos_pago,total,cambio,estado,estado_pago,tecnico_id) VALUES (?,?,?,?,?,?,?,?,?,?,"aceptada",?,?)',
      [folio, fecha, hora, clienteStr, clienteId, observaciones||'', metodoPagoSafe, JSON.stringify(metodos_pago||[]), total, cambio||0, estadoPago, tecnico_id || null]
    );
    const ventaId = result.insertId;
    // Insertar detalle + descontar stock
    for (const p of productos) {
      await conn.query(
        'INSERT INTO venta_productos (venta_id,producto_id,nombre,cantidad,precio_unitario,subtotal) VALUES (?,?,?,?,?,?)',
        [ventaId, p.codigo, p.nombre, p.cantidad, p.precioUnitario, p.subtotal]
      );
      await conn.query(
        'UPDATE productos SET stock=GREATEST(0,stock-?), salidas=salidas+? WHERE id=?',
        [p.cantidad, p.cantidad, p.codigo]
      );
    }

    // Si es crédito y mandan un plan pre-aprobado (desde Cartera)
    if (isCredito && req.body.credito_plan_id) {
      const planId = req.body.credito_plan_id;
      
      // Actualizar el plan con la venta y pasarlo a activo
      await conn.query('UPDATE creditos SET venta_id=?, estado="activo", fecha_inicio=?, total_credito=? WHERE id=?', 
        [ventaId, fecha, total, planId]);
      
      await conn.query('UPDATE ventas SET credito_id=? WHERE id=?', [planId, ventaId]);

      // Recuperar los datos del plan para generar las cuotas
      const [planes] = await conn.query('SELECT * FROM creditos WHERE id=?', [planId]);
      if (planes.length > 0) {
        const plan = planes[0];
        
        // Generar cuotas dinámicamente según num_cuotas y frecuencia
        let cuotas = [];
        let num_cuotas = parseInt(plan.num_cuotas) || 1;
        let valor_cuota = (parseFloat(plan.total_credito) - parseFloat(plan.inicial || 0)) / num_cuotas;
        
        for (let i = 1; i <= num_cuotas; i++) {
           let d = new Date(fecha);
           if (plan.frecuencia === 'mensual') d.setMonth(d.getMonth() + i);
           else if (plan.frecuencia === 'quincenal') d.setDate(d.getDate() + (i * 15));
           else d.setDate(d.getDate() + (i * 7)); // semanal
           
           await conn.query('INSERT INTO credito_cuotas (credito_id, numero_cuota, fecha_vence, valor, pagado) VALUES (?,?,?,?,0)', 
             [planId, i, d.toISOString().split('T')[0], valor_cuota]);
        }
        
        if (parseFloat(plan.inicial) > 0) {
          // El abono inicial puede haberse pagado en el método que el usuario eligió en el
          // POS (Efectivo, Transferencia, Tarjeta...), e incluso dividido entre varios si se
          // agregaron filas de pago adicionales. Se registra un movimiento por cada método
          // de pago distinto de "Crédito" que venga en la venta, en vez de asumir Efectivo.
          const metodosIniciales = (metodos_pago || []).filter(function(m) {
            const metodoLower = String(m.metodo || '').toLowerCase();
            return !metodoLower.includes('crédito') && !metodoLower.includes('credito') && parseFloat(m.monto) > 0;
          });
          if (metodosIniciales.length) {
            for (const m of metodosIniciales) {
              await conn.query('INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, credito_id) VALUES ("ingreso", "Abono Inicial", ?, ?, ?, ?, ?)',
                [parseFloat(m.monto), m.metodo || 'Efectivo', 'Abono inicial venta ' + folio, clienteId, planId]);
            }
          } else {
            // Respaldo: si no vino el detalle de métodos, se registra igual para no perder
            // el abono de la cartera, asumiendo Efectivo como antes.
            await conn.query('INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, credito_id) VALUES ("ingreso", "Abono Inicial", ?, ?, ?, ?, ?)',
              [plan.inicial, 'Efectivo', 'Abono inicial venta ' + folio, clienteId, planId]);
          }
        }
      }
    }

    await conn.commit(); conn.release();
    const [rows] = await req.tenantPool.query('SELECT * FROM ventas WHERE id=?', [ventaId]);
    res.status(201).json(rows[0]);
  } catch(e) {
    await conn.rollback(); conn.release();
    if (e.code==='ER_DUP_ENTRY') return res.status(409).json({ error: 'Folio duplicado' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH anular venta
app.patch('/api/ventas/:folio/anular', tenantAuth, requireModulo('pos','caja'), async (req, res) => {
  const conn = await req.tenantPool.getConnection();
  try {
    await conn.beginTransaction();
    const [ventas] = await conn.query('SELECT * FROM ventas WHERE folio=?', [req.params.folio]);
    if (!ventas.length) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'No encontrada' }); }
    const venta = ventas[0];
    if (venta.estado==='anulada') { await conn.rollback(); conn.release(); return res.status(409).json({ error: 'Ya anulada' }); }
    // Restituir stock
    const [prods] = await conn.query('SELECT * FROM venta_productos WHERE venta_id=?', [venta.id]);
    for (const p of prods) {
      await conn.query(
        'UPDATE productos SET stock=stock+?, salidas=GREATEST(0,salidas-?) WHERE id=?',
        [p.cantidad, p.cantidad, p.producto_id]
      );
    }
    await conn.query('UPDATE ventas SET estado="anulada" WHERE folio=?', [req.params.folio]);
    await conn.commit(); conn.release();
    res.json({ ok: true, folio: req.params.folio, estado: 'anulada' });
  } catch(e) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════
// CONFIGURACION
// ════════════════════════════════

app.get('/api/configuracion', tenantAuth, async (req, res) => {
  try {
    const [rows] = await req.tenantPool.query('SELECT * FROM configuracion LIMIT 1');
    if (!rows.length) return res.status(404).json({ error: 'Sin configuración' });
    const cfg = rows[0];
    cfg.metodos_pago = typeof cfg.metodos_pago === 'string' ? JSON.parse(cfg.metodos_pago||'[]') : (cfg.metodos_pago||[]);
    res.json(cfg);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/configuracion/:id', tenantAuth, requireModulo('config'), async (req, res) => {
  try {
    const { nombre_negocio, direccion, telefono, logo, metodos_pago, mensaje_tirilla, stock_critico, tamano_ticket, mostrar_nombre_tirilla, mostrar_direccion_tirilla, mostrar_telefono_tirilla, pos_atendido_por } = req.body;
    const flag = (v) => v===undefined || v===null ? true : !!v;
    // A diferencia de las de arriba (que por defecto son visibles), pos_atendido_por es
    // exclusiva del módulo Peluquería y debe quedar APAGADA si no se manda explícitamente,
    // para no activarle el selector del POS a nadie que no lo haya pedido.
    const flagOff = (v) => !!v;
    await req.tenantPool.query(
      'UPDATE configuracion SET nombre_negocio=?,direccion=?,telefono=?,logo=?,metodos_pago=?,mensaje_tirilla=?,stock_critico=?,tamano_ticket=?,mostrar_nombre_tirilla=?,mostrar_direccion_tirilla=?,mostrar_telefono_tirilla=?,pos_atendido_por=? WHERE id=?',
      [nombre_negocio, direccion, telefono, logo||null, JSON.stringify(metodos_pago||[]), mensaje_tirilla, stock_critico||10, tamano_ticket||'80mm', flag(mostrar_nombre_tirilla), flag(mostrar_direccion_tirilla), flag(mostrar_telefono_tirilla), flagOff(pos_atendido_por), req.params.id]
    );
    const [rows] = await req.tenantPool.query('SELECT * FROM configuracion WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════
// USUARIO VENDEDOR (sub-usuario del tenant, con permisos por módulo)
// ════════════════════════════════
// Solo el dueño del negocio puede ver/editar esto (requireOwner) — un vendedor
// jamás puede cambiar sus propios permisos, así tenga el módulo Config habilitado.

app.get('/api/vendedor', tenantAuth, requireOwner, async (req, res) => {
  try {
    const [rows] = await masterPool.query(
      'SELECT vendedor_username, vendedor_nombre, vendedor_modulos, vendedor_activo FROM tenants WHERE id=?',
      [req.tenant.tenant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tenant no encontrado' });
    const v = rows[0];
    v.vendedor_modulos = typeof v.vendedor_modulos === 'string' ? JSON.parse(v.vendedor_modulos || '[]') : (v.vendedor_modulos || []);
    res.json(v);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/vendedor', tenantAuth, requireOwner, async (req, res) => {
  try {
    const { vendedor_username, vendedor_password, vendedor_nombre, vendedor_modulos, vendedor_activo } = req.body;
    // La contraseña del vendedor es opcional al editar: si viene vacía, se deja la que ya tenía
    // (así el dueño puede cambiar solo el nombre o los módulos sin tener que reescribir la clave).
    let sql = 'UPDATE tenants SET vendedor_username=?, vendedor_nombre=?, vendedor_modulos=?, vendedor_activo=?';
    const params = [vendedor_username || null, vendedor_nombre || '', JSON.stringify(vendedor_modulos || []), vendedor_activo ? 1 : 0];
    if (vendedor_password) { sql += ', vendedor_password=?'; params.push(vendedor_password); }
    sql += ' WHERE id=?';
    params.push(req.tenant.tenant_id);
    await masterPool.query(sql, params);
    const [rows] = await masterPool.query(
      'SELECT vendedor_username, vendedor_nombre, vendedor_modulos, vendedor_activo FROM tenants WHERE id=?',
      [req.tenant.tenant_id]
    );
    const v = rows[0];
    v.vendedor_modulos = typeof v.vendedor_modulos === 'string' ? JSON.parse(v.vendedor_modulos || '[]') : (v.vendedor_modulos || []);
    res.json(v);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════
// CREDITOS
// ════════════════════════════════

// Anular cotización (solo si está en estado aprobado)
app.patch('/api/creditos/:id/anular', tenantAuth, requireModulo('cartera'), async (req, res) => {
  try {
    const [[credito]] = await req.tenantPool.query('SELECT estado FROM creditos WHERE id = ?', [req.params.id]);
    if (!credito) return res.status(404).json({ error: 'Crédito no encontrado' });
    
    if (credito.estado !== 'aprobado') {
      return res.status(403).json({ error: 'Solo se pueden anular cotizaciones que estén en estado Aprobado' });
    }
    
    await req.tenantPool.query("UPDATE creditos SET estado = 'anulado' WHERE id = ?", [req.params.id]);
    res.json({ ok: true, mensaje: 'Cotización anulada correctamente' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/creditos', tenantAuth, requireModulo('cartera'), async (req, res) => {
  try {
    const { cliente_id, estado } = req.query;
    let sql = 'SELECT c.*, cl.nombre as cliente_nombre FROM creditos c JOIN clientes cl ON c.cliente_id = cl.id WHERE 1=1';
    const params = [];
    if (cliente_id) { sql += ' AND c.cliente_id=?'; params.push(cliente_id); }
    if (estado) { sql += ' AND c.estado=?'; params.push(estado); }
    sql += ' ORDER BY c.created_at DESC';
    const [creditos] = await req.tenantPool.query(sql, params);

    // Parsear los productos cotizados de cada crédito y recolectar sus ids para traer
    // el costo (precio_compra) actual del catálogo en una sola consulta.
    const idsCosto = new Set();
    for (const cred of creditos) {
      try { cred.productos = cred.productos_cotizados ? JSON.parse(cred.productos_cotizados) : []; } catch(e) { cred.productos = []; }
      cred.productos.forEach(p => { if (p && p.id != null) idsCosto.add(String(p.id)); });
    }
    let costoMap = {};
    if (idsCosto.size) {
      const [prodsCosto] = await req.tenantPool.query('SELECT id, precio_compra FROM productos WHERE id IN (?)', [[...idsCosto]]);
      prodsCosto.forEach(p => { costoMap[String(p.id)] = parseFloat(p.precio_compra) || 0; });
    }

    // Para créditos que vienen de una orden de servicio (sastrería), el "costo" no es un
    // precio de compra de inventario sino lo que se le paga al técnico (su comisión) por
    // cada prenda, así que se trae aparte en una sola consulta agrupada por orden.
    const idsOrdenCosto = [...new Set(creditos.filter(c => c.orden_servicio_id).map(c => c.orden_servicio_id))];
    let costoOrdenMap = {};
    if (idsOrdenCosto.length) {
      const [comisiones] = await req.tenantPool.query(
        'SELECT orden_id, SUM(comision_monto) as total FROM orden_prendas WHERE orden_id IN (?) GROUP BY orden_id',
        [idsOrdenCosto]
      );
      comisiones.forEach(c => { costoOrdenMap[c.orden_id] = parseFloat(c.total) || 0; });
    }

    // Cargar cuotas para cada crédito
    for (const cred of creditos) {
      const [cuotas] = await req.tenantPool.query('SELECT * FROM credito_cuotas WHERE credito_id=? ORDER BY numero_cuota ASC', [cred.id]);
      cred.cuotas = cuotas;

      // Calcular totales
      cred.total_pagado = cuotas.reduce((sum, c) => sum + parseFloat(c.pagado||0), 0) + parseFloat(cred.inicial||0);
      cred.saldo_pendiente = parseFloat(cred.total_credito) - cred.total_pagado;

      // Costo del crédito: precio de compra del catálogo para productos, o comisión del
      // técnico para órdenes de servicio. Ganancia: la "esperada" es el margen total si se
      // cubre todo el crédito; la "realizada" es la porción de lo ya abonado que, en orden,
      // supera ese costo (se asume que los primeros pesos abonados cubren el costo antes de
      // ser utilidad real).
      cred.costo_total = cred.orden_servicio_id
        ? (costoOrdenMap[cred.orden_servicio_id] || 0)
        : cred.productos.reduce((sum, p) => sum + (costoMap[String(p.id)] || 0) * (parseInt(p.cantidad) || 0), 0);
      cred.ganancia_esperada = parseFloat(cred.total_credito) - cred.costo_total;
      cred.ganancia_realizada = Math.max(0, Math.min(cred.total_pagado, parseFloat(cred.total_credito)) - cred.costo_total);
    }
    res.json(creditos);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Recaudo total discriminado por método de pago, respetando los mismos filtros
// (cliente_id/estado) que la lista principal de cartera. Debe ir ANTES de
// GET /api/creditos/:id para que "resumen-metodos" no se capture como :id.
app.get('/api/creditos/resumen-metodos', tenantAuth, requireModulo('cartera'), async (req, res) => {
  try {
    const { cliente_id, estado } = req.query;
    let sql = `SELECT COALESCE(NULLIF(TRIM(m.metodo_pago),''),'Otro') AS metodo, SUM(m.monto) AS total
               FROM movimientos_caja m
               JOIN creditos c ON c.id = m.credito_id
               WHERE m.tipo='ingreso' AND m.credito_id IS NOT NULL`;
    const params = [];
    if (cliente_id) { sql += ' AND c.cliente_id=?'; params.push(cliente_id); }
    if (estado) { sql += ' AND c.estado=?'; params.push(estado); }
    sql += ' GROUP BY metodo ORDER BY total DESC';
    const [rows] = await req.tenantPool.query(sql, params);
    res.json(rows.map(r => ({ metodo: r.metodo, total: parseFloat(r.total) || 0 })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/creditos/:id', tenantAuth, requireModulo('cartera'), async (req, res) => {
  try {
    const [creditos] = await req.tenantPool.query('SELECT c.*, cl.nombre as cliente_nombre FROM creditos c JOIN clientes cl ON c.cliente_id = cl.id WHERE c.id=?', [req.params.id]);
    if (!creditos.length) return res.status(404).json({ error: 'Crédito no encontrado' });
    const cred = creditos[0];
    const [cuotas] = await req.tenantPool.query('SELECT * FROM credito_cuotas WHERE credito_id=? ORDER BY numero_cuota ASC', [cred.id]);
    cred.cuotas = cuotas;
    cred.total_pagado = cuotas.reduce((sum, c) => sum + parseFloat(c.pagado||0), 0) + parseFloat(cred.inicial||0);
    cred.saldo_pendiente = parseFloat(cred.total_credito) - cred.total_pagado;
    try { cred.productos = cred.productos_cotizados ? JSON.parse(cred.productos_cotizados) : []; } catch(e) { cred.productos = []; }
    
    // Obtener abonos (movimientos)
    const [movs] = await req.tenantPool.query('SELECT * FROM movimientos_caja WHERE credito_id=? AND tipo="ingreso" ORDER BY created_at DESC', [cred.id]);
    cred.abonos = movs;
    
    res.json(cred);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/creditos/plan', tenantAuth, requireModulo('cartera'), async (req, res) => {
  try {
    const { cliente_id, precio_contado, porcentaje_recargo, total_credito, inicial, num_cuotas, frecuencia, productos } = req.body;
    if (!cliente_id || !precio_contado || !num_cuotas) return res.status(400).json({ error: 'Faltan campos' });
    
    const productos_cotizados = productos ? JSON.stringify(productos) : null;
    
    const [result] = await req.tenantPool.query(
      'INSERT INTO creditos (cliente_id, venta_id, precio_contado, porcentaje_recargo, total_credito, inicial, num_cuotas, frecuencia, fecha_inicio, estado, productos_cotizados) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, NULL, "aprobado", ?)',
      [cliente_id, precio_contado, porcentaje_recargo || 0, total_credito, inicial || 0, num_cuotas, frecuencia || 'quincenal', productos_cotizados]
    );
    res.status(201).json({ id: result.insertId, estado: 'aprobado' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Aplica un monto a las cuotas pendientes de un crédito, en orden ascendente por número
// de cuota. Lo que no alcance para cuotas (plan todavía apartado, o un sobrepago que
// excede lo pendiente) se devuelve para sumarlo al abono inicial.
async function aplicarMontoACuotas(conn, creditoId, monto) {
  const [cuotas] = await conn.query('SELECT * FROM credito_cuotas WHERE credito_id=? AND pagado < valor ORDER BY numero_cuota ASC', [creditoId]);
  let restante = parseFloat(monto);
  for (const c of cuotas) {
    if (restante <= 0) break;
    const debe = parseFloat(c.valor) - parseFloat(c.pagado);
    const aPagar = Math.min(debe, restante);
    await conn.query('UPDATE credito_cuotas SET pagado=pagado+? WHERE id=?', [aPagar, c.id]);
    restante -= aPagar;
  }
  return restante;
}

// Revierte un monto previamente aplicado: primero lo quita de las cuotas con saldo pagado
// (orden descendente, al revés de como se aplicó), y lo que sobre se resta del abono
// inicial. Es una reversión aproximada cuando hay abonos posteriores de por medio, pero
// cubre el caso normal de editar/eliminar el abono recién hecho.
async function revertirMontoDeCuotas(conn, creditoId, monto) {
  const [cuotas] = await conn.query('SELECT * FROM credito_cuotas WHERE credito_id=? AND pagado > 0 ORDER BY numero_cuota DESC', [creditoId]);
  let restante = parseFloat(monto);
  for (const c of cuotas) {
    if (restante <= 0) break;
    const quitar = Math.min(parseFloat(c.pagado), restante);
    await conn.query('UPDATE credito_cuotas SET pagado=pagado-? WHERE id=?', [quitar, c.id]);
    restante -= quitar;
  }
  return restante;
}

// Recalcula si el crédito debe marcarse como pagado, o reabrirse si dejó de estarlo.
async function recalcularEstadoCredito(conn, creditoId) {
  const [[cred]] = await conn.query('SELECT * FROM creditos WHERE id=?', [creditoId]);
  if (!cred || cred.estado === 'anulado') return cred;
  const [[tot]] = await conn.query('SELECT COUNT(*) as n, SUM(pagado) as pag FROM credito_cuotas WHERE credito_id=?', [creditoId]);
  const totalPagado = parseFloat(tot.pag || 0) + parseFloat(cred.inicial || 0);
  let nuevoEstado = cred.estado;
  if (totalPagado >= parseFloat(cred.total_credito) - 0.01) {
    nuevoEstado = 'pagado';
  } else if (cred.estado === 'pagado') {
    nuevoEstado = (parseInt(tot.n) > 0) ? 'activo' : 'aprobado';
  }
  if (nuevoEstado !== cred.estado) {
    await conn.query('UPDATE creditos SET estado=? WHERE id=?', [nuevoEstado, creditoId]);
  }
  return { ...cred, estado: nuevoEstado };
}

app.post('/api/creditos/:id/abonos', tenantAuth, requireModulo('cartera'), async (req, res) => {
  const conn = await req.tenantPool.getConnection();
  try {
    await conn.beginTransaction();
    const creditoId = req.params.id;
    const { monto, metodo_pago, observaciones } = req.body;

    if (!monto || parseFloat(monto) <= 0) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Monto inválido' });
    }

    const [creditos] = await conn.query('SELECT * FROM creditos WHERE id=?', [creditoId]);
    if (!creditos.length) {
       await conn.rollback(); conn.release();
       return res.status(404).json({ error: 'Crédito no encontrado' });
    }
    const cred = creditos[0];

    // Regla de negocio: solo los créditos en estado "activo" admiten abonos.
    // Un crédito "aprobado" es apenas una cotización/plan apartado (sin
    // cuotas todavía) y "pagado"/"anulado" ya están cerrados.
    if (cred.estado !== 'activo') {
       await conn.rollback(); conn.release();
       return res.status(409).json({ error: 'Solo los créditos Activos permiten registrar abonos (este está "' + cred.estado + '")' });
    }

    // Aplicar monto a las cuotas vencidas/pendientes en orden. Ese inicial es el que usa
    // POST /api/ventas al activar el plan para calcular las cuotas reales, así que los
    // abonos hechos antes de la entrega sí cuentan.
    const restante = await aplicarMontoACuotas(conn, creditoId, monto);
    if (restante > 0) {
       await conn.query('UPDATE creditos SET inicial=inicial+? WHERE id=?', [restante, creditoId]);
    }

    // Registrar en caja
    const [insertResult] = await conn.query('INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, credito_id) VALUES ("ingreso", "Abono Crédito", ?, ?, ?, ?, ?)',
      [parseFloat(monto), metodo_pago || 'Efectivo', observaciones || 'Abono a crédito', cred.cliente_id, creditoId]);

    // Verificar si se pagó todo
    const credActualizado = await recalcularEstadoCredito(conn, creditoId);
    if (credActualizado.estado === 'pagado') {
       await conn.query('UPDATE ventas SET estado_pago="contado" WHERE credito_id=?', [creditoId]); // Opcional
    }

    await conn.commit(); conn.release();
    res.json({ ok: true, mensaje: 'Abono registrado correctamente', abono_id: insertResult.insertId });
  } catch(e) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/creditos/:creditoId/abonos/:abonoId', tenantAuth, requireModulo('cartera'), async (req, res) => {
  const conn = await req.tenantPool.getConnection();
  try {
    await conn.beginTransaction();
    const { creditoId, abonoId } = req.params;
    const { monto, metodo_pago, observaciones } = req.body;

    if (!monto || parseFloat(monto) <= 0) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Monto inválido' });
    }

    const [creditos] = await conn.query('SELECT * FROM creditos WHERE id=?', [creditoId]);
    if (!creditos.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: 'Crédito no encontrado' });
    }
    if (creditos[0].estado === 'anulado') {
      await conn.rollback(); conn.release();
      return res.status(409).json({ error: 'No se pueden editar abonos de un crédito anulado' });
    }

    const [abonos] = await conn.query('SELECT * FROM movimientos_caja WHERE id=? AND credito_id=? AND categoria="Abono Crédito"', [abonoId, creditoId]);
    if (!abonos.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: 'Abono no encontrado' });
    }
    const abonoAnterior = abonos[0];

    // Revertir el efecto del monto anterior y aplicar el nuevo
    const restanteRevertir = await revertirMontoDeCuotas(conn, creditoId, abonoAnterior.monto);
    if (restanteRevertir > 0) {
      await conn.query('UPDATE creditos SET inicial=GREATEST(inicial-?,0) WHERE id=?', [restanteRevertir, creditoId]);
    }
    const restanteAplicar = await aplicarMontoACuotas(conn, creditoId, monto);
    if (restanteAplicar > 0) {
      await conn.query('UPDATE creditos SET inicial=inicial+? WHERE id=?', [restanteAplicar, creditoId]);
    }

    await conn.query('UPDATE movimientos_caja SET monto=?, metodo_pago=?, observaciones=? WHERE id=?',
      [parseFloat(monto), metodo_pago || 'Efectivo', observaciones || 'Abono a crédito', abonoId]);

    await recalcularEstadoCredito(conn, creditoId);

    await conn.commit(); conn.release();
    res.json({ ok: true, mensaje: 'Abono actualizado correctamente' });
  } catch(e) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/creditos/:creditoId/abonos/:abonoId', tenantAuth, requireModulo('cartera'), async (req, res) => {
  const conn = await req.tenantPool.getConnection();
  try {
    await conn.beginTransaction();
    const { creditoId, abonoId } = req.params;

    const [creditos] = await conn.query('SELECT * FROM creditos WHERE id=?', [creditoId]);
    if (!creditos.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: 'Crédito no encontrado' });
    }
    if (creditos[0].estado === 'anulado') {
      await conn.rollback(); conn.release();
      return res.status(409).json({ error: 'No se pueden eliminar abonos de un crédito anulado' });
    }

    const [abonos] = await conn.query('SELECT * FROM movimientos_caja WHERE id=? AND credito_id=? AND categoria="Abono Crédito"', [abonoId, creditoId]);
    if (!abonos.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: 'Abono no encontrado' });
    }
    const abono = abonos[0];

    const restante = await revertirMontoDeCuotas(conn, creditoId, abono.monto);
    if (restante > 0) {
      await conn.query('UPDATE creditos SET inicial=GREATEST(inicial-?,0) WHERE id=?', [restante, creditoId]);
    }

    await conn.query('DELETE FROM movimientos_caja WHERE id=?', [abonoId]);
    await recalcularEstadoCredito(conn, creditoId);

    await conn.commit(); conn.release();
    res.json({ ok: true, mensaje: 'Abono eliminado correctamente' });
  } catch(e) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════
// TECNICOS
// ════════════════════════════════
app.get('/api/tecnicos', tenantAuth, requireModulo('ordenes','peluqueria'), async (req, res) => {
  try {
    const { activo } = req.query;
    let sql = 'SELECT * FROM tecnicos WHERE 1=1';
    const params = [];
    if (activo !== undefined) { sql += ' AND activo=?'; params.push(activo === 'true' || activo === '1' ? 1 : 0); }
    sql += ' ORDER BY nombre ASC';
    const [rows] = await req.tenantPool.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tecnicos', tenantAuth, requireModulo('ordenes','peluqueria'), async (req, res) => {
  try {
    const { id, nombre, telefono, comision_porcentaje } = req.body;
    if (!id || !nombre) return res.status(400).json({ error: 'Faltan campos' });
    await req.tenantPool.query(
      'INSERT INTO tecnicos (id, nombre, telefono, comision_porcentaje, activo) VALUES (?,?,?,?,1)',
      [id, nombre, telefono || null, comision_porcentaje || 0]
    );
    const [rows] = await req.tenantPool.query('SELECT * FROM tecnicos WHERE id=?', [id]);
    res.status(201).json(rows[0]);
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El ID ya existe' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/tecnicos/:id', tenantAuth, requireModulo('ordenes','peluqueria'), async (req, res) => {
  try {
    const { nombre, telefono, comision_porcentaje, activo } = req.body;
    const [old] = await req.tenantPool.query('SELECT id FROM tecnicos WHERE id=?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'No encontrado' });
    await req.tenantPool.query(
      'UPDATE tecnicos SET nombre=?, telefono=?, comision_porcentaje=?, activo=? WHERE id=?',
      [nombre, telefono || null, comision_porcentaje || 0, (activo === false || activo === 0 || activo === '0') ? 0 : 1, req.params.id]
    );
    const [rows] = await req.tenantPool.query('SELECT * FROM tecnicos WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tecnicos/:id', tenantAuth, requireModulo('ordenes','peluqueria'), async (req, res) => {
  try {
    const [check] = await req.tenantPool.query('SELECT COUNT(*) as cnt FROM orden_prendas WHERE tecnico_id=?', [req.params.id]);
    if (check[0].cnt > 0) {
      // Ya tiene historial de prendas asociadas: se desactiva en vez de borrar, para no
      // perder la trazabilidad de comisiones ya calculadas.
      await req.tenantPool.query('UPDATE tecnicos SET activo=0 WHERE id=?', [req.params.id]);
      return res.json({ ok: true, desactivado: true });
    }
    await req.tenantPool.query('DELETE FROM tecnicos WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Resumen de comisiones por técnico: lo ganado en prendas ya entregadas, lo pagado y el
// saldo (positivo = se le debe, negativo = saldo a favor del taller).
app.get('/api/tecnicos/resumen', tenantAuth, requireModulo('ordenes'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const [tecnicos] = await req.tenantPool.query('SELECT * FROM tecnicos ORDER BY nombre ASC');

    let ganadoSql = `
      SELECT op.tecnico_id, SUM(op.comision_monto) as ganado
      FROM orden_prendas op
      JOIN ordenes_servicio o ON o.id = op.orden_id
      WHERE op.tecnico_id IS NOT NULL AND op.estado='entregada' AND o.estado='terminada'`;
    const gParams = [];
    if (fecha_inicio && fecha_fin) { ganadoSql += ' AND DATE(o.fecha_entregado) BETWEEN ? AND ?'; gParams.push(fecha_inicio, fecha_fin); }
    ganadoSql += ' GROUP BY op.tecnico_id';
    const [ganado] = await req.tenantPool.query(ganadoSql, gParams);
    const ganadoMap = {};
    ganado.forEach(g => { ganadoMap[g.tecnico_id] = parseFloat(g.ganado) || 0; });

    let pagadoSql = `SELECT tecnico_id, SUM(monto) as pagado FROM movimientos_caja
      WHERE tipo='egreso' AND categoria='Pago Técnico' AND tecnico_id IS NOT NULL`;
    const pParams = [];
    if (fecha_inicio && fecha_fin) { pagadoSql += ' AND COALESCE(fecha, DATE(created_at)) BETWEEN ? AND ?'; pParams.push(fecha_inicio, fecha_fin); }
    pagadoSql += ' GROUP BY tecnico_id';
    const [pagado] = await req.tenantPool.query(pagadoSql, pParams);
    const pagadoMap = {};
    pagado.forEach(p => { pagadoMap[p.tecnico_id] = parseFloat(p.pagado) || 0; });

    const resumen = tecnicos.map(t => {
      const ganada = ganadoMap[t.id] || 0;
      const pagado2 = pagadoMap[t.id] || 0;
      return Object.assign({}, t, { comision_ganada: ganada, pagado: pagado2, saldo: ganada - pagado2 });
    });
    res.json(resumen);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tecnicos/:id/pagos', tenantAuth, requireModulo('ordenes'), async (req, res) => {
  try {
    const [rows] = await req.tenantPool.query(
      "SELECT * FROM movimientos_caja WHERE tecnico_id=? AND categoria='Pago Técnico' ORDER BY COALESCE(fecha, DATE(created_at)) DESC, created_at DESC",
      [req.params.id]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Registrar un pago (liquidación semanal) a un técnico, con fecha exacta
app.post('/api/tecnicos/:id/pagos', tenantAuth, requireModulo('ordenes'), async (req, res) => {
  try {
    const { monto, metodo_pago, fecha, observaciones } = req.body;
    if (!monto || parseFloat(monto) <= 0) return res.status(400).json({ error: 'Monto inválido' });
    const [[tec]] = await req.tenantPool.query('SELECT id FROM tecnicos WHERE id=?', [req.params.id]);
    if (!tec) return res.status(404).json({ error: 'Técnico no encontrado' });
    const [result] = await req.tenantPool.query(
      'INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, tecnico_id, fecha) VALUES ("egreso","Pago Técnico",?,?,?,?,?)',
      [parseFloat(monto), metodo_pago || 'Efectivo', observaciones || '', req.params.id, fecha || null]
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Detalle de liquidación por técnico: cada orden con comisión + el pago que la cubrió.
// Los pagos a técnicos son un monto global (no quedan ligados a órdenes puntuales), así que
// esto se calcula al vuelo con una asignación FIFO por fecha: se ordenan las órdenes por fecha
// de entrega (más antigua primero) y los pagos por fecha de pago, y se va "consumiendo" cada
// pago contra las órdenes más viejas primero — exactamente la misma lógica que ya usa
// /api/tecnicos/resumen para el saldo (ganado - pagado), solo que aquí queda desglosada
// orden por orden y pago por pago. No requiere ninguna columna nueva ni migración.
app.get('/api/tecnicos/:id/liquidacion-detalle', tenantAuth, requireModulo('ordenes'), async (req, res) => {
  try {
    const tecnicoId = req.params.id;
    const [[tec]] = await req.tenantPool.query('SELECT * FROM tecnicos WHERE id=?', [tecnicoId]);
    if (!tec) return res.status(404).json({ error: 'Técnico no encontrado' });

    const [ordenesRaw] = await req.tenantPool.query(`
      SELECT op.id as prenda_id, o.id as orden_id, o.folio, o.cliente, o.fecha_entregado, op.comision_monto
      FROM orden_prendas op
      JOIN ordenes_servicio o ON o.id = op.orden_id
      WHERE op.tecnico_id=? AND op.estado='entregada' AND o.estado='terminada'
      ORDER BY COALESCE(o.fecha_entregado, o.created_at) ASC, o.id ASC, op.id ASC
    `, [tecnicoId]);

    const [pagosRaw] = await req.tenantPool.query(`
      SELECT * FROM movimientos_caja
      WHERE tecnico_id=? AND categoria='Pago Técnico'
      ORDER BY COALESCE(fecha, DATE(created_at)) ASC, created_at ASC, id ASC
    `, [tecnicoId]);

    const pagos = pagosRaw.map(p => Object.assign({}, p, { monto: parseFloat(p.monto) || 0, ordenes_cubiertas: [] }));
    const ordenes = ordenesRaw.map(o => Object.assign({}, o, {
      comision_monto: parseFloat(o.comision_monto) || 0,
      liquidado: false,
      pago_id: null
    }));

    let pagoIdx = 0;
    let disponible = pagos.length ? pagos[0].monto : 0;
    for (const orden of ordenes) {
      let restante = orden.comision_monto;
      while (restante > 0.0001 && pagoIdx < pagos.length) {
        if (disponible <= 0.0001) {
          pagoIdx++;
          disponible = pagoIdx < pagos.length ? pagos[pagoIdx].monto : 0;
          continue;
        }
        const usar = Math.min(restante, disponible);
        restante -= usar;
        disponible -= usar;
      }
      if (restante <= 0.0001 && pagoIdx < pagos.length) {
        orden.liquidado = true;
        orden.pago_id = pagos[pagoIdx].id;
        pagos[pagoIdx].ordenes_cubiertas.push({ orden_id: orden.orden_id, folio: orden.folio, comision_monto: orden.comision_monto });
      }
    }

    const totalGanado = ordenes.reduce((s, o) => s + o.comision_monto, 0);
    const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);

    res.json({
      tecnico: tec,
      ordenes,
      pagos,
      totales: { ganado: totalGanado, pagado: totalPagado, saldo: totalGanado - totalPagado }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════
// PELUQUERÍA: comisión de técnicos por VENTAS del POS
// ════════════════════════════════
// Totalmente independiente de las comisiones de Órdenes de Servicio (sastrería)
// de arriba: usa su propia fuente de "ganado" (ventas.tecnico_id, no orden_prendas)
// y su propia categoría de pago en movimientos_caja ("Comisión POS", nunca "Pago
// Técnico") para que los números de sastrería que ya están en producción no se
// toquen ni se mezclen con esto.

// Resumen por técnico de lo ganado en ventas del POS, lo pagado y el saldo.
app.get('/api/tecnicos/resumen-pos', tenantAuth, requireModulo('peluqueria'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const [tecnicos] = await req.tenantPool.query('SELECT * FROM tecnicos ORDER BY nombre ASC');

    let ventasSql = `
      SELECT v.tecnico_id, COUNT(*) as cantidad, SUM(v.total) as vendido,
             SUM(v.total * t.comision_porcentaje / 100) as ganado
      FROM ventas v
      JOIN tecnicos t ON t.id = v.tecnico_id
      WHERE v.tecnico_id IS NOT NULL AND v.estado='aceptada'`;
    const vParams = [];
    if (fecha_inicio && fecha_fin) { ventasSql += ' AND v.fecha BETWEEN ? AND ?'; vParams.push(fecha_inicio, fecha_fin); }
    ventasSql += ' GROUP BY v.tecnico_id';
    const [ventas] = await req.tenantPool.query(ventasSql, vParams);
    const ventasMap = {};
    ventas.forEach(v => { ventasMap[v.tecnico_id] = { cantidad: v.cantidad, vendido: parseFloat(v.vendido) || 0, ganado: parseFloat(v.ganado) || 0 }; });

    let pagadoSql = `SELECT tecnico_id, SUM(monto) as pagado FROM movimientos_caja
      WHERE tipo='egreso' AND categoria='Comisión POS' AND tecnico_id IS NOT NULL`;
    const pParams = [];
    if (fecha_inicio && fecha_fin) { pagadoSql += ' AND COALESCE(fecha, DATE(created_at)) BETWEEN ? AND ?'; pParams.push(fecha_inicio, fecha_fin); }
    pagadoSql += ' GROUP BY tecnico_id';
    const [pagado] = await req.tenantPool.query(pagadoSql, pParams);
    const pagadoMap = {};
    pagado.forEach(p => { pagadoMap[p.tecnico_id] = parseFloat(p.pagado) || 0; });

    const resumen = tecnicos.map(t => {
      const v = ventasMap[t.id] || { cantidad: 0, vendido: 0, ganado: 0 };
      const pagado2 = pagadoMap[t.id] || 0;
      return Object.assign({}, t, {
        cantidad_ventas: v.cantidad,
        valor_vendido: v.vendido,
        comision_ganada: v.ganado,
        pagado: pagado2,
        saldo: v.ganado - pagado2
      });
    });
    res.json(resumen);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Redondeo a centavos consistente en todo este bloque: así lo que el detalle muestra
// por venta es exactamente lo mismo que pagos-pos va a sumar y cobrar — nunca hay
// diferencia de un centavo entre lo que el dueño ve marcado y lo que se liquida.
function centavos(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// Detalle de liquidación por técnico: cada venta con su comisión, y si ya está
// liquidada, a qué pago quedó ligada. A diferencia de antes, esto YA NO se estima
// por fecha (FIFO): sale de comision_pos_pagos_ventas, que guarda exactamente qué
// ventas eligió el dueño al registrar cada pago (ver POST /pagos-pos más abajo).
app.get('/api/tecnicos/:id/liquidacion-pos-detalle', tenantAuth, requireModulo('peluqueria'), async (req, res) => {
  try {
    const tecnicoId = req.params.id;
    const [[tec]] = await req.tenantPool.query('SELECT * FROM tecnicos WHERE id=?', [tecnicoId]);
    if (!tec) return res.status(404).json({ error: 'Técnico no encontrado' });

    const [ventasRaw] = await req.tenantPool.query(`
      SELECT v.id as venta_id, v.folio, v.cliente, v.fecha, v.total, t.comision_porcentaje,
             cpv.pago_id as pago_id
      FROM ventas v
      JOIN tecnicos t ON t.id = v.tecnico_id
      LEFT JOIN comision_pos_pagos_ventas cpv ON cpv.venta_id = v.id
      WHERE v.tecnico_id=? AND v.estado='aceptada'
      ORDER BY v.fecha ASC, v.id ASC
    `, [tecnicoId]);

    const [pagosRaw] = await req.tenantPool.query(`
      SELECT * FROM movimientos_caja
      WHERE tecnico_id=? AND categoria='Comisión POS'
      ORDER BY COALESCE(fecha, DATE(created_at)) ASC, created_at ASC, id ASC
    `, [tecnicoId]);

    const [vinculos] = pagosRaw.length ? await req.tenantPool.query(`
      SELECT cpv.pago_id, cpv.venta_id, cpv.comision_monto, v.folio
      FROM comision_pos_pagos_ventas cpv
      JOIN ventas v ON v.id = cpv.venta_id
      WHERE cpv.pago_id IN (?)
    `, [pagosRaw.map(p => p.id)]) : [[]];

    const pagos = pagosRaw.map(p => Object.assign({}, p, { monto: parseFloat(p.monto) || 0, ventas_cubiertas: [] }));
    const pagosPorId = {};
    pagos.forEach(p => { pagosPorId[p.id] = p; });
    vinculos.forEach(v => {
      const pago = pagosPorId[v.pago_id];
      if (pago) pago.ventas_cubiertas.push({ venta_id: v.venta_id, folio: v.folio, comision_monto: centavos(v.comision_monto) });
    });

    const ventas = ventasRaw.map(v => ({
      venta_id: v.venta_id,
      folio: v.folio,
      cliente: v.cliente,
      fecha: v.fecha,
      total: v.total,
      comision_monto: centavos(v.total * v.comision_porcentaje / 100),
      liquidado: v.pago_id !== null,
      pago_id: v.pago_id
    }));

    const totalGanado = ventas.reduce((s, v) => s + v.comision_monto, 0);
    const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);

    res.json({
      tecnico: tec,
      ventas,
      pagos,
      totales: { ganado: centavos(totalGanado), pagado: centavos(totalPagado), saldo: centavos(totalGanado - totalPagado) }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Registrar un pago de comisión de ventas del POS a un técnico, liquidando EXACTAMENTE
// las ventas que el dueño marcó (venta_ids) — nunca un monto libre. El monto lo calcula
// el servidor sumando la comisión real de esas ventas, así nunca se puede pagar de más
// ni de menos de lo seleccionado. Si cualquiera de las ventas elegidas ya fue liquidada
// por otro pago, se rechaza TODA la operación (no se liquida ni una sola).
// Usa la categoría "Comisión POS" (distinta de "Pago Técnico") para no mezclarse con
// sastrería, y la UNIQUE KEY de comision_pos_pagos_ventas.venta_id es el respaldo final
// a nivel de base de datos contra una doble liquidación (incluso ante una carrera entre
// dos pagos simultáneos).
app.post('/api/tecnicos/:id/pagos-pos', tenantAuth, requireModulo('peluqueria'), async (req, res) => {
  const conn = await req.tenantPool.getConnection();
  try {
    const { venta_ids, metodo_pago, fecha, observaciones } = req.body;
    const tecnicoId = req.params.id;
    if (!Array.isArray(venta_ids) || !venta_ids.length) {
      conn.release();
      return res.status(400).json({ error: 'Selecciona al menos una venta para liquidar' });
    }

    const [[tec]] = await conn.query('SELECT id, comision_porcentaje FROM tecnicos WHERE id=?', [tecnicoId]);
    if (!tec) { conn.release(); return res.status(404).json({ error: 'Técnico no encontrado' }); }

    await conn.beginTransaction();

    // Bloquea las filas de estas ventas mientras dura la transacción, para que un
    // segundo pago simultáneo sobre las mismas ventas tenga que esperar en vez de
    // leer datos ya obsoletos.
    const [ventas] = await conn.query(
      `SELECT v.id, v.total, v.tecnico_id, v.estado FROM ventas v WHERE v.id IN (?) FOR UPDATE`,
      [venta_ids]
    );
    if (ventas.length !== venta_ids.length) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: 'Una o más ventas seleccionadas no existen' });
    }
    const invalida = ventas.find(v => String(v.tecnico_id) !== String(tecnicoId) || v.estado !== 'aceptada');
    if (invalida) {
      await conn.rollback(); conn.release();
      return res.status(409).json({ error: 'Una o más ventas seleccionadas no pertenecen a este técnico o no están vigentes' });
    }

    const [yaLiquidadas] = await conn.query(
      'SELECT venta_id FROM comision_pos_pagos_ventas WHERE venta_id IN (?)',
      [venta_ids]
    );
    if (yaLiquidadas.length) {
      await conn.rollback(); conn.release();
      return res.status(409).json({ error: 'Una o más ventas seleccionadas ya fueron liquidadas en otro pago. No se procesó nada.' });
    }

    const pct = parseFloat(tec.comision_porcentaje) || 0;
    const detalle = ventas.map(v => ({ venta_id: v.id, comision_monto: centavos(v.total * pct / 100) }));
    const montoTotal = centavos(detalle.reduce((s, d) => s + d.comision_monto, 0));
    if (montoTotal <= 0) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'El total a liquidar debe ser mayor a cero' });
    }

    const [result] = await conn.query(
      'INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, tecnico_id, fecha) VALUES ("egreso","Comisión POS",?,?,?,?,?)',
      [montoTotal, metodo_pago || 'Efectivo', observaciones || '', tecnicoId, fecha || null]
    );
    const pagoId = result.insertId;

    for (const d of detalle) {
      await conn.query(
        'INSERT INTO comision_pos_pagos_ventas (pago_id, venta_id, comision_monto) VALUES (?,?,?)',
        [pagoId, d.venta_id, d.comision_monto]
      );
    }

    await conn.commit();
    res.status(201).json({ ok: true, id: pagoId, monto: montoTotal, ventas_liquidadas: detalle.length });
  } catch(e) {
    try { await conn.rollback(); } catch(e2) {}
    // La UNIQUE KEY de venta_id es el respaldo final: si dos pagos chocan por la misma
    // venta, acá es donde se ve y se rechaza todo, sin dejar nada a medias.
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Una o más ventas seleccionadas ya fueron liquidadas en otro pago. No se procesó nada.' });
    }
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// ════════════════════════════════
// ORDENES DE SERVICIO (sastrería: reparación / diseño de prendas)
// ════════════════════════════════

async function cargarOrdenCompleta(pool, ordenId) {
  const [[orden]] = await pool.query('SELECT * FROM ordenes_servicio WHERE id=?', [ordenId]);
  if (!orden) return null;
  const [prendas] = await pool.query('SELECT * FROM orden_prendas WHERE orden_id=? ORDER BY id ASC', [ordenId]);
  orden.prendas = prendas;
  const [[abonos]] = await pool.query(
    "SELECT COALESCE(SUM(monto),0) as total FROM movimientos_caja WHERE orden_servicio_id=? AND tipo='ingreso'",
    [ordenId]
  );
  orden.abonado = parseFloat(abonos.total) || 0;
  orden.saldo = parseFloat(orden.total) - orden.abonado;
  return orden;
}

function construirPrendaInsert(p, comisionDefaultMap) {
  const precio = parseFloat(p.precio) || 0;
  const comisionPct = p.comision_porcentaje != null && p.comision_porcentaje !== ''
    ? parseFloat(p.comision_porcentaje)
    : (comisionDefaultMap[p.tecnico_id] || 0);
  const comisionMonto = precio * comisionPct / 100;
  return { precio, comisionPct, comisionMonto };
}

app.get('/api/ordenes', tenantAuth, requireModulo('ordenes'), async (req, res) => {
  try {
    const { estado, tecnico_id, cliente_id, monto_min, monto_max, busqueda } = req.query;
    let sql = 'SELECT DISTINCT o.* FROM ordenes_servicio o';
    const where = [];
    const params = [];
    if (tecnico_id) {
      sql += ' JOIN orden_prendas op ON op.orden_id = o.id';
      where.push('op.tecnico_id=?'); params.push(tecnico_id);
    }
    if (estado) { where.push('o.estado=?'); params.push(estado); }
    if (cliente_id) { where.push('o.cliente_id=?'); params.push(cliente_id); }
    if (monto_min) { where.push('o.total >= ?'); params.push(parseFloat(monto_min)); }
    if (monto_max) { where.push('o.total <= ?'); params.push(parseFloat(monto_max)); }
    if (busqueda) { where.push('(o.folio LIKE ? OR o.cliente LIKE ?)'); params.push('%'+busqueda+'%','%'+busqueda+'%'); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY o.created_at DESC';
    const [ordenes] = await req.tenantPool.query(sql, params);

    if (ordenes.length) {
      const ids = ordenes.map(o => o.id);
      const [prendas] = await req.tenantPool.query('SELECT * FROM orden_prendas WHERE orden_id IN (?)', [ids]);
      const porOrden = {};
      prendas.forEach(p => { (porOrden[p.orden_id] = porOrden[p.orden_id] || []).push(p); });
      const [abonos] = await req.tenantPool.query(
        "SELECT orden_servicio_id, SUM(monto) as total FROM movimientos_caja WHERE orden_servicio_id IN (?) AND tipo='ingreso' GROUP BY orden_servicio_id",
        [ids]
      );
      const abonoMap = {};
      abonos.forEach(a => { abonoMap[a.orden_servicio_id] = parseFloat(a.total) || 0; });
      ordenes.forEach(o => {
        o.prendas = porOrden[o.id] || [];
        o.abonado = abonoMap[o.id] || 0;
        o.saldo = parseFloat(o.total) - o.abonado;
      });
    }
    res.json(ordenes);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ordenes/:id', tenantAuth, requireModulo('ordenes'), async (req, res) => {
  try {
    const orden = await cargarOrdenCompleta(req.tenantPool, req.params.id);
    if (!orden) return res.status(404).json({ error: 'No encontrada' });
    res.json(orden);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Crear orden (recepción de la(s) prenda(s)). Opcionalmente registra el abono que deja
// el cliente en ese momento.
app.post('/api/ordenes', tenantAuth, requireModulo('ordenes'), async (req, res) => {
  const conn = await req.tenantPool.getConnection();
  try {
    await conn.beginTransaction();
    const { folio, cliente_id, cliente, fecha_recibido, fecha_entrega_estimada, observaciones, prendas, abono_inicial, metodos_pago } = req.body;
    if (!folio || !cliente_id || !fecha_recibido || !Array.isArray(prendas) || !prendas.length) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Faltan campos obligatorios (folio, cliente, fecha, al menos una prenda)' });
    }

    const tecIds = [...new Set(prendas.map(p => p.tecnico_id).filter(Boolean))];
    let comisionDefault = {};
    if (tecIds.length) {
      const [tecs] = await conn.query('SELECT id, comision_porcentaje FROM tecnicos WHERE id IN (?)', [tecIds]);
      tecs.forEach(t => { comisionDefault[t.id] = parseFloat(t.comision_porcentaje) || 0; });
    }

    let total = 0;
    prendas.forEach(p => { total += parseFloat(p.precio) || 0; });

    const [result] = await conn.query(
      'INSERT INTO ordenes_servicio (folio, cliente_id, cliente, fecha_recibido, fecha_entrega_estimada, observaciones, estado, total) VALUES (?,?,?,?,?,?,"cotizacion",?)',
      [folio, cliente_id, cliente || '', fecha_recibido, fecha_entrega_estimada || null, observaciones || '', total]
    );
    const ordenId = result.insertId;

    for (const p of prendas) {
      const { precio, comisionPct, comisionMonto } = construirPrendaInsert(p, comisionDefault);
      await conn.query(
        `INSERT INTO orden_prendas (orden_id, tipo_prenda, tipo_trabajo, descripcion, observaciones, precio, tecnico_id, comision_porcentaje, comision_monto, estado)
         VALUES (?,?,?,?,?,?,?,?,?,"en_taller")`,
        [ordenId, p.tipo_prenda || 'Prenda', p.tipo_trabajo || 'reparacion', p.descripcion || '', p.observaciones || '', precio, p.tecnico_id || null, comisionPct, comisionMonto]
      );
    }

    if (abono_inicial && parseFloat(abono_inicial) > 0) {
      const metodos = (metodos_pago || []).filter(m => parseFloat(m.monto) > 0);
      if (metodos.length) {
        for (const m of metodos) {
          await conn.query(
            'INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, orden_servicio_id) VALUES ("ingreso","Abono Orden Servicio",?,?,?,?,?)',
            [parseFloat(m.monto), m.metodo || 'Efectivo', 'Abono al recibir orden ' + folio, cliente_id, ordenId]
          );
        }
      } else {
        await conn.query(
          'INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, orden_servicio_id) VALUES ("ingreso","Abono Orden Servicio",?,?,?,?,?)',
          [parseFloat(abono_inicial), 'Efectivo', 'Abono al recibir orden ' + folio, cliente_id, ordenId]
        );
      }
    }

    await conn.commit(); conn.release();
    const orden = await cargarOrdenCompleta(req.tenantPool, ordenId);
    res.status(201).json(orden);
  } catch(e) {
    await conn.rollback(); conn.release();
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Folio duplicado' });
    res.status(500).json({ error: e.message });
  }
});

// Editar datos/prendas de una orden que aún está en Cotización (no liquidada)
app.put('/api/ordenes/:id', tenantAuth, requireModulo('ordenes'), async (req, res) => {
  const conn = await req.tenantPool.getConnection();
  try {
    await conn.beginTransaction();
    const [[orden]] = await conn.query('SELECT * FROM ordenes_servicio WHERE id=?', [req.params.id]);
    if (!orden) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'No encontrada' }); }
    if (orden.estado !== 'cotizacion') { await conn.rollback(); conn.release(); return res.status(409).json({ error: 'Solo se puede editar una orden en estado Cotización' }); }

    const { fecha_entrega_estimada, observaciones, prendas } = req.body;
    await conn.query('UPDATE ordenes_servicio SET fecha_entrega_estimada=?, observaciones=? WHERE id=?',
      [fecha_entrega_estimada || null, observaciones || '', req.params.id]);

    if (Array.isArray(prendas) && prendas.length) {
      const tecIds = [...new Set(prendas.map(p => p.tecnico_id).filter(Boolean))];
      let comisionDefault = {};
      if (tecIds.length) {
        const [tecs] = await conn.query('SELECT id, comision_porcentaje FROM tecnicos WHERE id IN (?)', [tecIds]);
        tecs.forEach(t => { comisionDefault[t.id] = parseFloat(t.comision_porcentaje) || 0; });
      }
      await conn.query('DELETE FROM orden_prendas WHERE orden_id=?', [req.params.id]);
      let total = 0;
      for (const p of prendas) {
        const { precio, comisionPct, comisionMonto } = construirPrendaInsert(p, comisionDefault);
        total += precio;
        await conn.query(
          `INSERT INTO orden_prendas (orden_id, tipo_prenda, tipo_trabajo, descripcion, observaciones, precio, tecnico_id, comision_porcentaje, comision_monto, estado)
           VALUES (?,?,?,?,?,?,?,?,?,"en_taller")`,
          [req.params.id, p.tipo_prenda || 'Prenda', p.tipo_trabajo || 'reparacion', p.descripcion || '', p.observaciones || '', precio, p.tecnico_id || null, comisionPct, comisionMonto]
        );
      }
      await conn.query('UPDATE ordenes_servicio SET total=? WHERE id=?', [total, req.params.id]);
    }

    await conn.commit(); conn.release();
    const orden2 = await cargarOrdenCompleta(req.tenantPool, req.params.id);
    res.json(orden2);
  } catch(e) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/ordenes/:id/anular', tenantAuth, requireModulo('ordenes'), async (req, res) => {
  try {
    const [[orden]] = await req.tenantPool.query('SELECT estado FROM ordenes_servicio WHERE id=?', [req.params.id]);
    if (!orden) return res.status(404).json({ error: 'No encontrada' });
    if (orden.estado !== 'cotizacion') return res.status(409).json({ error: 'Solo se puede anular una orden en estado Cotización' });
    await req.tenantPool.query('UPDATE ordenes_servicio SET estado="anulada" WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Liquidar / entregar: cobra lo que falte (todo o en parte, financiando el resto igual que
// un crédito normal) y genera la venta con el folio definitivo de la orden.
app.post('/api/ordenes/:id/liquidar', tenantAuth, requireModulo('ordenes'), async (req, res) => {
  const conn = await req.tenantPool.getConnection();
  try {
    await conn.beginTransaction();
    const [[orden]] = await conn.query('SELECT * FROM ordenes_servicio WHERE id=?', [req.params.id]);
    if (!orden) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'No encontrada' }); }
    if (orden.estado !== 'cotizacion') { await conn.rollback(); conn.release(); return res.status(409).json({ error: 'Esta orden ya fue liquidada o está anulada' }); }

    const [prendas] = await conn.query('SELECT * FROM orden_prendas WHERE orden_id=?', [req.params.id]);
    if (!prendas.length) { await conn.rollback(); conn.release(); return res.status(409).json({ error: 'La orden no tiene prendas' }); }

    const [[abonoRow]] = await conn.query(
      "SELECT COALESCE(SUM(monto),0) as total FROM movimientos_caja WHERE orden_servicio_id=? AND tipo='ingreso'",
      [req.params.id]
    );
    const abonadoPrevio = parseFloat(abonoRow.total) || 0;
    const total = parseFloat(orden.total);

    const { metodos_pago, folio_venta, fecha, hora, num_cuotas, frecuencia } = req.body;
    const metodosAhora = (metodos_pago || []).filter(m => parseFloat(m.monto) > 0);
    const montoAhora = metodosAhora.reduce((s, m) => s + parseFloat(m.monto), 0);

    const totalCobrado = abonadoPrevio + montoAhora;
    const saldoRestante = total - totalCobrado;

    if (saldoRestante > 0.5 && (!num_cuotas || parseInt(num_cuotas) < 1)) {
      await conn.rollback(); conn.release();
      return res.status(409).json({ error: 'Queda saldo pendiente de $' + saldoRestante.toFixed(2) + '; indica a cuántas cuotas se financia' });
    }

    const prendasJson = prendas.map(p => ({ id: 'PRENDA-' + p.id, nombre: p.tipo_prenda + (p.descripcion ? ' - ' + p.descripcion : ''), precio: parseFloat(p.precio), cantidad: 1 }));

    const fechaVenta = fecha || new Date().toISOString().slice(0,10);
    const horaVenta = hora || new Date().toTimeString().slice(0,8);
    const folio = folio_venta || ('VENTA-' + fechaVenta.replace(/-/g,'') + '-ORD' + req.params.id);

    let creditoId = null;
    const esCredito = saldoRestante > 0.5;

    if (esCredito) {
      const [credResult] = await conn.query(
        `INSERT INTO creditos (cliente_id, precio_contado, porcentaje_recargo, total_credito, inicial, num_cuotas, frecuencia, fecha_inicio, estado, productos_cotizados, orden_servicio_id)
         VALUES (?,?,0,?,?,?,?,?,"activo",?,?)`,
        [orden.cliente_id, total, total, totalCobrado, parseInt(num_cuotas), frecuencia || 'quincenal', fechaVenta, JSON.stringify(prendasJson), req.params.id]
      );
      creditoId = credResult.insertId;

      let valorCuota = saldoRestante / parseInt(num_cuotas);
      for (let i = 1; i <= parseInt(num_cuotas); i++) {
        let d = new Date(fechaVenta);
        if (frecuencia === 'mensual') d.setMonth(d.getMonth() + i);
        else if (frecuencia === 'semanal') d.setDate(d.getDate() + (i * 7));
        else d.setDate(d.getDate() + (i * 15));
        await conn.query('INSERT INTO credito_cuotas (credito_id, numero_cuota, fecha_vence, valor, pagado) VALUES (?,?,?,?,0)',
          [creditoId, i, d.toISOString().split('T')[0], valorCuota]);
      }
    }

    const metodosParaVenta = metodosAhora.map(m => ({ metodo: m.metodo, monto: parseFloat(m.monto) }));
    const metodoPagoStr = metodosParaVenta.map(m => m.metodo).join(' + ') || (esCredito ? 'Crédito' : 'Efectivo');

    const [ventaResult] = await conn.query(
      `INSERT INTO ventas (folio, fecha, hora, cliente, cliente_id, observaciones, metodo_pago, metodos_pago, total, cambio, estado, estado_pago, credito_id, orden_servicio_id)
       VALUES (?,?,?,?,?,?,?,?,?,0,"aceptada",?,?,?)`,
      [folio, fechaVenta, horaVenta, orden.cliente, orden.cliente_id, orden.observaciones || '', metodoPagoStr, JSON.stringify(metodosParaVenta), total, esCredito ? 'credito' : 'contado', creditoId, req.params.id]
    );
    const ventaId = ventaResult.insertId;

    for (const p of prendasJson) {
      await conn.query('INSERT INTO venta_productos (venta_id, producto_id, nombre, cantidad, precio_unitario, subtotal) VALUES (?,?,?,?,?,?)',
        [ventaId, p.id, p.nombre, 1, p.precio, p.precio]);
    }

    if (esCredito) {
      await conn.query('UPDATE creditos SET venta_id=? WHERE id=?', [ventaId, creditoId]);
    }

    // Registrar el cobro de HOY (el abono previo, si lo hubo, ya quedó registrado al recibir la orden)
    for (const m of metodosAhora) {
      await conn.query(
        'INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, credito_id, orden_servicio_id) VALUES ("ingreso",?,?,?,?,?,?,?)',
        [esCredito ? 'Abono Inicial' : 'Pago Orden Servicio', parseFloat(m.monto), m.metodo || 'Efectivo', 'Pago al entregar orden ' + orden.folio, orden.cliente_id, creditoId, req.params.id]
      );
    }

    await conn.query('UPDATE orden_prendas SET estado="entregada" WHERE orden_id=?', [req.params.id]);
    await conn.query('UPDATE ordenes_servicio SET estado="terminada", venta_id=?, credito_id=?, fecha_entregado=NOW() WHERE id=?',
      [ventaId, creditoId, req.params.id]);

    await conn.commit(); conn.release();
    const ordenFinal = await cargarOrdenCompleta(req.tenantPool, req.params.id);
    res.json(ordenFinal);
  } catch(e) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════
// MOVIMIENTOS E INFORME
// ════════════════════════════════
app.post('/api/movimientos', tenantAuth, requireModulo('egresos'), async (req, res) => {
  try {
    const { tipo, categoria, monto, metodo_pago, observaciones, fecha } = req.body;
    if(!tipo || !categoria || !monto) return res.status(400).json({ error: 'Faltan campos' });

    const [result] = await req.tenantPool.query(
      'INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, fecha) VALUES (?,?,?,?,?,?)',
      [tipo, categoria, monto, metodo_pago||'Efectivo', observaciones||'', fecha||null]
    );
    res.json({ ok: true, id: result.insertId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Listado de movimientos de caja (usado por "Otros Egresos" para ver los gastos del día,
// y en general para cualquier ingreso/egreso suelto con filtros de fecha/tipo/categoría).
app.get('/api/movimientos', tenantAuth, requireModulo('egresos'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, tipo, categoria } = req.query;
    let sql = 'SELECT * FROM movimientos_caja WHERE 1=1';
    const params = [];
    if (fecha_inicio && fecha_fin) { sql += ' AND COALESCE(fecha, DATE(created_at)) BETWEEN ? AND ?'; params.push(fecha_inicio, fecha_fin); }
    if (tipo) { sql += ' AND tipo=?'; params.push(tipo); }
    if (categoria) { sql += ' AND categoria=?'; params.push(categoria); }
    sql += ' ORDER BY COALESCE(fecha, DATE(created_at)) DESC, created_at DESC';
    const [rows] = await req.tenantPool.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Borra un movimiento suelto (gasto del día o pago a técnico mal registrado). No se puede
// borrar por aquí un movimiento que pertenece a un crédito/orden, porque esos ya tienen su
// propio flujo de edición/eliminación de abonos.
app.delete('/api/movimientos/:id', tenantAuth, requireModulo('egresos'), async (req, res) => {
  try {
    const [[mov]] = await req.tenantPool.query('SELECT * FROM movimientos_caja WHERE id=?', [req.params.id]);
    if (!mov) return res.status(404).json({ error: 'No encontrado' });
    if (mov.credito_id || mov.orden_servicio_id) return res.status(409).json({ error: 'Este movimiento está asociado a un crédito/orden y no puede eliminarse desde aquí' });
    await req.tenantPool.query('DELETE FROM movimientos_caja WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/informe', tenantAuth, requireModulo('egresos'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    if(!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Rango de fechas requerido' });

    // 1. Ventas por producto
    const [prodVentas] = await req.tenantPool.query(`
      SELECT vp.producto_id, vp.nombre, 
             SUM(vp.cantidad) as cant, 
             SUM(vp.subtotal) as total_venta, 
             SUM(vp.cantidad * COALESCE(p.precio_compra,0)) as total_costo 
      FROM venta_productos vp 
      JOIN ventas v ON vp.venta_id=v.id 
      LEFT JOIN productos p ON vp.producto_id=p.id 
      WHERE v.fecha BETWEEN ? AND ? AND v.estado='aceptada' 
      GROUP BY vp.producto_id, vp.nombre
    `, [fecha_inicio, fecha_fin]);

    // 2. Total ventas (Contado vs Crédito)
    const [totalVentas] = await req.tenantPool.query(`
      SELECT estado_pago, SUM(total) as total 
      FROM ventas 
      WHERE fecha BETWEEN ? AND ? AND estado='aceptada' 
      GROUP BY estado_pago
    `, [fecha_inicio, fecha_fin]);

    // 3. Ingresos/Egresos (movimientos_caja)
    const [movimientos] = await req.tenantPool.query(`
      SELECT tipo, categoria, SUM(monto) as total 
      FROM movimientos_caja 
      WHERE DATE(created_at) BETWEEN ? AND ? 
      GROUP BY tipo, categoria
    `, [fecha_inicio, fecha_fin]);

    // 4. Cartera
    const [cartera] = await req.tenantPool.query(`
      SELECT SUM(total_credito) as total_cartera, 
             SUM((SELECT COALESCE(SUM(pagado),0) FROM credito_cuotas cc WHERE cc.credito_id=c.id) + inicial) as cobrado 
      FROM creditos c
    `);
    
    // 5. Balance por Metodos de Pago
    const [ventasMetodos] = await req.tenantPool.query(`
      SELECT metodos_pago FROM ventas WHERE fecha BETWEEN ? AND ? AND estado='aceptada' AND estado_pago='contado'
    `, [fecha_inicio, fecha_fin]);
    
    let metodosBalance = {};
    for (let v of ventasMetodos) {
       let arr = typeof v.metodos_pago === 'string' ? JSON.parse(v.metodos_pago || '[]') : (v.metodos_pago || []);
       for (let m of arr) {
          metodosBalance[m.metodo] = (metodosBalance[m.metodo] || 0) + parseFloat(m.monto);
       }
    }
    
    const [movMetodos] = await req.tenantPool.query(`
      SELECT tipo, metodo_pago, SUM(monto) as total 
      FROM movimientos_caja 
      WHERE DATE(created_at) BETWEEN ? AND ? 
      GROUP BY tipo, metodo_pago
    `, [fecha_inicio, fecha_fin]);
    
    for (let m of movMetodos) {
       if (m.tipo === 'ingreso') metodosBalance[m.metodo_pago] = (metodosBalance[m.metodo_pago] || 0) + parseFloat(m.total);
       if (m.tipo === 'egreso') metodosBalance[m.metodo_pago] = (metodosBalance[m.metodo_pago] || 0) - parseFloat(m.total);
    }

    res.json({
       productos: prodVentas,
       ventas: totalVentas,
       movimientos: movimientos,
       metodos: metodosBalance,
       cartera: cartera[0]
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── START ──
// ================= CATALOGOS =================
app.post('/api/catalogos', tenantAuth, requireModulo('productos'), async (req, res) => {
  try {
    const { configuracion, productos } = req.body;
    const slug = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    await req.tenantPool.query(
      'INSERT INTO catalogos (slug, configuracion, productos) VALUES (?, ?, ?)',
      [slug, JSON.stringify(configuracion), JSON.stringify(productos)]
    );
    
    res.json({ success: true, slug });
  } catch (error) {
    console.error('Error publicando catalogo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/catalogos/:slug', async (req, res) => {
  try {
    let rows;
    if (req.params.slug === 'latest') {
      [rows] = await req.tenantPool.query('SELECT * FROM catalogos ORDER BY id DESC LIMIT 1');
    } else {
      [rows] = await req.tenantPool.query('SELECT * FROM catalogos WHERE slug = ? LIMIT 1', [req.params.slug]);
    }
    if (rows.length === 0) return res.status(404).json({ error: 'Catálogo no encontrado' });
    
    let catalogo = rows[0];
    if (typeof catalogo.configuracion === 'string') catalogo.configuracion = JSON.parse(catalogo.configuracion);
    if (typeof catalogo.productos === 'string') catalogo.productos = JSON.parse(catalogo.productos);
    
    if (!catalogo.configuracion.mostrarPrecios) {
      catalogo.productos = catalogo.productos.map(p => {
        let clean = { ...p };
        delete clean.precio_venta;
        delete clean.precio_min;
        return clean;
      });
    }
    
    res.json(catalogo);
  } catch (error) {
    console.error('Error obteniendo catalogo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// ════════════════════════════════
// SAAS ADMIN API
// ════════════════════════════════
const saasAdminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const adminToken = process.env.ADMIN_TOKEN || 'CaribeAdminSaaS2026!';
  if (token !== adminToken) return res.status(403).json({ error: 'No autorizado' });
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
    await masterPool.query(`CREATE DATABASE IF NOT EXISTS ${db_name};`);
    await masterPool.query(`GRANT ALL PRIVILEGES ON ${db_name}.* TO 'pos_user'@'%';`);
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

    const schemaSQL = `
      CREATE TABLE IF NOT EXISTS productos (
        id VARCHAR(50) PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        categoria VARCHAR(100) NULL,
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
        tecnico_id VARCHAR(50) NULL,
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
        mostrar_nombre_tirilla BOOLEAN DEFAULT TRUE,
        mostrar_direccion_tirilla BOOLEAN DEFAULT TRUE,
        mostrar_telefono_tirilla BOOLEAN DEFAULT TRUE,
        pos_atendido_por BOOLEAN DEFAULT FALSE,
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
      CREATE TABLE IF NOT EXISTS comision_pos_pagos_ventas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pago_id INT NOT NULL,
        venta_id INT NOT NULL,
        comision_monto DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_venta_liquidada (venta_id)
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


const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`API POS corriendo en puerto ${PORT}`));
module.exports = app;
