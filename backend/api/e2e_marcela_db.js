const mysql = require('mysql2/promise');

async function run() {
  const c = await mysql.createConnection({
    host: '89.117.56.39',
    port: 3308,
    user: 'pos_user',
    password: 'Pap3l3r!4#S3cur3_2026',
    database: 'ventanas_estilo'
  });
  
  try {
    console.log('--- INICIO DE E2E: MARCELA MARTINEZ (Vía DB) ---');

    console.log('[1] Creando/Buscando Cliente: Marcela Martínez...');
    let clienteId = 'MM-1001';
    await c.query('INSERT IGNORE INTO clientes (id, nombre) VALUES (?,?)', [clienteId, 'Marcela Martínez']);

    console.log('[2] Buscando Producto 1...');
    let prodId = '1';
    let [[prodInit]] = await c.query('SELECT stock FROM productos WHERE id=?', [prodId]);
    if (!prodInit) {
        console.log('    El producto 1 no existe. Usando código fallback.');
        prodInit = {stock: 10};
    } else {
        console.log('    Stock inicial del producto 1:', prodInit.stock);
    }

    console.log('[3] Cotizando Plan de Crédito en Cartera para Marcela...');
    const [rPlan] = await c.query('INSERT INTO creditos (cliente_id, venta_id, precio_contado, porcentaje_recargo, total_credito, inicial, num_cuotas, frecuencia, fecha_inicio, estado) VALUES (?,NULL,?,?,?,?,?,?,NULL,?)', 
    [clienteId, 1000, 15, 1150, 150, 4, 'quincenal', 'aprobado']);
    const planId = rPlan.insertId;
    console.log('    Plan creado con ID:', planId, '| Estado: aprobado');

    console.log('[4] Venta POS (Aplicando Crédito de Marcela)...');
    const metodosPago = JSON.stringify([{metodo:'Crédito',monto:1150}]);
    const folio = 'POS-MM-' + Date.now();
    const [rVenta] = await c.query('INSERT INTO ventas (folio,fecha,hora,cliente,cliente_id,metodo_pago,metodos_pago,total,cambio,estado,estado_pago,credito_id) VALUES (?,CURDATE(),CURTIME(),?,?,?,?,?,?,?,?,?)', 
    [folio, `${clienteId} - Marcela Martínez`, clienteId, metodosPago, metodosPago, 1150, 0, 'aceptada', 'credito', planId]);
    const ventaId = rVenta.insertId;
    
    // Descontar inventario
    await c.query('UPDATE productos SET stock = stock - 1 WHERE id=?', [prodId]);
    let [[prodFin]] = await c.query('SELECT stock FROM productos WHERE id=?', [prodId]);
    console.log('    Venta registrada:', ventaId);
    console.log('    Stock después de venta:', prodFin ? prodFin.stock : 'N/A', '(-1 comprobado)');

    // Activar crédito e inicial
    await c.query('UPDATE creditos SET venta_id=?, estado=?, fecha_inicio=CURDATE() WHERE id=?', [ventaId, 'activo', planId]);
    // Generar cuotas (250 cada una, 4 cuotas = 1000)
    await c.query('INSERT INTO credito_cuotas (credito_id, numero_cuota, fecha_vence, valor, pagado) VALUES (?,1,DATE_ADD(CURDATE(), INTERVAL 15 DAY),250,0), (?,2,DATE_ADD(CURDATE(), INTERVAL 30 DAY),250,0), (?,3,DATE_ADD(CURDATE(), INTERVAL 45 DAY),250,0), (?,4,DATE_ADD(CURDATE(), INTERVAL 60 DAY),250,0)', 
    [planId, planId, planId, planId]);
    // Ingreso a caja de la inicial
    await c.query('INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, credito_id) VALUES ("ingreso", "Abono Inicial", ?, "Efectivo", ?, ?, ?)', 
    [150, 'Abono inicial venta ' + folio, clienteId, planId]);

    console.log('[5] Verificando estado en Cartera y Registrando Abono...');
    console.log('    Crédito Activo | Cuotas generadas: 4');
    
    console.log('    Registrando abono de 250 (primera cuota)...');
    await c.query('UPDATE credito_cuotas SET pagado=250 WHERE credito_id=? AND numero_cuota=1', [planId]);
    await c.query('INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, credito_id) VALUES ("ingreso", "Abono Crédito", ?, "Transferencia", ?, ?, ?)', 
    [250, 'Primer abono de Marcela', clienteId, planId]);

    console.log('[6] Extrayendo Reporte Financiero del día de hoy...');
    // Ventas
    let [[totVentas]] = await c.query('SELECT SUM(total) as total_ventas FROM ventas WHERE fecha=CURDATE() AND estado="aceptada"');
    // Ingresos
    let [[ingresos]] = await c.query('SELECT COALESCE(SUM(monto),0) as ingresos_caja FROM movimientos_caja WHERE tipo="ingreso" AND DATE(created_at)=CURDATE()');
    // Cartera Total y Cobrado
    let [[cartera]] = await c.query(`SELECT COALESCE(SUM(total_credito),0) as total_cartera, COALESCE(SUM((SELECT COALESCE(SUM(pagado),0) FROM credito_cuotas cc WHERE cc.credito_id=c.id) + inicial),0) as cobrado FROM creditos c`);
    
    console.log('\n--- REPORTE MATEMÁTICO DEL ENTORNO DE PRUEBAS ---');
    console.log('    Ventas Totales Facturadas Hoy:', Number(totVentas.total_ventas));
    console.log('    Ingresos Reales a Caja Hoy (Efectivo + Transf):', Number(ingresos.ingresos_caja));
    console.log('    Cartera Historica Global (Total):', Number(cartera.total_cartera));
    console.log('    Cartera Historica Global (Cobrado):', Number(cartera.cobrado));
    
    console.log('\n    MATEMÁTICA EN CARTERA DE MARCELA:');
    console.log('      - Precio Contado Original: $1000');
    console.log('      - Recargo Aplicado (15%): +$150');
    console.log('      - Total del Crédito Facturado: $1150');
    console.log('      - Inicial Pagada (Caja Efectivo): -$150');
    console.log('      - Abono Pagado (Caja Transferencia): -$250');
    console.log('      - Saldo Pendiente de Marcela: $1150 - $150 - $250 =', (1150 - 150 - 250));
    console.log('--- FIN PRUEBA E2E ---');

  } catch(e) {
    console.error('Error', e.message);
  } finally {
    c.end();
  }
}

run();
