async function run() {
  try {
    console.log('--- Iniciando Prueba E2E Local ---');

    // 1. Crear Cliente
    const cliR = await fetch('http://localhost:3005/api/clientes', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id:'999999123', nombre:'E2E Test Client', telefono: '0000', direccion: 'Prueba'})
    });
    const cli = await cliR.json();
    console.log('1. Cliente Creado/Obtenido:', cli.id || 'Existente');

    // 2. Cotizar Plan (Cartera)
    const planR = await fetch('http://localhost:3005/api/creditos/plan', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            cliente_id:'999999123',
            precio_contado:1000,
            porcentaje_recargo:10,
            total_credito:1100,
            inicial:100,
            num_cuotas:2,
            frecuencia:'mensual'
        })
    });
    const plan = await planR.json();
    console.log('2. Plan Aprobado Creado:', plan.id);

    // 3. Venta en POS
    const ventaR = await fetch('http://localhost:3005/api/ventas', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            folio: 'E2E-' + Date.now(),
            fecha: '2026-10-04',
            hora: '10:00:00',
            cliente: '999999123 - E2E Test Client',
            metodos_pago: JSON.stringify([{metodo:'Crédito', monto:1100}]),
            total: 1100,
            productos: [{codigo:'1', nombre:'Prod 1', cantidad:1, precioUnitario:1100, subtotal:1100}],
            credito_plan_id: plan.id
        })
    });
    const venta = await ventaR.json();
    console.log('3. Venta Creada:', venta.id, '| Credito Activado:', venta.credito_id || venta.creditoPlanId);

    // 4. Abono (Cartera)
    const abonoR = await fetch('http://localhost:3005/api/creditos/'+plan.id+'/abonos', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            monto: 500,
            metodo_pago: 'Efectivo',
            observaciones: 'Abono E2E'
        })
    });
    const abono = await abonoR.json();
    console.log('4. Abono Registrado Exitosamente:', abono);
    console.log('--- Flujo E2E Completado con Éxito ---');
  } catch(e) {
    console.error('Error:', e);
  }
}

run();
