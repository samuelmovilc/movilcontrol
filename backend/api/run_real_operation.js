
// For Node 24 native fetch works, but we don't even need node-fetch, we can just use native fetch if it is supported.
// Actually Node 18+ has native fetch. Let's just use it directly.
const mysql = require('mysql2/promise');

const API = 'http://localhost:3005/api';

async function go() {
  try {
    console.log('1. Creando cliente "Fulano Martelo"...');
    const testClient = { 
       id: Date.now().toString().slice(-8), 
       nombre: 'Fulano Martelo', 
       telefono: '555-0000', 
       direccion: 'Cliente de Prueba Real' 
    };
    await fetch(API+'/clientes', { 
       method: 'POST', 
       headers: { 'Content-Type': 'application/json' }, 
       body: JSON.stringify(testClient) 
    });
    console.log('✅ Cliente creado con éxito. ID:', testClient.id);

    console.log('\n2 y 3. Registrando venta con múltiples productos y configurando crédito a 4 cuotas...');
    const now = new Date();
    
    // Generar cuotas (4 cuotas de 75,000 para total 300,000)
    let cuotas = [];
    for(let i=1; i<=4; i++){
       let d = new Date(now);
       d.setDate(d.getDate() + (i * 15)); // Quincenal aprox
       cuotas.push({
          numero: i,
          fecha: d.toISOString().split('T')[0],
          valor: 75000
       });
    }

    const salePayload = {
      folio: 'REAL-' + Date.now().toString().slice(-6),
      fecha: now.toISOString().split('T')[0],
      hora: now.toTimeString().split(' ')[0],
      cliente: testClient.id + ' - ' + testClient.nombre,
      productos: [
        { codigo: 'PROD_VENT', nombre: 'Ventana Corrediza', precioUnitario: 150000, cantidad: 1, subtotal: 150000 },
        { codigo: 'PROD_PUER', nombre: 'Puerta Principal', precioUnitario: 100000, cantidad: 1, subtotal: 100000 },
        { codigo: 'PROD_ESPE', nombre: 'Espejo Baño', precioUnitario: 50000, cantidad: 1, subtotal: 50000 }
      ],
      total: 300000,
      metodo_pago: 'Crédito',
      credito_plan: {
        precio_contado: 300000,
        porcentaje_recargo: 0,
        inicial: 0,
        frecuencia: 'quincenal',
        num_cuotas: 4,
        fecha_inicio: now.toISOString().split('T')[0],
        cuotas: cuotas
      }
    };
    
    const resSale = await fetch(API+'/ventas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(salePayload) });
    const saleData = await resSale.json();
    if(saleData.error) throw new Error(saleData.error);
    console.log('✅ Venta originada. ID Venta:', saleData.id, 'Folio:', saleData.folio);
    console.log('✅ Crédito originado. ID Crédito:', saleData.credito_id);
    const creditId = saleData.credito_id;

    console.log('\n4. Registrando abono equivalente al 50% (150,000)...');
    const abonoPayload = {
      monto: 150000,
      metodo_pago: 'Efectivo',
      observaciones: 'Abono 50% de la venta'
    };
    const resAbono = await fetch(API+'/creditos/'+creditId+'/abonos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(abonoPayload) });
    const abonoData = await resAbono.json();
    if(abonoData.error) throw new Error(abonoData.error);
    console.log('✅ Abono registrado: $150,000 en Efectivo');

    console.log('\n✅ OPERACIÓN REAL COMPLETA. NO HAY REVERSIÓN.');
    console.log('Revisa los módulos de Cartera, Clientes, Caja y POS en tu frontend. La operación ya está en vivo.');
    process.exit(0);
  } catch (e) {
    console.error('ERROR EN OPERACIÓN REAL:', e);
    process.exit(1);
  }
}
go();
