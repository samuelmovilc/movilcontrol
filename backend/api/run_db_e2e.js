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
    console.log('--- Iniciando Simulación E2E en DB de Contabo ---');

    console.log('1. Creando cliente...');
    await c.query('INSERT IGNORE INTO clientes (id, nombre) VALUES (?,?)', ['E2E-123','Cliente E2E']);
    
    console.log('2. Cotizando en Cartera...');
    const [rPlan] = await c.query('INSERT INTO creditos (cliente_id, venta_id, precio_contado, porcentaje_recargo, total_credito, inicial, num_cuotas, frecuencia, fecha_inicio, estado) VALUES (?,NULL,?,?,?,?,?,?,NULL,?)', ['E2E-123',1000,10,1100,100,2,'quincenal','aprobado']);
    const planId = rPlan.insertId;
    console.log('Plan:', planId);
    
    console.log('3. Venta en POS...');
    const metodosPago = JSON.stringify([{metodo:'Crédito',monto:1100}]);
    const folio = 'E2E-' + Date.now();
    const [rVenta] = await c.query('INSERT INTO ventas (folio,fecha,hora,cliente,cliente_id,observaciones,metodo_pago,metodos_pago,total,cambio,estado,estado_pago,credito_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [folio,'2026-10-04','10:00:00','E2E-123 - Cliente E2E','E2E-123','',metodosPago,metodosPago,1100,0,'aceptada','credito',planId]);
    const ventaId = rVenta.insertId;
    console.log('Venta:', ventaId);
    
    console.log('4. Activando crédito (lo hace API ventas)...');
    await c.query('UPDATE creditos SET venta_id=?, estado=?, fecha_inicio=? WHERE id=?', [ventaId, 'activo', '2026-10-04', planId]);
    await c.query('INSERT INTO credito_cuotas (credito_id, numero_cuota, fecha_vence, valor, pagado) VALUES (?,1,?,500,0), (?,2,?,500,0)', [planId, '2026-10-19', planId, '2026-11-03']);
    
    console.log('5. Abonando...');
    await c.query('UPDATE credito_cuotas SET pagado=500 WHERE credito_id=? AND numero_cuota=1', [planId]);
    await c.query('INSERT INTO movimientos_caja (tipo, categoria, monto, metodo_pago, observaciones, cliente_id, credito_id) VALUES ("ingreso", "Abono Crédito", ?, ?, ?, ?, ?)', [500, 'Efectivo', 'Abono E2E', 'E2E-123', planId]);
    
    console.log('--- Flujo E2E Completado con Éxito en DB ---');
  } catch(e) {
    console.error('Error', e.message);
  } finally {
    c.end();
  }
}

run();
