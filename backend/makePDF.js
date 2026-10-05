const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ margin: 50, size: 'A4' });
doc.pipe(fs.createWriteStream('C:\\Users\\SAMUEL CARIBEP\\Desktop\\Guia_Inventario.pdf'));

doc.fontSize(22).fillColor('#0056b3').text('Guia para Carga Masiva de Inventario', { align: 'center' });
doc.moveDown(2);

doc.fontSize(14).fillColor('#333333').text('Hola, como estas? A continuacion te dejo una guia sencilla paso a paso para actualizar tu inventario de forma rapida cuando te llega mercancia nueva del proveedor:');
doc.moveDown(1.5);

doc.fontSize(16).fillColor('#0056b3').text('Paso 1: Descarga tu inventario actual', { underline: true });
doc.moveDown(0.5);
doc.fontSize(14).fillColor('#333333')
   .text('IMPORTANTE: Para no equivocarte nunca y evitar que el inventario se descuadre, lo primero que debes hacer es ir a la pestana "Productos" y darle clic al boton verde oscuro que dice "Exportar Inventario".')
   .moveDown(0.5)
   .text('Esto descargara un archivo de Excel con tus cantidades exactas al dia de hoy para que trabajes sobre seguro.');
doc.moveDown(1.5);

doc.fontSize(16).fillColor('#0056b3').text('Paso 2: Prepara tu archivo de Excel', { underline: true });
doc.moveDown(0.5);
doc.fontSize(14).fillColor('#333333')
   .text('Abre en tu computadora el archivo de Excel que acabas de descargar.')
   .moveDown(0.5)
   .text('Si te llegaron productos que ya vendias antes, buscalo en la lista y en la columna de cantidad (Stock), borra el numero viejo y escribe la cantidad TOTAL que tienes ahora. (Ejemplo: Si tenias 2 cuadernos, y llegaron 10, vas a escribir el numero 12).')
   .moveDown(0.5)
   .text('Si te llegaron articulos totalmente nuevos que nunca habias vendido, vete al final de la lista, a una fila en blanco, y escribe su informacion: Codigo de barras, nombre, precio y cantidad que te llego.');
doc.moveDown(1.5);

doc.fontSize(16).fillColor('#0056b3').text('Paso 3: Guarda tu archivo', { underline: true });
doc.moveDown(0.5);
doc.fontSize(14).fillColor('#333333')
   .text('Cuando termines de acomodar tus numeros, dale clic en "Guardar" y asegurate de que el formato siga siendo CSV (valores separados por comas).');
doc.moveDown(1.5);

doc.fontSize(16).fillColor('#0056b3').text('Paso 4: Sube todo al sistema', { underline: true });
doc.moveDown(0.5);
doc.fontSize(14).fillColor('#333333')
   .text('1. Vuelve a la pestana "Productos" en tu programa de ventas.')
   .moveDown(0.2)
   .text('2. Busca el boton verde claro que dice "Importar CSV" y dale un clic.')
   .moveDown(0.2)
   .text('3. Se abrira una ventanita de tu computadora. Ahi solo selecciona el archivo de Excel que guardaste en el Paso 3.');
doc.moveDown(1.5);

doc.fontSize(16).fillColor('#28a745').text('Y listo! El sistema hara toda la magia.', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(14).fillColor('#333333')
   .text('Automaticamente leera el archivo y acomodara todo. Lo que ya tenias lo va a actualizar con tus nuevas cantidades, y lo que es nuevo lo agregara solito a tu lista. No te preocupes, el programa es muy inteligente y no te va a duplicar nada.', { align: 'center' });

doc.end();
console.log('PDF generado con exito.');
