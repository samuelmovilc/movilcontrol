const mysql = require('mysql2/promise');

async function runTest() {
  const c = await mysql.createConnection({
    host: '89.117.56.39',
    port: 3308,
    user: 'pos_user',
    password: 'Pap3l3r!4#S3cur3_2026',
    database: 'ventanas_estilo'
  });

  try {
    console.log("=== INICIANDO SIMULACION ELIANA MARTELO ===");

    // 1. Crear Cliente
    const idCliente = 'EM-' + Math.floor(Math.random()*1000);
    await c.query('INSERT INTO clientes (id, nombre, telefono, direccion) VALUES (?, ?, ?, ?)', [idCliente, 'ELIANA MARTELO', '300000000', 'Cartagena']);
    console.log("1. Cliente Creado:", idCliente, "Eliana Martelo");

    // 2. Tomar un producto
    const [prods] = await c.query('SELECT * FROM productos WHERE stock > 0 LIMIT 1');
    const p = prods[0];
    console.log("2. Producto Seleccionado:", p.nombre, "Precio:", p.precio_venta);

    // 3. Crear Plan de Crédito
    // Parámetros: 10% interes, abono de 100,000
    const recargo = 10;
    const precio_contado = parseFloat(p.precio_venta);
    const inicial = 100000;
    const num_cuotas = 4;
    const total_credito = Math.round(precio_contado * 1.10); // 10% recargo
    const saldo = total_credito - inicial;
    
    // JSON de productos cotizados
    const productosCotizados = JSON.stringify([{
       id: p.id,
       nombre: p.nombre,
       precio: precio_contado,
       cantidad: 1
    }]);

    const [resPlan] = await c.query(
      'INSERT INTO creditos (cliente_id, venta_id, precio_contado, porcentaje_recargo, total_credito, inicial, num_cuotas, frecuencia, fecha_inicio, estado, productos_cotizados) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, NULL, "aprobado", ?)',
      [idCliente, precio_contado, recargo, total_credito, inicial, num_cuotas, 'mensual', productosCotizados]
    );
    const planId = resPlan.insertId;
    console.log("3. Plan de Crédito Pre-aprobado:", planId);
    console.log("   - Total Crédito (con interes):", total_credito);
    console.log("   - Abono Inicial:", inicial);
    console.log("   - Saldo Restante:", saldo);

    // Generar cuotas para el plan
    const valorCuota = Math.round(saldo / num_cuotas);
    let today = new Date();
    for (let i = 1; i <= num_cuotas; i++) {
        today.setMonth(today.getMonth() + 1);
        let dateStr = today.toISOString().split('T')[0];
        await c.query('INSERT INTO credito_cuotas (credito_id, numero_cuota, fecha_vence, valor, pagado) VALUES (?, ?, ?, ?, ?)', [planId, i, dateStr, valorCuota, 0]);
    }

    // 4. Obtener crédito tal como lo hace el POS (Simulando API GET /creditos/:id)
    const [creditos] = await c.query('SELECT * FROM creditos WHERE id=?', [planId]);
    const planFromDB = creditos[0];
    const productosPars = JSON.parse(planFromDB.productos_cotizados);
    console.log("4. POS Obteniendo Cotización... Productos encontrados:", productosPars.length);

    // 5. Cargar al carrito del POS y ajustar precio
    const cart = [];
    const multiplicador = 1 + (recargo / 100);
    productosPars.forEach(prod => {
      const precioInflado = Math.round(prod.precio * multiplicador);
      cart.push({
        codigo: prod.id,
        nombre: prod.nombre,
        cantidad: prod.cantidad,
        precioUnitario: precioInflado,
        subtotal: precioInflado * prod.cantidad
      });
    });
    
    const cartTotal = cart.reduce((s,c)=>s+c.subtotal, 0);
    console.log("5. Carrito POS Listo. Total en Carrito:", cartTotal, "(Debe coincidir con Total Crédito)");

    // 6. Configurar métodos de pago
    const metodosPago = [];
    const mInicial = parseFloat(planFromDB.inicial);
    const mSaldo = cartTotal - mInicial;
    
    if (mSaldo > 0) metodosPago.push({ metodo: 'Crédito', monto: mSaldo });
    if (mInicial > 0) metodosPago.push({ metodo: 'Efectivo', monto: mInicial });

    const metodosStr = metodosPago.map(r => r.metodo + ': ' + r.monto).join(' | ');
    console.log("6. Métodos de Pago a procesar:", metodosStr);

    // 7. Guardar Venta
    const dateV = new Date();
    const ds = dateV.toISOString().split('T')[0];
    const [ventas] = await c.query('SELECT id FROM ventas WHERE fecha=?', [ds]);
    const folio = 'VENTA-' + ds.replace(/-/g,'') + '-' + String(ventas.length + 1).padStart(3, '0');
    
    const [resVenta] = await c.query(
       `INSERT INTO ventas (folio, fecha, hora, cliente, cliente_id, observaciones, metodo_pago, metodos_pago, total, cambio, estado, estado_pago) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, "aceptada", "pagado")`,
       [folio, ds, dateV.toTimeString().slice(0,8), 'ELIANA MARTELO', idCliente, 'Simulacion', 'Múltiple', JSON.stringify(metodosPago), cartTotal]
    );
    const ventaId = resVenta.insertId;
    console.log("7. Venta Facturada Exitosamente. Venta ID:", ventaId, "Folio:", folio);

    // 8. Activar Crédito
    await c.query('UPDATE creditos SET estado="activo", venta_id=? WHERE id=?', [ventaId, planId]);
    console.log("8. Crédito Pasado a estado ACTIVO.");
    
    console.log("=== SIMULACION COMPLETADA CON EXITO ===");

  } catch(e) {
    console.error("ERROR EN SIMULACION:", e);
  } finally {
    c.end();
  }
}

runTest();
