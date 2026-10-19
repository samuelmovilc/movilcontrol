/**
 * QA END-TO-END: Órdenes de Servicio (Sastrería Claudine)
 * ---------------------------------------------------------------
 * Simula, contra la API REAL en producción (Vercel), el ciclo completo
 * de un cliente que llega con una prenda para reparar:
 *
 *   1. Login como el tenant "claudine"
 *   2. Crear un técnico del taller
 *   3. Registrar al cliente que llega
 *   4. Recibir la prenda -> se genera la ORDEN en estado "cotizacion"
 *      (aquí se le dice al cliente el precio y la fecha de entrega)
 *   5. Consultar la orden para confirmar la cotización
 *   6. Liquidar la orden (el cliente paga y se lleva la prenda) ->
 *      esto genera la VENTA (y el CRÉDITO si quedara saldo pendiente)
 *   7. Ver cuánto se le debe en comisión al técnico (resumen)
 *   8. Pagarle (liquidarle) al técnico su comisión -> movimiento de caja
 *      tipo "egreso" / categoría "Pago Técnico"
 *   9. Confirmar que el pago quedó en su historial
 *
 * Ejecutar con:  node qa_orden_sastreria.js
 * Requiere Node 18+ (usa fetch nativo). No requiere credenciales de BD,
 * solo acceso a internet para llegar a la API pública en Vercel.
 */

const BASE_URL = 'https://movilcontrol-plum.vercel.app';
const USERNAME = 'claudine';
const PASSWORD = '3195122754';

function hoy(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return d.toISOString().slice(0, 10);
}

async function api(method, path, token, body) {
  const r = await fetch(BASE_URL + path, {
    method,
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}
    ),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { json = { raw: text }; }
  if (!r.ok) {
    const err = new Error('HTTP ' + r.status + ' en ' + method + ' ' + path + ' -> ' + JSON.stringify(json));
    err.status = r.status;
    err.body = json;
    throw err;
  }
  return json;
}

function linea() { console.log('─'.repeat(70)); }

(async () => {
  try {
    linea();
    console.log('1) LOGIN como tenant "claudine" (Sastrería Claudine)');
    linea();
    const login = await api('POST', '/api/login', null, { username: USERNAME, password: PASSWORD });
    const token = login.token;
    console.log('   OK. Negocio:', login.business_name || login.tenant?.business_name || '(ver respuesta completa)');
    console.log('   Módulos activos:', JSON.stringify(login.modules || login.tenant?.modules));

    linea();
    console.log('2) CREAR TÉCNICO del taller');
    linea();
    const tecnicoId = 'TEC-001';
    let tecnico;
    try {
      tecnico = await api('POST', '/api/tecnicos', token, {
        id: tecnicoId,
        nombre: 'Jorge Pérez',
        telefono: '3001234567',
        comision_porcentaje: 20
      });
      console.log('   Técnico creado:', tecnico.id, '-', tecnico.nombre, '| comisión', tecnico.comision_porcentaje + '%');
    } catch (e) {
      if (e.status === 409) {
        console.log('   Ya existía (reutilizando) TEC-001');
        const lista = await api('GET', '/api/tecnicos', token);
        tecnico = lista.find(t => t.id === tecnicoId);
      } else throw e;
    }

    linea();
    console.log('3) LLEGA EL CLIENTE -> se registra');
    linea();
    const clienteId = 'CLI-001';
    let cliente;
    try {
      cliente = await api('POST', '/api/clientes', token, {
        id: clienteId,
        nombre: 'María Gómez',
        telefono: '3109876543',
        direccion: 'Cra 10 # 20-30'
      });
      console.log('   Cliente creado:', cliente.id, '-', cliente.nombre);
    } catch (e) {
      if (e.status === 409) {
        console.log('   Ya existía (reutilizando) CLI-001');
        cliente = await api('GET', '/api/clientes/' + clienteId, token);
      } else throw e;
    }

    linea();
    console.log('4) RECIBIR LA PRENDA -> se crea la ORDEN (cotización)');
    console.log('   "Camisa negra tipo chaleco de oficina" - cambio de botones');
    linea();
    const folio = 'ORD-0001';
    const fechaRecibido = hoy(0);
    const fechaEntrega = hoy(3); // se le promete al cliente en 3 días
    const PRECIO = 15000;

    const orden = await api('POST', '/api/ordenes', token, {
      folio,
      cliente_id: clienteId,
      cliente: cliente.nombre,
      fecha_recibido: fechaRecibido,
      fecha_entrega_estimada: fechaEntrega,
      observaciones: 'Cliente trae camisa negra tipo chaleco de oficina para cambio de botones.',
      prendas: [
        {
          tipo_prenda: 'Camisa (tipo chaleco de oficina)',
          tipo_trabajo: 'reparacion',
          descripcion: 'Cambio de botones',
          observaciones: 'Botones nuevos a juego, tela negra',
          precio: PRECIO,
          tecnico_id: tecnicoId
        }
      ],
      abono_inicial: 0 // el cliente no deja abono, solo se cotiza
    });

    console.log('   ✅ Orden creada:', orden.folio, '| Estado:', orden.estado, '| Total: $' + orden.total);
    console.log('   📅 Fecha de entrega prometida al cliente:', fechaEntrega);
    console.log('   🧵 Técnico asignado:', tecnicoId, '| Comisión de esta prenda: $' + orden.prendas[0].comision_monto);
    console.log('      (Esto es lo que el cliente ve/escucha en el mostrador: precio $' + orden.total + ', listo el ' + fechaEntrega + ')');

    linea();
    console.log('5) CONSULTAR LA ORDEN (confirmar cotización) -> GET /api/ordenes/' + orden.id);
    linea();
    const ordenConsultada = await api('GET', '/api/ordenes/' + orden.id, token);
    console.log('   Estado actual:', ordenConsultada.estado, '| Saldo pendiente: $' + ordenConsultada.saldo);

    linea();
    console.log('6) LA PRENDA ESTÁ LISTA -> el cliente vuelve y paga -> LIQUIDAR');
    linea();
    const ordenLiquidada = await api('POST', '/api/ordenes/' + orden.id + '/liquidar', token, {
      metodos_pago: [{ metodo: 'Efectivo', monto: PRECIO }], // paga todo de contado
      fecha: hoy(0),
      hora: new Date().toTimeString().slice(0, 8)
    });
    console.log('   ✅ Orden liquidada. Estado final:', ordenLiquidada.estado);
    console.log('   🧾 Venta generada con ID:', ordenLiquidada.venta_id);
    console.log('   💳 Crédito generado (si quedó saldo):', ordenLiquidada.credito_id || 'Ninguno (pagó todo de contado)');
    console.log('   👕 Prenda entregada al cliente. Saldo final: $' + ordenLiquidada.saldo);

    linea();
    console.log('7) RESUMEN DE COMISIONES POR TÉCNICO (lo que se le debe)');
    linea();
    const resumen = await api('GET', '/api/tecnicos/resumen', token);
    const miTecnico = resumen.find(t => t.id === tecnicoId);
    console.log('   Técnico:', miTecnico.nombre);
    console.log('   Comisión ganada (prendas entregadas):', '$' + miTecnico.comision_ganada);
    console.log('   Ya pagado anteriormente:', '$' + miTecnico.pagado);
    console.log('   Saldo a pagarle ahora:', '$' + miTecnico.saldo);

    linea();
    console.log('8) EL DUEÑO LIQUIDA (PAGA) AL TÉCNICO SU COMISIÓN');
    linea();
    const pago = await api('POST', '/api/tecnicos/' + tecnicoId + '/pagos', token, {
      monto: miTecnico.saldo,
      metodo_pago: 'Efectivo',
      fecha: hoy(0),
      observaciones: 'Liquidación por orden ' + folio
    });
    console.log('   ✅ Pago registrado. ID de movimiento de caja:', pago.id);

    linea();
    console.log('9) CONFIRMAR HISTORIAL DE PAGOS DEL TÉCNICO');
    linea();
    const pagos = await api('GET', '/api/tecnicos/' + tecnicoId + '/pagos', token);
    console.log('   Pagos registrados a', tecnicoId + ':', pagos.length);
    pagos.forEach(p => console.log('     -', p.fecha || p.created_at, '| $' + p.monto, '|', p.observaciones));

    linea();
    console.log('✅ PRUEBA COMPLETA EXITOSA — así quedó todo registrado:');
    linea();
    console.log(JSON.stringify({
      orden_servicio: { folio: ordenLiquidada.folio, estado: ordenLiquidada.estado, total: ordenLiquidada.total },
      venta_generada_id: ordenLiquidada.venta_id,
      credito_generado_id: ordenLiquidada.credito_id,
      tecnico: { id: tecnicoId, comision_ganada: miTecnico.comision_ganada, pagado_ahora: pago.id ? miTecnico.saldo : 0 },
      cliente: { id: clienteId, nombre: cliente.nombre }
    }, null, 2));

  } catch (err) {
    console.error('❌ LA PRUEBA FALLÓ:', err.message);
    if (err.body) console.error('   Detalle:', JSON.stringify(err.body));
    process.exit(1);
  }
})();
