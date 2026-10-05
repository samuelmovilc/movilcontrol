const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

// 1. REEMPLAZAR HTML
const oldHtmlRegex = /<div style="display:flex;gap:10px;margin-bottom:15px;align-items:center">[\s\S]*?<button class="btn btn-primary" onclick="abrirCotizadorCredito\(\)"><i class="fa-solid fa-calculator"><\/i>[^<]*<\/button>\s*<\/div>/;

const newHtml = `
    <!-- TARJETAS DE RESUMEN -->
    <div class="cartera-summary-grid">
      <div class="cartera-card total">
        <div class="c-icon"><i class="fa-solid fa-wallet"></i></div>
        <div class="c-info">
          <h4>Total Cartera</h4>
          <div class="c-val" id="cartera-sum-total">$0.00</div>
        </div>
      </div>
      <div class="cartera-card abonos">
        <div class="c-icon"><i class="fa-solid fa-hand-holding-dollar"></i></div>
        <div class="c-info">
          <h4>Total Recaudado</h4>
          <div class="c-val" id="cartera-sum-abonos">$0.00</div>
        </div>
      </div>
      <div class="cartera-card saldo">
        <div class="c-icon"><i class="fa-solid fa-scale-unbalanced"></i></div>
        <div class="c-info">
          <h4>Total Pendiente</h4>
          <div class="c-val" id="cartera-sum-saldo">$0.00</div>
        </div>
      </div>
    </div>

    <!-- FILTROS -->
    <div class="cartera-filters-bar">
      <div class="cartera-filters-left">
        <div class="cartera-btn-group" id="cartera-estado-group">
          <button class="cartera-state-btn active" onclick="setCarteraEstado('')" data-estado="">Todos los Estados</button>
          <button class="cartera-state-btn" onclick="setCarteraEstado('activo')" data-estado="activo">Activos</button>
          <button class="cartera-state-btn" onclick="setCarteraEstado('aprobado')" data-estado="aprobado">Aprobados</button>
          <button class="cartera-state-btn" onclick="setCarteraEstado('pagado')" data-estado="pagado">Pagados</button>
          <button class="cartera-state-btn" onclick="setCarteraEstado('anulado')" data-estado="anulado">Anulados</button>
        </div>
        <select id="filter-cartera-cliente" class="cartera-client-select" onchange="loadCartera()">
          <option value="">Todos los clientes...</option>
        </select>
        <button class="btn btn-secondary btn-xs" onclick="clearCarteraFilters()" title="Borrar Filtros" style="padding: 7px 10px; border-radius: 50%;"><i class="fa-solid fa-filter-circle-xmark"></i></button>
        <button class="btn btn-secondary btn-xs" onclick="reloadCartera()" title="Actualizar" style="padding: 7px 10px; border-radius: 50%;"><i class="fa-solid fa-rotate-right"></i></button>
      </div>
      <div class="cartera-filters-right">
        <button class="btn btn-primary" onclick="abrirCotizadorCredito()"><i class="fa-solid fa-calculator"></i> Cotizar Nuevo Crédito</button>
      </div>
    </div>
`;

if(oldHtmlRegex.test(html)) {
  html = html.replace(oldHtmlRegex, newHtml.trim());
} else {
  console.log('No se encontro el bloque HTML viejo para reemplazar.');
}

// 2. REEMPLAZAR JS
const oldJsRegex = /async function loadCartera\(\) \{[\s\S]*?document\.getElementById\('cartera-body'\)\.innerHTML = html;\s*\} catch\(e\) \{\s*toast\('Error cargando cartera: ' \+ e\.message, 'error'\);\s*\}\s*\}/;

const newJs = `let carteraAllCreditos = null;

async function loadCartera() {
  try {
    if (!carteraAllCreditos) {
      carteraAllCreditos = await apiGet('/creditos');
    }
    
    var activeBtn = document.querySelector('.cartera-state-btn.active');
    var estado = activeBtn ? activeBtn.getAttribute('data-estado') : '';
    var clientSelect = document.getElementById('filter-cartera-cliente');
    var clienteId = clientSelect ? clientSelect.value : '';
    
    // Poblar select
    var uniqueClients = new Map();
    carteraAllCreditos.forEach(function(c) {
       if(c.cliente_id) uniqueClients.set(String(c.cliente_id), c.cliente_nombre || 'Sin nombre');
    });
    
    if (clientSelect) {
      var currentVal = clientSelect.value;
      var optionsHtml = '<option value="">Todos los clientes...</option>';
      uniqueClients.forEach(function(nombre, id) {
         optionsHtml += '<option value="'+id+'">'+id+' - '+nombre+'</option>';
      });
      clientSelect.innerHTML = optionsHtml;
      clientSelect.value = currentVal; 
    }

    var filtrados = carteraAllCreditos;
    if (estado) {
       filtrados = filtrados.filter(function(c) { return c.estado === estado; });
    }
    if (clienteId) {
       filtrados = filtrados.filter(function(c) { return String(c.cliente_id) === clienteId; });
    }
    
    var sumTotal = 0, sumAbonos = 0, sumSaldo = 0;
    
    var html = '';
    filtrados.forEach(function(c) {
      sumTotal += parseFloat(c.total_credito) || 0;
      sumAbonos += parseFloat(c.total_pagado) || 0;
      sumSaldo += parseFloat(c.saldo_pendiente) || 0;

      var badgeClass = '';
      if(c.estado === 'activo') badgeClass = 'style="background:var(--electric);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px"';
      else if(c.estado === 'pagado') badgeClass = 'style="background:var(--green);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px"';
      else badgeClass = 'style="background:var(--text-light);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px"';

      html += '<tr>' +
        '<td><b>CR-' + c.id + '</b></td>' +
        '<td>' + c.cliente_id + ' - ' + (c.cliente_nombre || '') + '</td>' +
        '<td>' + fmtDate(c.fecha_inicio) + '</td>' +
        '<td>Venta ' + (c.venta_id || '') + '</td>' +
        '<td>' + fmt(c.total_credito) + '</td>' +
        '<td style="color:var(--green)">' + fmt(c.total_pagado) + '</td>' +
        '<td style="color:var(--red)">' + fmt(c.saldo_pendiente) + '</td>' +
        '<td><span ' + badgeClass + '>' + (c.estado||'').toUpperCase() + '</span></td>' +
        '<td>' +
           '<button class="btn btn-secondary btn-xs" onclick="verDetalleCredito(' + c.id + ')"><i class="fa-solid fa-eye"></i> Detalle</button>' +
           (c.estado === 'activo' ? ' <button class="btn btn-primary btn-xs" onclick="abrirAbonoRapido(' + c.id + ')"><i class="fa-solid fa-money-bill-wave"></i> Abonar</button>' : '') +
        '</td>' +
      '</tr>';
    });
    
    var tbody = document.getElementById('cartera-body');
    if(tbody) tbody.innerHTML = html;
    
    var elTotal = document.getElementById('cartera-sum-total');
    var elAbonos = document.getElementById('cartera-sum-abonos');
    var elSaldo = document.getElementById('cartera-sum-saldo');
    
    if(elTotal) elTotal.innerText = fmt(sumTotal);
    if(elAbonos) elAbonos.innerText = fmt(sumAbonos);
    if(elSaldo) elSaldo.innerText = fmt(sumSaldo);
    
  } catch(e) {
    toast('Error cargando cartera: ' + e.message, 'error');
  }
}

function setCarteraEstado(estado) {
  document.querySelectorAll('.cartera-state-btn').forEach(function(b) { b.classList.remove('active'); });
  var btn = document.querySelector('.cartera-state-btn[data-estado="'+estado+'"]');
  if(btn) btn.classList.add('active');
  loadCartera();
}

function clearCarteraFilters() {
  var sel = document.getElementById('filter-cartera-cliente');
  if(sel) sel.value = '';
  setCarteraEstado('');
}

function reloadCartera() {
  carteraAllCreditos = null;
  loadCartera();
}`;

if(oldJsRegex.test(html)) {
  html = html.replace(oldJsRegex, newJs);
} else {
  console.log('No se encontro el JS viejo para reemplazar.');
}

fs.writeFileSync('frontend/index.html', html);
console.log('HTML y JS inyectados con éxito.');
