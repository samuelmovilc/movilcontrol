const fs = require('fs');
const path = 'frontend/index.html';
let content = fs.readFileSync(path, 'utf8');

const oldStr = `async function processSale(){
  var planCotizadoId = null;
  if(!cart.length){toast('Agrega productos al carrito','error');return}`;

const newStr = `async function processSale(){
  var planCotizadoId = null;
  if(!cart.length){toast('Agrega productos al carrito','error');return}
  
  var sinStock = cart.filter(function(c) { return typeof c.stock === 'number' && c.cant > c.stock; });
  if (sinStock.length > 0) {
    toast('Stock insuficiente para: ' + sinStock.map(function(c){return c.nombre}).join(', '), 'error');
    return;
  }`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(path, content);
  console.log('Validacion de stock inyectada');
} else {
  console.log('No se encontro el string original, intentando con RegEx...');
  const rx = /async function processSale\(\)\{[\s\S]*?if\(!cart\.length\)\{toast\('Agrega productos al carrito','error'\);return\}/m;
  if(rx.test(content)) {
     content = content.replace(rx, newStr);
     fs.writeFileSync(path, content);
     console.log('Validacion de stock inyectada con regex');
  } else {
     console.log('Fallo al inyectar');
  }
}
