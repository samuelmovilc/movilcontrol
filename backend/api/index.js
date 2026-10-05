require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const mysql      = require('mysql2/promise');

const app = express();

// ── DB POOL ──
const pool = mysql.createPool({
  host:            process.env.DB_HOST     || '89.117.56.39',
  port:            parseInt(process.env.DB_PORT) || 3308,
  database:        process.env.DB_NAME     || 'ventanas_estilo',
  user:            process.env.DB_USER     || 'pos_user',
  password:        process.env.DB_PASSWORD || 'Pap3l3r!4#S3cur3_2026',
  waitForConnections: true,
  connectionLimit: 10,
  charset:         'utf8mb4'
});

// ── MIDDLEWARE ──
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-api-key']
}));
app.use(rateLimit({ windowMs: 60*1000, max: 300 }));

// ── HEALTH ──
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date() });
  } catch(e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

// ════════════════════════════════
// PRODUCTOS
// ════════════════════════════════

// GET todos
app.get('/api/productos', async (req, res) => {
  try {
    const { nombre, codigo, stock_max, precio_min, precio_max, orden } = req.query;
    let sql = 'SELECT * FROM productos WHERE 1=1';
    const params = [];
    if (nombre)     { sql += ' AND nombre LIKE ?';        params.push('%'+nombre+'%'); }
    if (codigo)     { sql += ' AND id LIKE ?';            params.push('%'+codigo+'%'); }
    if (stock_max)  { sql += ' AND stock <= ?';           params.push(parseInt(stock_max)); }
    if (precio_min) { sql += ' AND precio_venta >= ?';    params.push(parseFloat(precio_min)); }
    if (precio_max) { sql += ' AND precio_venta <= ?';    params.push(parseFloat(precio_max)); }
    if (orden === 'salidas')     sql += ' ORDER BY salidas DESC';
    else if (orden === 'stock')  sql += ' ORDER BY stock DESC';
    else                         sql += ' ORDER BY nombre ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET uno
app.get('/api/productos/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST crear
app.post('/api/productos', async (req, res) => {
  try {
    const { id, nombre, precio_venta, precio_compra, stock, imagen } = req.body;
    if (!id || !nombre || precio_venta == null || stock == null)
      return res.status(400).json({ error: 'Faltan campos' });
    await pool.query(
      'INSERT INTO productos (id,nombre,precio_venta,precio_compra,stock,entradas,salidas,imagen) VALUES (?,?,?,?,?,?,0,?)',
      [id, nombre, precio_venta, precio_compra, stock, stock, imagen || null]
    );
    const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [id]);
    res.status(201).json(rows[0]);
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Código ya existe' });
    res.status(500).json({ error: e.message });
  }
});

// PUT actualizar
app.put('/api/productos/:id', async (req, res) => {
  try {
    const { nombre, precio_venta, precio_compra, stock, imagen } = req.body;
    const [old] = await pool.query('SELECT stock, entradas FROM productos WHERE id=?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'No encontrado' });
    const diffE = stock > old[0].stock ? stock - old[0].stock : 0;
    await pool.query(
      'UPDATE productos SET nombre=?, precio_venta=?, precio_compra=?, stock=?, entradas=entradas+?, imagen=? WHERE id=?',
      [nombre, precio_venta, precio_compra, stock, diffE, imagen !== undefined ? imagen : null, req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH solo stock
app.patch('/api/productos/:id/stock', async (req, res) => {
  try {
    const { stock } = req.body;
    const [old] = await pool.query('SELECT stock FROM productos WHERE id=?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'No encontrado' });
    const diffE = stock > old[0].stock ? stock - old[0].stock : 0;
    await pool.query(
      'UPDATE productos SET stock=?, entradas=entradas+? WHERE id=?',
      [stock, diffE, req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE eliminar (solo sin ventas)
app.delete('/api/productos/:id', async (req, res) => {
  try {
    const [check] = await pool.query('SELECT COUNT(*) as cnt FROM venta_productos WHERE producto_id=?', [req.params.id]);
    if (check[0].cnt > 0) return res.status(409).json({ error: 'Tiene ventas asociadas' });
    await pool.query('DELETE FROM productos WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST importar masivo
app.post('/api/productos/importar', async (req, res) => {
  try {
    const { productos } = req.body;
    if (!Array.isArray(productos)) return res.status(400).json({ error: 'Array requerido' });
    let added=0, updated=0, errors=0;
    for (const p of productos) {
      const { id, nombre, precio_venta, precio_compra, stock, imagen } = p;
      if (!id || !nombre) { errors++; continue; }
      const [old] = await pool.query('SELECT stock,entradas,imagen FROM productos WHERE id=?', [id]);
      if (old.length) {
        const dE = stock > old[0].stock ? stock - old[0].stock : 0;
        await pool.query(
          'UPDATE productos SET nombre=?,precio_venta=?,precio_compra=?,stock=?,entradas=entradas+?,imagen=? WHERE id=?',
          [nombre, precio_venta, precio_compra, stock, dE, imagen !== undefined ? imagen : old[0].imagen, id]
        );
        updated++;
      } else {
        await pool.query(
          'INSERT INTO productos (id,nombre,precio_venta,precio_compra,stock,entradas,salidas,imagen) VALUES (?,?,?,?,?,?,0,?)',
          [id, nombre, precio_venta, precio_compra, stock, stock, imagen || null]
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
app.get('/api/clientes', async (req, res) => {
  try {
    const { busqueda } = req.query;
    let sql = 'SELECT * FROM clientes WHERE 1=1';
    const params = [];
    if (busqueda) { 
      sql += ' AND (id LIKE ? OR nombre LIKE ?)'; 
      params.push('%'+busqueda+'%', '%'+busqueda+'%'); 
    }
    sql += ' ORDER BY nombre ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET uno
app.get('/api/clientes/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clientes WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST crear
app.post('/api/clientes', async (req, res) => {
  try {
    const { id, nombre, telefono, direccion } = req.body;
    if (!id || !nombre) return res.status(400).json({ error: 'Faltan campos' });
    await pool.query(
      'INSERT INTO clientes (id, nombre, telefono, direccion) VALUES (?, ?, ?, ?)',
      [id, nombre, telefono || null, direccion || null]
    );
    const [rows] = await pool.query('SELECT * FROM clientes WHERE id=?', [id]);
    res.status(201).json(rows[0]);
  } catch(e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El ID o Cédula ya existe' });
    res.status(500).json({ error: e.message });
  }
});

// PUT actualizar
app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { nombre, telefono, direccion } = req.body;
    const [old] = await pool.query('SELECT id FROM clientes WHERE id=?', [req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'No encontrado' });
    await pool.query(
      'UPDATE clientes SET nombre=?, telefono=?, direccion=? WHERE id=?',
      [nombre, telefono || null, direccion || null, req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM clientes WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE eliminar
app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const [check] = await pool.query('SELECT COUNT(*) as cnt FROM ventas WHERE cliente_id=?', [req.params.id]);
    if (check[0].cnt > 0) return res.status(409).json({ error: 'El cliente tiene ventas asociadas y no puede ser eliminado' });
    
    // Si queremos ser muy cuidadosos, también revisamos la tabla de creditos
    const [checkCreditos] = await pool.query('SELECT COUNT(*) as cnt FROM creditos WHERE cliente_id=?', [req.params.id]);
    if (checkCreditos[0].cnt > 0) return res.status(409).json({ error: 'El cliente tiene créditos asociados' });
    
    // No permitir borrar el cliente por defecto
    if (req.params.id === '222222') return res.status(403).json({ error: 'No se puede eliminar el cliente POS por defecto' });

    await pool.query('DELETE FROM clientes WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════
// VENTAS
// ════════════════════════════════

// GET ventas por fecha/estado
app.get('/api/ventas', async (req, res) => {
  try {
    const { fecha, estado } = req.query;
    let sql = 'SELECT * FROM ventas WHERE 1=1';
    const params = [];
    if (fecha)  { sql += ' AND fecha=?';  params.push(fecha); }
    if (estado) { sql += ' AND estado=?'; params.push(estado); }
    sql += ' ORDER BY created_at DESC';
    const [ventas] = await pool.query(sql, params);
    // cargar productos de cada venta
    for (const v of ventas) {
      const [prods] = await pool.query('SELECT * FROM venta_productos WHERE venta_id=?', [v.id]);
      v.productos = prods;
      v.metodos_pago = typeof v.metodos_pago === 'string' ? JSON.parse(v.metodos_pago||'[]') : (v.metodos_pago||[]);
    }
    res.json(ventas);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET resumen del día
app.get('/api/ventas/resumen/:fecha', async (req, res) => {
  try {
    const [ventas] = await pool.query(
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
      const [prods] = await pool.query('SELECT id, precio_compra FROM productos WHERE id IN (?)', [prodIds]);
      prods.forEach(p => { costoMap[p.id] = parseFloat(p.precio_compra); });
    }
    let utilidad = 0;
    ventas.forEach(v => { utilidad += (parseFloat(v.precio_unitario||0) - (costoMap[v.producto_id]||0)) * parseInt(v.cantidad||0); });
    res.json({ totalVendido, utilidad, pct: totalVendido>0?(utilidad/totalVendido*100):0, byMethod, cantVentas: seen.size });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET venta por folio
app.get('/api/ventas/:folio', async (req, res) => {
  try {
    const [ventas] = await pool.query('SELECT * FROM ventas WHERE folio=?', [req.params.folio]);
    if (!ventas.length) return res.status(404).json({ error: 'No encontrado' });
    const venta = ventas[0];
    const [prods] = await pool.query('SELECT * FROM venta_productos WHERE venta_id=?', [venta.id]);
    venta.productos = prods;
    venta.metodos_pago = typeof venta.metodos_pago === 'string' ? JSON.parse(venta.metodos_pago||'[]') : (venta.metodos_pago||[]);
    res.json(venta);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST crear venta
app.post('/api/ventas', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { folio, fecha, hora, cliente, observaciones, metodo_pago, metodos_pago, total, cambio, productos } = req.body;
    if (!folio||!fecha||!hora||!total||!productos?.length) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const clienteStr = cliente || '222222 - CLIENTE POS';
    let clienteId = clienteStr.split(' - ')[0].trim();
    if (!clienteId) clienteId = '222222';

    const isCredito = (metodo_pago && metodo_pago.toLowerCase().includes('crédito')) || (metodos_pago && metodos_pago.some(m => String(m.metodo).toLowerCase().includes('crédito')));
    const estadoPago = isCredito ? 'credito' : 'contado';

    // Insertar venta
    const [result] = await conn.query(
      'INSERT INTO ventas (folio,fecha,hora,cliente,cliente_id,observaciones,metodo_pago,metodos_pago,total,cambio,estado,estado_pago) VALUES (?,?,?,?,?,?,?,?,?,?,"aceptada",?)',
      [folio, fecha, hora, clienteStr, clienteId, observaciones||'', metodo_pago||'', JSON.stringify(metodos_pago||[]), total, cambio||0, estadoPago]
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
          await conn.query('INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, credito_id) VALUES ("ingreso", "Abono Inicial", ?, ?, ?, ?, ?)',
            [plan.inicial, 'Efectivo', 'Abono inicial venta ' + folio, clienteId, planId]);
        }
      }
    }

    await conn.commit(); conn.release();
    const [rows] = await pool.query('SELECT * FROM ventas WHERE id=?', [ventaId]);
    res.status(201).json(rows[0]);
  } catch(e) {
    await conn.rollback(); conn.release();
    if (e.code==='ER_DUP_ENTRY') return res.status(409).json({ error: 'Folio duplicado' });
    res.status(500).json({ error: e.message });
  }
});

// PATCH anular venta
app.patch('/api/ventas/:folio/anular', async (req, res) => {
  const conn = await pool.getConnection();
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

app.get('/api/configuracion', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM configuracion LIMIT 1');
    if (!rows.length) return res.status(404).json({ error: 'Sin configuración' });
    const cfg = rows[0];
    cfg.metodos_pago = typeof cfg.metodos_pago === 'string' ? JSON.parse(cfg.metodos_pago||'[]') : (cfg.metodos_pago||[]);
    res.json(cfg);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/configuracion/:id', async (req, res) => {
  try {
    const { nombre_negocio, direccion, telefono, logo, metodos_pago, mensaje_tirilla, stock_critico, tamano_ticket } = req.body;
    await pool.query(
      'UPDATE configuracion SET nombre_negocio=?,direccion=?,telefono=?,logo=?,metodos_pago=?,mensaje_tirilla=?,stock_critico=?,tamano_ticket=? WHERE id=?',
      [nombre_negocio, direccion, telefono, logo||null, JSON.stringify(metodos_pago||[]), mensaje_tirilla, stock_critico||10, tamano_ticket||'80mm', req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM configuracion WHERE id=?', [req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════
// CREDITOS
// ════════════════════════════════

// Anular cotización (solo si está en estado aprobado)
app.patch('/api/creditos/:id/anular', async (req, res) => {
  try {
    const [[credito]] = await pool.query('SELECT estado FROM creditos WHERE id = ?', [req.params.id]);
    if (!credito) return res.status(404).json({ error: 'Crédito no encontrado' });
    
    if (credito.estado !== 'aprobado') {
      return res.status(403).json({ error: 'Solo se pueden anular cotizaciones que estén en estado Aprobado' });
    }
    
    await pool.query("UPDATE creditos SET estado = 'anulado' WHERE id = ?", [req.params.id]);
    res.json({ ok: true, mensaje: 'Cotización anulada correctamente' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/creditos', async (req, res) => {
  try {
    const { cliente_id, estado } = req.query;
    let sql = 'SELECT c.*, cl.nombre as cliente_nombre FROM creditos c JOIN clientes cl ON c.cliente_id = cl.id WHERE 1=1';
    const params = [];
    if (cliente_id) { sql += ' AND c.cliente_id=?'; params.push(cliente_id); }
    if (estado) { sql += ' AND c.estado=?'; params.push(estado); }
    sql += ' ORDER BY c.created_at DESC';
    const [creditos] = await pool.query(sql, params);
    
    // Cargar cuotas para cada crédito
    for (const cred of creditos) {
      const [cuotas] = await pool.query('SELECT * FROM credito_cuotas WHERE credito_id=? ORDER BY numero_cuota ASC', [cred.id]);
      cred.cuotas = cuotas;
      
      // Calcular totales
      cred.total_pagado = cuotas.reduce((sum, c) => sum + parseFloat(c.pagado||0), 0) + parseFloat(cred.inicial||0);
      cred.saldo_pendiente = parseFloat(cred.total_credito) - cred.total_pagado;
      try { cred.productos = cred.productos_cotizados ? JSON.parse(cred.productos_cotizados) : []; } catch(e) { cred.productos = []; }
    }
    res.json(creditos);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/creditos/:id', async (req, res) => {
  try {
    const [creditos] = await pool.query('SELECT c.*, cl.nombre as cliente_nombre FROM creditos c JOIN clientes cl ON c.cliente_id = cl.id WHERE c.id=?', [req.params.id]);
    if (!creditos.length) return res.status(404).json({ error: 'Crédito no encontrado' });
    const cred = creditos[0];
    const [cuotas] = await pool.query('SELECT * FROM credito_cuotas WHERE credito_id=? ORDER BY numero_cuota ASC', [cred.id]);
    cred.cuotas = cuotas;
    cred.total_pagado = cuotas.reduce((sum, c) => sum + parseFloat(c.pagado||0), 0) + parseFloat(cred.inicial||0);
    cred.saldo_pendiente = parseFloat(cred.total_credito) - cred.total_pagado;
    try { cred.productos = cred.productos_cotizados ? JSON.parse(cred.productos_cotizados) : []; } catch(e) { cred.productos = []; }
    
    // Obtener abonos (movimientos)
    const [movs] = await pool.query('SELECT * FROM movimientos_caja WHERE credito_id=? AND tipo="ingreso" ORDER BY created_at DESC', [cred.id]);
    cred.abonos = movs;
    
    res.json(cred);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/creditos/plan', async (req, res) => {
  try {
    const { cliente_id, precio_contado, porcentaje_recargo, total_credito, inicial, num_cuotas, frecuencia, productos } = req.body;
    if (!cliente_id || !precio_contado || !num_cuotas) return res.status(400).json({ error: 'Faltan campos' });
    
    const productos_cotizados = productos ? JSON.stringify(productos) : null;
    
    const [result] = await pool.query(
      'INSERT INTO creditos (cliente_id, venta_id, precio_contado, porcentaje_recargo, total_credito, inicial, num_cuotas, frecuencia, fecha_inicio, estado, productos_cotizados) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, NULL, "aprobado", ?)',
      [cliente_id, precio_contado, porcentaje_recargo || 0, total_credito, inicial || 0, num_cuotas, frecuencia || 'quincenal', productos_cotizados]
    );
    res.status(201).json({ id: result.insertId, estado: 'aprobado' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/creditos/:id/abonos', async (req, res) => {
  const conn = await pool.getConnection();
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

    // Aplicar monto a las cuotas vencidas/pendientes en orden
    const [cuotas] = await conn.query('SELECT * FROM credito_cuotas WHERE credito_id=? AND pagado < valor ORDER BY numero_cuota ASC', [creditoId]);
    let restante = parseFloat(monto);
    
    for (const c of cuotas) {
       if (restante <= 0) break;
       const debe = parseFloat(c.valor) - parseFloat(c.pagado);
       const aPagar = Math.min(debe, restante);
       await conn.query('UPDATE credito_cuotas SET pagado=pagado+? WHERE id=?', [aPagar, c.id]);
       restante -= aPagar;
    }

    // Registrar en caja
    await conn.query('INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, credito_id) VALUES ("ingreso", "Abono Crédito", ?, ?, ?, ?, ?)',
      [parseFloat(monto), metodo_pago || 'Efectivo', observaciones || 'Abono a crédito', cred.cliente_id, creditoId]);

    // Verificar si se pagó todo
    const [todasCuotas] = await conn.query('SELECT SUM(valor) as tot, SUM(pagado) as pag FROM credito_cuotas WHERE credito_id=?', [creditoId]);
    const totalPagado = parseFloat(todasCuotas[0].pag) + parseFloat(cred.inicial||0);
    if (totalPagado >= parseFloat(cred.total_credito) - 0.01) {
       await conn.query('UPDATE creditos SET estado="pagado" WHERE id=?', [creditoId]);
       await conn.query('UPDATE ventas SET estado_pago="contado" WHERE credito_id=?', [creditoId]); // Opcional
    }

    await conn.commit(); conn.release();
    res.json({ ok: true, mensaje: 'Abono registrado correctamente' });
  } catch(e) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════
// MOVIMIENTOS E INFORME
// ════════════════════════════════
app.post('/api/movimientos', async (req, res) => {
  try {
    const { tipo, categoria, monto, metodo_pago, observaciones } = req.body;
    if(!tipo || !categoria || !monto) return res.status(400).json({ error: 'Faltan campos' });
    
    const [result] = await pool.query(
      'INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones) VALUES (?,?,?,?,?)',
      [tipo, categoria, monto, metodo_pago||'Efectivo', observaciones||'']
    );
    res.json({ ok: true, id: result.insertId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/informe', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    if(!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Rango de fechas requerido' });

    // 1. Ventas por producto
    const [prodVentas] = await pool.query(`
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
    const [totalVentas] = await pool.query(`
      SELECT estado_pago, SUM(total) as total 
      FROM ventas 
      WHERE fecha BETWEEN ? AND ? AND estado='aceptada' 
      GROUP BY estado_pago
    `, [fecha_inicio, fecha_fin]);

    // 3. Ingresos/Egresos (movimientos_caja)
    const [movimientos] = await pool.query(`
      SELECT tipo, categoria, SUM(monto) as total 
      FROM movimientos_caja 
      WHERE DATE(created_at) BETWEEN ? AND ? 
      GROUP BY tipo, categoria
    `, [fecha_inicio, fecha_fin]);

    // 4. Cartera
    const [cartera] = await pool.query(`
      SELECT SUM(total_credito) as total_cartera, 
             SUM((SELECT COALESCE(SUM(pagado),0) FROM credito_cuotas cc WHERE cc.credito_id=c.id) + inicial) as cobrado 
      FROM creditos c
    `);
    
    // 5. Balance por Metodos de Pago
    const [ventasMetodos] = await pool.query(`
      SELECT metodos_pago FROM ventas WHERE fecha BETWEEN ? AND ? AND estado='aceptada' AND estado_pago='contado'
    `, [fecha_inicio, fecha_fin]);
    
    let metodosBalance = {};
    for (let v of ventasMetodos) {
       let arr = typeof v.metodos_pago === 'string' ? JSON.parse(v.metodos_pago || '[]') : (v.metodos_pago || []);
       for (let m of arr) {
          metodosBalance[m.metodo] = (metodosBalance[m.metodo] || 0) + parseFloat(m.monto);
       }
    }
    
    const [movMetodos] = await pool.query(`
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
app.post('/api/catalogos', async (req, res) => {
  try {
    const { configuracion, productos } = req.body;
    const slug = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    await pool.query(
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
      [rows] = await pool.query('SELECT * FROM catalogos ORDER BY id DESC LIMIT 1');
    } else {
      [rows] = await pool.query('SELECT * FROM catalogos WHERE slug = ? LIMIT 1', [req.params.slug]);
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

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`API POS corriendo en puerto ${PORT}`));
module.exports = app;
