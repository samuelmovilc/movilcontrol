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
    console.log('=== SIMULACIÓN PASO A PASO: VENTA A CRÉDITO ===\n');
    
    // 1. Crear Cliente "Leonel Martelo"
    const [clientRes] = await c.query('INSERT INTO clientes (id, nombre, telefono) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE nombre=?', ['LM-1002', 'Leonel Martelo', '3001234567', 'Leonel Martelo']);
    console.log('✅ PASO 1: Cliente creado en Configuración: LM-1002 - Leonel Martelo');

    // 2. Crear Producto "Gafas Ray-Ban Wayfarer"
    const [prodRes] = await c.query('INSERT INTO productos (id, nombre, precio_venta, precio_compra, stock) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE stock=20', ['GAF-001', 'Gafas Ray-Ban Wayfarer', 300000, 150000, 20]);
    console.log('✅ PASO 2: Producto listo en inventario: GAF-001 (Stock inicial: 20, Precio Contado: $300,000)');

    // 3. Crear Plan de Crédito en Cartera
    const precioContado = 300000;
    const porcentajeRecargo = 20; // 20%
    const totalCredito = precioContado * (1 + (porcentajeRecargo/100)); // 360000
    const inicial = 0; // Asumo 0
    const numCuotas = 3;
    const frecuencia = 'mensual';

    const [planRes] = await c.query(
      'INSERT INTO creditos (cliente_id, precio_contado, porcentaje_recargo, total_credito, inicial, num_cuotas, frecuencia, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['LM-1002', precioContado, porcentajeRecargo, totalCredito, inicial, numCuotas, frecuencia, 'aprobado']
    );
    const planId = planRes.insertId;
    console.log(`✅ PASO 3: Cotizador de Cartera: Plan #${planId} guardado (Estado: PRE-APROBADO).`);
    console.log(`   - Precio de Contado: $${precioContado}`);
    console.log(`   - % de Recargo: ${porcentajeRecargo}%`);
    console.log(`   - Total Crédito Autocalculado: $${totalCredito}`);
    console.log(`   - Inicial: $${inicial} | Cuotas: ${numCuotas} (${frecuencia}es)`);

    // 4. Registrar Venta en POS
    const folio = 'POS-TEST-' + Date.now();
    const metodosPago = JSON.stringify([{metodo:'Crédito', monto: totalCredito}]);
    
    const [ventaRes] = await c.query(
      'INSERT INTO ventas (folio, fecha, hora, cliente, cliente_id, metodo_pago, metodos_pago, total, estado_pago, credito_id) VALUES (?, CURDATE(), CURTIME(), ?, ?, ?, ?, ?, ?, ?)',
      [folio, 'LM-1002 - Leonel Martelo', 'LM-1002', 'Crédito', metodosPago, totalCredito, 'credito', planId]
    );
    const ventaId = ventaRes.insertId;
    
    await c.query('INSERT INTO venta_productos (venta_id, producto_id, nombre, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)', [ventaId, 'GAF-001', 'Gafas Ray-Ban Wayfarer', 1, totalCredito, totalCredito]);
    await c.query('UPDATE productos SET stock = stock - 1 WHERE id = ?', ['GAF-001']);
    console.log(`✅ PASO 4: Venta #${ventaId} (Folio ${folio}) procesada en el POS seleccionando método "Crédito".`);
    console.log(`   - ¡Inventario descontado exitosamente! (Stock actual: 19)`);

    // 5. Activar Crédito y Generar Cuotas
    await c.query('UPDATE creditos SET venta_id = ?, estado = ?, fecha_inicio = CURDATE() WHERE id = ?', [ventaId, 'activo', planId]);
    const valorCuota = totalCredito / numCuotas; // 120000
    let fDate = new Date();
    for(let i=1; i<=numCuotas; i++) {
        fDate.setMonth(fDate.getMonth() + 1);
        const dateStr = fDate.toISOString().split('T')[0];
        await c.query('INSERT INTO credito_cuotas (credito_id, numero_cuota, fecha_vence, valor, pagado) VALUES (?, ?, ?, ?, ?)', [planId, i, dateStr, valorCuota, 0]);
    }
    console.log(`✅ PASO 5: El sistema ACTIVÓ el Crédito y generó la hoja de cuotas en Cartera.`);
    console.log(`   - Cuota 1: $${valorCuota}`);
    console.log(`   - Cuota 2: $${valorCuota}`);
    console.log(`   - Cuota 3: $${valorCuota}`);
    console.log(`\n¡Simulación completada en Base de Datos Real! Si entras a tu App verás a Leonel en Cartera con su crédito.`);

  } catch(e) {
    console.error('Error:', e);
  } finally {
    c.end();
  }
}

runTest();
