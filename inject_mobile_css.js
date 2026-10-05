const fs = require('fs');
const path = 'frontend/index.html';
let content = fs.readFileSync(path, 'utf8');

const injection = `
  /* Mobile fixes para Cartera */
  .cartera-summary-grid { grid-template-columns: 1fr !important; }
  .cartera-btn-group { flex-wrap: wrap; }
  .cartera-client-select { min-width: 100%; width: 100%; margin-top: 5px; }
  .cartera-filters-bar { flex-direction: column; align-items: stretch; }
  .cartera-filters-left { flex-direction: column; align-items: stretch; }
`;

if (!content.includes('.cartera-summary-grid { grid-template-columns: 1fr !important; }')) {
  // Inject right after @media(max-width:900px){
  content = content.replace('@media(max-width:900px){\n', '@media(max-width:900px){\n' + injection);
  fs.writeFileSync(path, content);
  console.log('Mobile CSS inyectado correctamente.');
} else {
  console.log('Mobile CSS ya estaba inyectado.');
}
