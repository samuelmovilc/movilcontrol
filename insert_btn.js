const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend', 'index.html');
let content = fs.readFileSync(file, 'utf8');

const targetStr = '<button class="btn btn-excel" onclick="exportExcel()"><i class="fa-solid fa-file-excel"></i> Exportar Inventario</button>';
const replacementStr = `<button class="btn" style="background: linear-gradient(135deg, #10b981, #3b82f6); color:#fff; border:none; border-radius: 6px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);" onclick="openSmartCommerceWizard()"><i class="fa-solid fa-store"></i> CATÁLOGO SMART COMMERCE</button>\n    ${targetStr}`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Botón insertado con éxito');
} else {
  console.log('No se encontró el target string');
}
