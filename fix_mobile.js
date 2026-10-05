const fs = require('fs');
let file = 'frontend/index.html';
let content = fs.readFileSync(file, 'utf8');

// Reemplazo CSS con CSS fluido
content = content.replace(
  '.cartera-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }',
  '.cartera-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 15px; margin-bottom: 15px; }'
);

content = content.replace(
  '.cartera-btn-group { display: flex; gap: 5px; background: var(--surface2); padding: 4px; border-radius: 20px; border: 1px solid var(--border); }',
  '.cartera-btn-group { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; background: var(--surface2); padding: 4px; border-radius: 20px; border: 1px solid var(--border); }'
);

fs.writeFileSync(file, content);
console.log('Mobile fluido aplicado!');
