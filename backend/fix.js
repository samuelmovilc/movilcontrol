const fs = require('fs');
let c = fs.readFileSync('backend/qa_smart_commerce.js', 'utf8');
c = c.replace(/const jsonFake = JSON\.stringify\(\[[\s\S]*?\]\);/, 'const jsonFake = JSON.stringify([{ "id": 1, "emocional": "Test E", "funcional": "Test F", "racional": "Test R" }]);');
fs.writeFileSync('backend/qa_smart_commerce.js', c);
