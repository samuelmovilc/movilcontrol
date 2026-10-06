const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');
const lines = html.split('\n');
const fixedLines = [];
let skip = false;
for(let i=0; i<lines.length; i++) {
  if(i === 2469) {
    fixedLines.push('  var h=\'<html><head><title>Códigos</title><style>body{margin:0;padding:6px;font-family:monospace}.bc{display:inline-block;margin:4px;text-align:center;border:1px solid #ddd;padding:4px;width:74mm;page-break-inside:avoid}svg{width:100%}p{margin:2px 0;font-size:10px}@media print{@page{size:80mm auto;margin:2mm}}</style><script src=\"https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js\"></script></head><body>\';');
    skip = true;
  }
  if(skip && lines[i].includes('</head><body>\'')) {
    skip = false;
    continue;
  }
  if(!skip && i !== 2469) {
    fixedLines.push(lines[i]);
  }
}
fs.writeFileSync('frontend/index.html', fixedLines.join('\n'), 'utf8');
console.log('Fixed syntax error in index.html');
