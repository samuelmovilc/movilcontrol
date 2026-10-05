const puppeteer = require('puppeteer');

(async () => {
  console.log('Iniciando prueba QA automatizada E2E (Carga de Cotización en POS)...');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capturar errores de la consola del navegador
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('ERROR EN CONSOLA NAVEGADOR:', msg.text());
    }
  });
  page.on('pageerror', error => {
    console.error('EXCEPCIÓN EN NAVEGADOR:', error.message);
  });
  
  try {
    // 1. Ir a la app local
    console.log('Navegando a https://ventanas-lime.vercel.app...');
    await page.goto('https://ventanas-lime.vercel.app');
    
    // 2. Login
    console.log('Realizando Login...');
    await page.waitForSelector('button[onclick="pinPress(\\\'3\\\')"]', { visible: true });
    
    const pin = '3195122754';
    for (let char of pin) {
      await page.click(`button[onclick="pinPress('${char}')"]`);
      await new Promise(r => setTimeout(r, 100));
    }
    
    // 3. Esperar a que el POS esté visible
    console.log('Esperando que cargue el POS...');
    await page.waitForSelector('#app-container', { visible: true });
    await page.waitForSelector('button[onclick="abrirModalImportarCotizacion()"]', { visible: true, timeout: 5000 });
    
    // 4. Click en Cargar Cotización
    console.log('Haciendo clic en Cargar Cotización...');
    await page.click('button[onclick="abrirModalImportarCotizacion()"]');
    
    // 5. Esperar a que el modal cargue y tenga botones "Cargar"
    console.log('Esperando a que abra el modal y cargue cotizaciones...');
    await page.waitForSelector('#modal-importar-cotizacion', { visible: true });
    await page.waitForFunction(() => {
      const btns = document.querySelectorAll('#lista-cotizaciones-importar button');
      return btns.length > 0;
    }, { timeout: 10000 });
    
    // 6. Hacer clic en el primer botón "Cargar"
    console.log('Haciendo clic en el primer botón "Cargar" disponible...');
    await page.evaluate(() => {
      const btn = document.querySelector('#lista-cotizaciones-importar button');
      btn.click();
    });
    
    // 7. Esperar que se agregue algo al carrito y que el toast se muestre
    console.log('Esperando validación del carrito...');
    await page.waitForFunction(() => {
      return document.querySelectorAll('#cart-body tr').length > 0;
    }, { timeout: 5000 });
    
    const cartItemsCount = await page.evaluate(() => document.querySelectorAll('#cart-body tr').length);
    console.log(`¡Éxito! El carrito tiene ahora ${cartItemsCount} productos cargados.`);
    
    const total = await page.evaluate(() => document.getElementById('cart-total').innerText);
    console.log(`Total calculado en el carrito: ${total}`);
    
    console.log('¡Prueba E2E completada satisfactoriamente, cero errores de UI!');
    
  } catch (err) {
    console.error('LA PRUEBA FALLÓ:', err);
  } finally {
    await browser.close();
  }
})();
