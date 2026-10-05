const fs = require('fs');
const html = fs.readFileSync('frontend/index.html', 'utf8');
const lines = html.split('\n');
lines.forEach((line, i) => {
  if (line.includes('type="password"')) {
    console.log(`Line ${i}:`, line.trim());
  }
});
