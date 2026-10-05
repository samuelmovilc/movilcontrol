const fs = require('fs');
let c = fs.readFileSync('frontend/index.html', 'utf8');

c = c.replace(
  "var divCredito = document.createElement('div');\n        divCredito.style.display = 'flex';",
  "var divCredito = document.createElement('div');\n        divCredito.className = 'multi-pay-row';\n        divCredito.style.display = 'flex';"
);

c = c.replace(
  "var divInicial = document.createElement('div');\n        divInicial.style.display = 'flex';",
  "var divInicial = document.createElement('div');\n        divInicial.className = 'multi-pay-row';\n        divInicial.style.display = 'flex';"
);

// Fallbacks for \r\n
c = c.replace(
  "var divCredito = document.createElement('div');\r\n        divCredito.style.display = 'flex';",
  "var divCredito = document.createElement('div');\r\n        divCredito.className = 'multi-pay-row';\r\n        divCredito.style.display = 'flex';"
);

c = c.replace(
  "var divInicial = document.createElement('div');\r\n        divInicial.style.display = 'flex';",
  "var divInicial = document.createElement('div');\r\n        divInicial.className = 'multi-pay-row';\r\n        divInicial.style.display = 'flex';"
);

fs.writeFileSync('frontend/index.html', c);
console.log('Clases CSS multi-pay-row inyectadas correctamente.');
