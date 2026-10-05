const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

const css = `
/* Tarjetas de Cartera */
.cartera-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }
.cartera-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 15px; display: flex; align-items: center; gap: 15px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
.cartera-card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; }
.cartera-card.total::before { background: var(--electric); }
.cartera-card.abonos::before { background: var(--green); }
.cartera-card.saldo::before { background: var(--red); }
.cartera-card .c-icon { width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.cartera-card.total .c-icon { background: var(--electric-pale); color: var(--electric-dark); }
.cartera-card.abonos .c-icon { background: #e6f9f0; color: var(--green-dark); }
.cartera-card.saldo .c-icon { background: var(--red-pale); color: var(--red); }
.cartera-card .c-info { flex: 1; }
.cartera-card .c-info h4 { font-size: 11px; text-transform: uppercase; color: var(--text-mid); margin-bottom: 4px; font-weight: 700; letter-spacing: 0.5px; }
.cartera-card .c-info .c-val { font-size: 22px; font-weight: 800; color: var(--text); }
.cartera-card.total .c-info .c-val { color: var(--electric-dark); }

/* Filtros de Cartera */
.cartera-filters-bar { display: flex; gap: 10px; margin-bottom: 15px; align-items: center; background: var(--surface); padding: 10px 15px; border-radius: var(--radius); border: 1px solid var(--border); box-shadow: 0 2px 5px rgba(0,0,0,0.02); flex-wrap: wrap; justify-content: space-between; }
.cartera-filters-left { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.cartera-filters-right { display: flex; gap: 10px; align-items: center; }
.cartera-btn-group { display: flex; gap: 5px; background: var(--surface2); padding: 4px; border-radius: 20px; border: 1px solid var(--border); }
.cartera-state-btn { border: none; background: transparent; padding: 6px 14px; border-radius: 16px; font-size: 11.5px; font-weight: 600; color: var(--text-mid); cursor: pointer; transition: all 0.2s; }
.cartera-state-btn:hover { background: rgba(0,0,0,0.04); }
.cartera-state-btn.active { background: var(--electric); color: #fff; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3); }
.cartera-client-select { padding: 7px 12px; border-radius: 20px; border: 1px solid var(--border); font-size: 12px; outline: none; min-width: 250px; background: #fff; }
`;

if (!html.includes('.cartera-summary-grid')) {
  html = html.replace('</style>', css + '\n</style>');
  fs.writeFileSync('frontend/index.html', html);
  console.log('CSS Insertado con éxito.');
} else {
  console.log('CSS ya existía.');
}
