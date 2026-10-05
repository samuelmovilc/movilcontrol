const fs = require('fs');
let c = fs.readFileSync('frontend/catalogo.html', 'utf8');
c = c.replace(/\\`/g, '`');
c = c.replace(/\\\$/g, '$');
c = c.replace(/\\n/g, '\n');
fs.writeFileSync('frontend/catalogo.html', c);
console.log('Fixed file');
