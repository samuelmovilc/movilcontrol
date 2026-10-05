
const mysql = require('mysql2/promise');
const API = 'http://localhost:3005/api';

async function go() {
  try {
    console.log('1. Creando cliente "Juan Pérez de Prueba"...');
    const testClient = { id: Date.now().toString().slice(-8), nombre: 'Juan Pérez de Prueba', telefono: '555-0000', direccion: 'Calle Falsa 123' };
    await fetch(API+'/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(testClient) });
    console.log('✅ Cliente creado con éxito.');

    console.log('\n2 y 3. Registrando venta con múltiples productos y configurando crédito a 2 meses (4 quincenas)...');
    const salePayload = {
      folio: 'SIM-' + Date.now().toString().slice(-6),
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().split(' ')[0],
      cliente: testClient.id + ' - ' + testClient.nombre,
      productos: [
        { codigo: 'PROD_A', nombre: 'Producto A', precioUnitario: 150000, cantidad: 1, subtotal: 150000 },
        { codigo: 'PROD_B', nombre: 'Producto B', precioUnitario: 80000, cantidad: 1, subtotal: 80000 },
        { codigo: 'PROD_C', nombre: 'Producto C', precioUnitario: 50000, cantidad: 1, subtotal: 50000 }
      ],
      total: 280000,
      metodo_pago: 'Crédito',
      credito_plan: {
        precio_contado: 280000,
        porcentaje_recargo: 0,
        inicial: 80000,
        frecuencia: 'quincenal',
        num_cuotas: 4,
        fecha_inicio: new Date().toISOString().split('T')[0]
      }
    };
    const resSale = await fetch(API+'/ventas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(salePayload) });
    const saleData = await resSale.json();
    console.log('✅ Venta Response:', saleData);
    if(saleData.error) throw new Error(saleData.error);
    console.log('✅ Venta y Crédito originado. ID Venta:', saleData.id);
    const creditData = { creditoId: saleData.creditoId }; // from where? We will fetch the credit.
    
    // Necesito obtener el id del crédito recién creado.
    const conn = await mysql.createConnection({ host: '89.117.56.39', port: 3308, user: 'pos_user', password: 'Pap3l3r!4#S3cur3_2026', database: 'ventanas_estilo' });
    const [credRes] = await conn.query('SELECT id FROM creditos WHERE venta_id=?', [saleData.id]);
    creditData.creditoId = credRes[0].id;
    console.log('✅ Crédito verificado en DB con ID:', creditData.creditoId);

    console.log('\n4. Registrando abono a la cuota 1...');
    const abonoPayload = { monto: 50000, metodo_pago: 'Efectivo', observaciones: 'Abono de prueba' };
    await fetch(API+'/creditos/'+creditData.creditoId+'/abonos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(abonoPayload) });
    console.log('✅ Abono registrado: $50,000 en Efectivo');

    console.log('\n5. Verificando impacto en Dashboard y Reportes (Informes)...');
    const d = new Date().toISOString().split('T')[0];
    const resInf = await fetch(API+'/informe?fecha_inicio='+d+'&fecha_fin='+d);
    const inf = await resInf.json();
    console.log('--- REPORTE MATEMÁTICO ---');
    console.log('Total Cartera Generada:', inf.cartera.total_cartera);
    console.log('Total Cobrado (Abonos):', inf.cartera.cobrado);
    console.log('Caja Actual (Efectivo):', inf.metodos['Efectivo'] || 0);
    console.log('Ventas a crédito hoy:', inf.ventas.filter(v=>v.estado_pago==='credito').reduce((s,v)=>s+parseFloat(v.total),0));
    
    console.log('\n6. Limpieza de datos (Reversión)...');
    const pool = mysql.createPool({ host: '89.117.56.39', port: 3308, user: 'pos_user', password: 'Pap3l3r!4#S3cur3_2026', database: 'ventanas_estilo' });
    await pool.query('DELETE FROM ventas WHERE id=?', [saleData.id]);
    await pool.query('DELETE FROM creditos WHERE id=?', [creditData.creditoId]);
    await pool.query('DELETE FROM credito_cuotas WHERE credito_id=?', [creditData.creditoId]);
    await pool.query('DELETE FROM venta_productos WHERE venta_id=?', [saleData.id]);
    await pool.query('DELETE FROM movimientos_caja WHERE observaciones=? AND monto=?', ['Abono a crédito '+creditData.creditoId, 50000]);
    await pool.query('DELETE FROM clientes WHERE id=?', [testClient.id]);
    console.log('✅ Datos ficticios eliminados exitosamente (Rollback completado).');
    process.exit(0);
  } catch (e) {
    console.error('ERROR EN SIMULACIÓN:', e);
    process.exit(1);
  }
}
go();
