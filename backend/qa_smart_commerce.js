const puppeteer = require('puppeteer');

(async () => {
  console.log("Iniciando Pruebas QA Smart Commerce...");
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  // Interceptar window.open
  await page.evaluateOnNewDocument(() => {
    window.openedUrls = [];
    window.open = function(url) {
      window.openedUrls.push(url);
      return null;
    };
  });

  try {
    console.log("[1] Navegando a la app...");
    await page.goto('https://ventanas-lime.vercel.app', { waitUntil: 'networkidle0' });
    
    // 1. PIN Login
    console.log("[2] Ingresando PIN...");
    const pin = '3195122754';
    for (let char of pin) {
      await page.click(`button[onclick="pinPress('${char}')"]`);
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Esperar a que desaparezca la pantalla de PIN y cargue la tabla
    await new Promise(r => setTimeout(r, 2000));
    console.log("[3] Sesión iniciada. Navegando a módulo de Productos...");
    await page.evaluate(() => showModule('productos'));
    await page.waitForSelector('.prod-chk', { timeout: 10000 });
    
    // Seleccionar 5 productos reales
    const checkboxes = await page.$$('.prod-chk');
    if (checkboxes.length < 5) throw new Error("No hay suficientes productos para probar");
    
    for (let i = 0; i < 5; i++) {
      await page.evaluate(cb => cb.click(), checkboxes[i]);
    }
    
    // Click al botón Smart Commerce
    console.log("[4] Abriendo Modal Smart Commerce...");
    await page.evaluate(() => openSmartCommerceWizard());
    
    // Verificar que se abrió el modal
    await page.waitForSelector('#modal-smart-wizard.open', { visible: true, timeout: 5000 });
    const countText = await page.$eval('#smart-selected-count', el => el.innerText);
    console.log("Productos detectados en el modal:", countText);
    if (countText !== '5') throw new Error(`El modal muestra ${countText} en lugar de 5`);
    
    // Simular el avance del Wizard
    console.log("[5] Configurando el Catálogo...");
    await page.type('#smart-catalog-name', ' Catálogo QA Test');
    
    // Next step
    await page.evaluate(() => smartGoToStep2());
    await new Promise(r => setTimeout(r, 500));
    
    // Generar text area (simular pegado de JSON)
    const jsonFake = JSON.stringify([
      { "id": 1, "emocional": "Test E", "funcional": "Test F", "racional": "Test R" }
    ]);
    await page.evaluate((val) => { document.getElementById('smart-json-input').value = val; }, jsonFake);
    
    await page.evaluate(() => smartGoToStep3());
    await new Promise(r => setTimeout(r, 500));
    
    // Publicar
    console.log("[6] Publicando Catálogo...");
    await page.evaluate(() => smartPublish());
    
    // Esperar al link
    await page.waitForSelector('#smart-open-link', { visible: true, timeout: 10000 });
    const publicUrl = await page.$eval('#smart-open-link', el => el.href);
    console.log("Catálogo publicado exitosamente en:", publicUrl);
    
    // Visitar la tienda pública
    console.log("[7] Visitando tienda pública...");
    const publicPage = await browser.newPage();
    
    // Interceptar whatsapp
    await publicPage.evaluateOnNewDocument(() => {
      window.openedUrls = [];
      window.open = function(url) {
        window.openedUrls.push(url);
        return null;
      };
    });
    
    await publicPage.goto(publicUrl, { waitUntil: 'networkidle0' });
    
    // Verificar productos
    const cards = await publicPage.$$('.smart-card');
    console.log(`Tienda cargada. Tarjetas mostradas: ${cards.length}`);
    
    // Agregar al carrito
    console.log("[8] Probando carrito...");
    const addBtns = await publicPage.$$('.smart-btn-add');
    if (addBtns.length > 0) {
      await addBtns[0].click();
      await new Promise(r => setTimeout(r, 200));
      await addBtns[0].click(); // qty 2
      await new Promise(r => setTimeout(r, 200));
      
      const cartCount = await publicPage.$eval('#smart-cart-count', el => el.innerText);
      console.log("Items en carrito:", cartCount);
      
      // Open cart
      await publicPage.evaluate(() => openSmartCart());
      await new Promise(r => setTimeout(r, 500));
      
      // Checkout
      await publicPage.evaluate(() => checkoutSmartCart());
      await new Promise(r => setTimeout(r, 500));
      
      const openedUrls = await publicPage.evaluate(() => window.openedUrls);
      console.log("WhatsApp URL abierta:", openedUrls[0]);
    }

    console.log("=================================");
    console.log("PRUEBAS E2E COMPLETADAS CON ÉXITO");
    console.log("=================================");

  } catch (err) {
    console.error("ERROR EN PRUEBAS QA:", err);
    try { await page.screenshot({ path: 'backend/error_screenshot.png' }); } catch(e){}
  } finally {
    await browser.close();
  }
})();
