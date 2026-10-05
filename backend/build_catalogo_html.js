const fs = require('fs');
const code = fs.readFileSync('insert_smart_app_safe.js', 'utf8');
const htmlMatch = code.match(/const appHTML = `([\s\S]*?)`;/);
const jsMatch = code.match(/let smartPublicData = null;[\s\S]*/);

const htmlTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Catálogo Smart Commerce</title>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<style>
body { background: #f4f6f9; margin: 0; font-family: 'Inter', sans-serif; }
</style>
</head>
<body>
${htmlMatch[1]}
<script>
${jsMatch[0]}
</script>
</body>
</html>`;

fs.writeFileSync('frontend/catalogo.html', htmlTemplate);
console.log('catalogo.html creado!');
