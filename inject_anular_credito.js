const fs = require('fs');
const path = 'backend/api/index.js';
let content = fs.readFileSync(path, 'utf8');

const newRoute = `
// Anular cotización (solo si está en estado aprobado)
app.patch('/api/creditos/:id/anular', async (req, res) => {
  try {
    const [[credito]] = await pool.query('SELECT estado FROM creditos WHERE id = ?', [req.params.id]);
    if (!credito) return res.status(404).json({ error: 'Crédito no encontrado' });
    
    if (credito.estado !== 'aprobado') {
      return res.status(403).json({ error: 'Solo se pueden anular cotizaciones que estén en estado Aprobado' });
    }
    
    await pool.query("UPDATE creditos SET estado = 'anulado' WHERE id = ?", [req.params.id]);
    res.json({ ok: true, mensaje: 'Cotización anulada correctamente' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

if(!content.includes('/api/creditos/:id/anular')) {
  content = content.replace("app.get('/api/creditos', async (req, res) => {", newRoute + "\napp.get('/api/creditos', async (req, res) => {");
  fs.writeFileSync(path, content);
  console.log('Endpoint inyectado');
} else {
  console.log('Endpoint ya existia');
}
