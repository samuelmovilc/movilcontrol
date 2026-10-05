const fs = require('fs');
const path = 'frontend/index.html';
let content = fs.readFileSync(path, 'utf8');

const targetLineOld = `(c.estado === 'activo' ? ' <button class="btn btn-primary btn-xs" onclick="abrirAbonoRapido(' + c.id + ')"><i class="fa-solid fa-money-bill-wave"></i> Abonar</button>' : '') +`;
const targetLineNew = `(c.estado === 'activo' ? ' <button class="btn btn-primary btn-xs" onclick="abrirAbonoRapido(' + c.id + ')"><i class="fa-solid fa-money-bill-wave"></i> Abonar</button>' : '') +
           (c.estado === 'aprobado' ? ' <button class="btn btn-danger btn-xs" onclick="anularCotizacion(' + c.id + ')"><i class="fa-solid fa-ban"></i> Anular</button>' : '') +`;

if(content.includes(targetLineOld)) {
  content = content.replace(targetLineOld, targetLineNew);
} else {
  console.log('No se encontro la linea vieja para el boton anular');
}

const funcAnular = `
async function anularCotizacion(id) {
  confirmDlg('Anular Cotización', '¿Estás seguro de anular la cotización CR-' + id + '? Esta acción no se puede deshacer.', async function() {
    showLoading('Anulando...');
    try {
      await apiPatch('/creditos/' + id + '/anular');
      toast('Cotización anulada', 'success');
      reloadCartera();
    } catch(e) {
      toast('Error: ' + e.message, 'error');
    }
    hideLoading();
  });
}
`;

if(!content.includes('async function anularCotizacion')) {
  content = content.replace("async function verDetalleCredito(id) {", funcAnular + "\nasync function verDetalleCredito(id) {");
  fs.writeFileSync(path, content);
  console.log('Botón y función anular inyectados');
} else {
  console.log('La funcion anularCotizacion ya existía');
}
