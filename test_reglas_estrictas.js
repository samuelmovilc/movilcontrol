const fs = require('fs');
const http = require('http');

const port = 3000;
const host = 'localhost';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: host, port, path, method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }));
    });
    req.on('error', reject);
    if(body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- TEST DE REGLAS ESTRICTAS ---');
  
  // 1. Obtener todas las cotizaciones (estado=aprobado)
  const resCot = await request('GET', '/api/creditos?estado=aprobado');
  console.log('Cotizaciones (Aprobados):', resCot.data.length);
  
  if (resCot.data.length > 0) {
    const cot = resCot.data[0];
    console.log(`Probando anular cotizacion ID=${cot.id}`);
    const resAnular = await request('PATCH', `/api/creditos/${cot.id}/anular`);
    console.log('Anular cotizacion res:', resAnular.status, resAnular.data);
  } else {
    console.log('No hay cotizaciones para probar anular');
  }

  // 2. Obtener creditos activos y tratar de anularlos
  const resAct = await request('GET', '/api/creditos?estado=activo');
  console.log('Creditos (Activos):', resAct.data.length);
  if (resAct.data.length > 0) {
    const act = resAct.data[0];
    console.log(`Probando anular credito ID=${act.id}`);
    const resAnularAct = await request('PATCH', `/api/creditos/${act.id}/anular`);
    console.log('Anular credito activo res (debe fallar 403):', resAnularAct.status, resAnularAct.data);
  }
}

runTests().catch(console.error);
