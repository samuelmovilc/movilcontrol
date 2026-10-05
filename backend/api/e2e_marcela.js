async function run() {
  const base = 'http://localhost:3005/api';
  const post = async (url, body) => {
    const res = await fetch(base + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };
  const get = async (url) => {
    const res = await fetch(base + url);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  try {
    console.log('--- INICIO DE E2E: MARCELA MARTINEZ ---');

    // 1. Cliente
    console.log('[1] Creando Cliente: Marcela Martínez...');
    let clienteId = 'MM-1001';
    await post('/clientes', { id: clienteId, nombre: 'Marcela Martínez', telefono: '3000000000', direccion: 'Calle Falsa 123' });

    // 2. Producto
    console.log('[2] Creando Producto de Prueba...');
    let prodId = 'PROD-MM-01';
    await post('/productos', { id: prodId, nombre: 'Producto Prueba Marcela', categoria: 'General', costo: 500, precio_venta: 1000, stock: 10 });
    
    // Verificamos stock inicial
    let prodsInit = await get('/productos');
    let prodInit = prodsInit.find(p => p.id === prodId);
    console.log('    Stock inicial del producto:', prodInit.stock);

    // 3. Plan de Crédito
    console.log('[3] Creando Plan de Crédito en Cartera...');
    const plan = await post('/creditos/plan', {
      cliente_id: clienteId,
      precio_contado: 1000,
      porcentaje_recargo: 15,
      total_credito: 1150,
      inicial: 150,
      num_cuotas: 4,
      frecuencia: 'quincenal'
    });
    console.log('    Plan creado con ID:', plan.id, '| Estado:', plan.estado);

    // 4. Venta POS
    console.log('[4] Procesando Venta en POS...');
    const folio = 'POS-MM-' + Date.now();
    const hoy = new Date().toISOString().split('T')[0];
    const venta = await post('/ventas', {
      folio: folio,
      fecha: hoy,
      hora: '12:00:00',
      cliente: `${clienteId} - Marcela Martínez`,
      metodos_pago: JSON.stringify([{ metodo: 'Crédito', monto: 1150 }]),
      total: 1150,
      productos: [{ codigo: prodId, nombre: 'Producto Prueba Marcela', cantidad: 1, precioUnitario: 1000, subtotal: 1000 }],
      credito_plan_id: plan.id
    });
    console.log('    Venta registrada:', venta.id, '| Crédito Activado:', venta.credito_id || plan.id);

    // Verificamos stock final
    let prodsFin = await get('/productos');
    let prodFin = prodsFin.find(p => p.id === prodId);
    console.log('    Stock después de venta:', prodFin.stock, '(-1 comprobado)');

    // 5. Abono
    console.log('[5] Verificando estado en Cartera y Registrando Abono...');
    let creditos = await get('/creditos?estado=activo');
    let credMarcela = creditos.find(c => c.id === plan.id);
    console.log('    Crédito en Cartera:', credMarcela ? 'Activo' : 'No encontrado', '| Saldo Pendiente:', credMarcela.saldo_pendiente, '| Cuotas:', credMarcela.cuotas?.length);
    
    // Registrar Abono
    console.log('    Registrando abono de 250...');
    await post(`/creditos/${plan.id}/abonos`, { monto: 250, metodo_pago: 'Transferencia', observaciones: 'Primer abono de Marcela' });
    
    creditos = await get('/creditos?estado=activo');
    credMarcela = creditos.find(c => c.id === plan.id);
    console.log('    Saldo luego del abono:', credMarcela.saldo_pendiente);
    
    // 6. Informe
    console.log('[6] Extrayendo Reporte Financiero...');
    const informe = await get(`/informes?inicio=${hoy}&fin=${hoy}`);
    console.log('--- REPORTE MATEMÁTICO ---');
    console.log('    Ventas Totales (Total Facturado):', informe.resumen.total_ventas);
    console.log('    Ventas por Producto (Producto Prueba Marcela):', informe.ventasProductos.find(v => v.codigo === prodId)?.subtotal_vendido || 0);
    console.log('    Ingresos a Caja (Efectivo y Transferencias Totales):', informe.resumen.ingresos_caja);
    console.log('    Cartera Total (Activos):', informe.cartera.total_cartera);
    console.log('    Cartera Cobrado (Abonos + Inicial):', informe.cartera.cobrado);
    
    let desgloses = informe.ventasMetodos;
    console.log('    Desglose de Ingresos:');
    desgloses.forEach(d => console.log(`      - ${d.metodo_pago}: ${d.total_metodo}`));
    
    console.log('--- FIN PRUEBA E2E ---');

  } catch (error) {
    console.error('ERROR E2E:', error.message);
  }
}

run();
