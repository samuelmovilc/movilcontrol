const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend', 'index.html');
let content = fs.readFileSync(file, 'utf8');

const appHTML = `
<!-- SMART COMMERCE PUBLIC APP -->
<div id="smart-commerce-app" style="display:none; background: #f4f6f9; min-height: 100vh; font-family: 'Inter', sans-serif;">
  
  <!-- Estilos inyectados para el catálogo público -->
  <style>
    #smart-commerce-app { color: #333; }
    .smart-header { background: #fff; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); position: sticky; top: 0; z-index: 100; }
    .smart-header-brand { font-size: 20px; font-weight: bold; color: #10b981; display: flex; align-items: center; gap: 10px; }
    .smart-header-brand img { max-height: 40px; }
    .smart-cart-btn { background: #10b981; color: white; border: none; padding: 10px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; position: relative; }
    .smart-cart-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; display: flex; align-items: center; justify-content: center; }
    
    .smart-hero { background: linear-gradient(135deg, #10b981, #3b82f6); color: white; text-align: center; padding: 60px 20px; margin-bottom: 30px; }
    .smart-hero h1 { font-size: 32px; margin-bottom: 10px; }
    .smart-hero p { font-size: 18px; opacity: 0.9; }

    .smart-container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    .smart-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px; margin-bottom: 50px; }
    
    .smart-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); transition: transform 0.2s; display: flex; flex-direction: column; }
    .smart-card:hover { transform: translateY(-5px); }
    .smart-card-img { width: 100%; height: 200px; object-fit: contain; background: #fff; border-bottom: 1px solid #eee; padding: 10px; }
    .smart-card-body { padding: 20px; flex-grow: 1; display: flex; flex-direction: column; }
    .smart-card-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #1f2937; }
    
    .smart-angles { margin-bottom: 15px; flex-grow: 1; }
    .smart-angle { background: #f0fdf4; border-left: 3px solid #10b981; padding: 10px; font-size: 13px; color: #374151; margin-bottom: 8px; border-radius: 0 6px 6px 0; }
    .smart-angle strong { color: #10b981; display: block; margin-bottom: 3px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .smart-card-price { font-size: 22px; font-weight: bold; color: #10b981; margin-bottom: 15px; }
    .smart-card-actions { display: flex; gap: 10px; margin-top: auto; }
    .smart-btn-add { flex: 1; background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
    .smart-btn-add:hover { background: #2563eb; }
    .smart-btn-wa { background: #25D366; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; width: 45px; display: flex; align-items: center; justify-content: center; font-size: 18px; }

    /* Trust Section */
    .smart-trust { background: #fff; padding: 40px 20px; text-align: center; border-top: 1px solid #eee; margin-top: 50px; }
    .smart-trust-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 30px; max-width: 1000px; margin: 0 auto; }
    .smart-trust-item i { font-size: 30px; color: #10b981; margin-bottom: 15px; }
    .smart-trust-item h4 { margin-bottom: 10px; font-size: 16px; }
    .smart-trust-item p { font-size: 13px; color: #6b7280; }

    /* Footer */
    .smart-footer { background: #1f2937; color: white; padding: 40px 20px; text-align: center; }

    /* Drawer / Modal Carrito */
    .smart-drawer-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.5); z-index: 1000; display: none; }
    .smart-drawer { position: fixed; top:0; right: -400px; bottom:0; width: 400px; max-width: 100%; background: #fff; z-index: 1001; transition: right 0.3s; display: flex; flex-direction: column; box-shadow: -5px 0 15px rgba(0,0,0,0.1); }
    .smart-drawer.open { right: 0; }
    .smart-drawer-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
    .smart-drawer-body { padding: 20px; overflow-y: auto; flex-grow: 1; }
    .smart-drawer-footer { padding: 20px; border-top: 1px solid #eee; background: #f9fafb; }
    
    .smart-cart-item { display: flex; gap: 15px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
    .smart-cart-item-img { width: 60px; height: 60px; object-fit: contain; border-radius: 6px; border: 1px solid #eee; }
    .smart-cart-item-info { flex-grow: 1; }
    .smart-cart-item-title { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
    .smart-cart-item-price { color: #10b981; font-weight: bold; font-size: 13px; margin-bottom: 8px; }
    .smart-qty-ctrl { display: flex; align-items: center; gap: 10px; }
    .smart-qty-btn { background: #eee; border: none; width: 25px; height: 25px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    .smart-qty-val { font-size: 13px; font-weight: bold; width: 20px; text-align: center; }
    
    .smart-btn-checkout { background: #25D366; color: white; width: 100%; padding: 15px; border: none; border-radius: 8px; font-weight: bold; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
  </style>

  <header class="smart-header">
    <div class="smart-header-brand">
      <span id="smart-public-logo-container"></span>
      <span id="smart-public-name">Catálogo</span>
    </div>
    <button class="smart-cart-btn" onclick="openSmartCart()">
      <i class="fa-solid fa-shopping-cart"></i> Mi Pedido
      <div class="smart-cart-badge" id="smart-cart-count">0</div>
    </button>
  </header>

  <section class="smart-hero">
    <h1 id="smart-public-title">Bienvenidos a nuestro Catálogo</h1>
    <p>Descubre productos que hacen mejor tu día</p>
  </section>

  <div class="smart-container">
    <div class="smart-grid" id="smart-public-grid">
      <!-- Productos inyectados por JS -->
      <div style="text-align:center; padding: 50px; grid-column: 1 / -1;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i> Cargando catálogo...</div>
    </div>
  </div>

  <section class="smart-trust">
    <div class="smart-trust-grid">
      <div class="smart-trust-item">
        <i class="fa-solid fa-shield-halved"></i>
        <h4>Compra Segura</h4>
        <p>Tu solicitud es procesada de forma segura por un asesor humano.</p>
      </div>
      <div class="smart-trust-item">
        <i class="fa-solid fa-star"></i>
        <h4>Calidad Garantizada</h4>
        <p>Productos verificados antes de cada envío.</p>
      </div>
      <div class="smart-trust-item">
        <i class="fa-brands fa-whatsapp"></i>
        <h4>Atención Directa</h4>
        <p>Escríbenos y un asesor te atenderá al instante.</p>
      </div>
    </div>
  </section>

  <footer class="smart-footer">
    <h3 id="smart-footer-name">Catálogo</h3>
    <p>Todos los derechos reservados &copy; 2026</p>
  </footer>

  <!-- Drawer Carrito -->
  <div class="smart-drawer-overlay" id="smart-drawer-overlay" onclick="closeSmartCart()"></div>
  <div class="smart-drawer" id="smart-drawer">
    <div class="smart-drawer-header">
      <h3>Tu Pedido</h3>
      <button style="background:none; border:none; font-size:20px; cursor:pointer;" onclick="closeSmartCart()"><i class="fa-solid fa-times"></i></button>
    </div>
    <div class="smart-drawer-body" id="smart-cart-items">
      <!-- Items carrito -->
      <div style="text-align:center; padding:30px; color:#999;">El carrito está vacío</div>
    </div>
    <div class="smart-drawer-footer">
      <div id="smart-cart-total-container" style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:18px; font-weight:bold;">
        <span>Total Estimado:</span>
        <span id="smart-cart-total" style="color:#10b981;">$0</span>
      </div>
      <button class="smart-btn-checkout" onclick="checkoutSmartCart()"><i class="fa-brands fa-whatsapp"></i> Confirmar por WhatsApp</button>
      <p style="font-size:11px; text-align:center; margin-top:10px; color:#666;">La compra queda pendiente de confirmación por el asesor.</p>
    </div>
  </div>

</div>
`;

const appJS = `
<script>
// --- SMART COMMERCE PUBLIC LOGIC ---
let smartPublicData = null;
let smartCart = [];

(function initSmartCommerce() {
  if (window.location.pathname.startsWith('/catalogo/')) {
    // Hide admin UI
    document.getElementById('modal-login').style.display = 'none';
    document.getElementById('app-container').style.display = 'none';
    
    // Show Smart App
    document.getElementById('smart-commerce-app').style.display = 'block';
    
    // Load Cart from session storage
    try {
      let saved = sessionStorage.getItem('smartCart');
      if (saved) smartCart = JSON.parse(saved);
    } catch(e) {}
    
    updateSmartCartUI();
    
    // Fetch Catalog Data
    const slug = window.location.pathname.split('/').pop();
    fetch('/api/catalogos/' + slug)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          document.getElementById('smart-public-grid').innerHTML = '<div style="text-align:center; padding: 50px; grid-column: 1 / -1; color:red;"><h3>' + data.error + '</h3></div>';
          return;
        }
        smartPublicData = data;
        renderSmartCatalog();
      })
      .catch(e => {
        document.getElementById('smart-public-grid').innerHTML = '<div style="text-align:center; padding: 50px; grid-column: 1 / -1; color:red;"><h3>Error de conexión</h3></div>';
      });
  }
})();

function renderSmartCatalog() {
  const config = smartPublicData.configuracion;
  const prods = smartPublicData.productos;
  
  // Header
  document.getElementById('smart-public-name').innerText = config.nombre;
  document.getElementById('smart-public-title').innerText = config.nombre;
  document.getElementById('smart-footer-name').innerText = config.nombre;
  
  if (config.logo) {
    document.getElementById('smart-public-logo-container').innerHTML = \`<img src="\${config.logo}" alt="Logo">\`;
  }
  
  // Hide total if prices disabled
  if (!config.mostrarPrecios) {
    document.getElementById('smart-cart-total-container').style.display = 'none';
  }
  
  let gridHtml = '';
  prods.forEach(p => {
    let imgHtml = p.imagen ? \`<img src="\${p.imagen}" class="smart-card-img" onerror="this.src='https://via.placeholder.com/300?text=Sin+Imagen'">\` 
                           : \`<div class="smart-card-img" style="display:flex;align-items:center;justify-content:center;background:#eee;color:#aaa;"><i class="fa-solid fa-image fa-3x"></i></div>\`;
                           
    let priceHtml = config.mostrarPrecios ? \`<div class="smart-card-price">\${formatMoneda(p.precio_venta)}</div>\` : '';
    
    let angles = p.smart_angles || {
      emocional: "Descubre productos que hacen mejor tu día.",
      funcional: "Ideal para tus necesidades cotidianas.",
      racional: "Excelente relación calidad-precio."
    };
    
    // Use an array of angles to show a random one or all. We will show the Emocional and Racional.
    let angleHtml = \`
      <div class="smart-angles">
        <div class="smart-angle"><strong>Especial para ti</strong>\${angles.emocional}</div>
        <div class="smart-angle"><strong>Características</strong>\${angles.racional}</div>
      </div>
    \`;
    
    gridHtml += \`
      <div class="smart-card">
        \${imgHtml}
        <div class="smart-card-body">
          <div class="smart-card-title">\${p.nombre}</div>
          \${angleHtml}
          \${priceHtml}
          <div class="smart-card-actions">
            <button class="smart-btn-add" onclick="addToSmartCart(\${p.id})"><i class="fa-solid fa-cart-plus"></i> Agregar</button>
            <button class="smart-btn-wa" onclick="waInquire(\${p.id})"><i class="fa-brands fa-whatsapp"></i></button>
          </div>
        </div>
      </div>
    \`;
  });
  
  document.getElementById('smart-public-grid').innerHTML = gridHtml;
}

function addToSmartCart(id) {
  const p = smartPublicData.productos.find(x => x.id == id);
  if (!p) return;
  
  let item = smartCart.find(x => x.id == id);
  if (item) {
    item.qty++;
  } else {
    smartCart.push({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio_venta || 0,
      imagen: p.imagen || '',
      qty: 1
    });
  }
  
  saveSmartCart();
  updateSmartCartUI();
  
  // Feedback
  let btn = document.querySelector(\`.smart-btn-add[onclick="addToSmartCart(\${id})"]\`);
  if (btn) {
    let orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Agregado';
    btn.style.background = '#10b981';
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = '#3b82f6'; }, 1000);
  }
}

function updateSmartCartQty(id, delta) {
  let item = smartCart.find(x => x.id == id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    smartCart = smartCart.filter(x => x.id != id);
  }
  saveSmartCart();
  updateSmartCartUI();
}

function saveSmartCart() {
  sessionStorage.setItem('smartCart', JSON.stringify(smartCart));
}

function updateSmartCartUI() {
  let totalQty = 0;
  let totalPrice = 0;
  let html = '';
  
  const showPrices = smartPublicData ? smartPublicData.configuracion.mostrarPrecios : true;
  
  smartCart.forEach(item => {
    totalQty += item.qty;
    totalPrice += (item.precio * item.qty);
    
    let imgHtml = item.imagen ? \`<img src="\${item.imagen}" class="smart-cart-item-img">\` : \`<div class="smart-cart-item-img" style="background:#eee;"></div>\`;
    let priceHtml = showPrices ? \`<div class="smart-cart-item-price">\${formatMoneda(item.precio * item.qty)}</div>\` : '';
    
    html += \`
      <div class="smart-cart-item">
        \${imgHtml}
        <div class="smart-cart-item-info">
          <div class="smart-cart-item-title">\${item.nombre}</div>
          \${priceHtml}
          <div class="smart-qty-ctrl">
            <button class="smart-qty-btn" onclick="updateSmartCartQty(\${item.id}, -1)">-</button>
            <div class="smart-qty-val">\${item.qty}</div>
            <button class="smart-qty-btn" onclick="updateSmartCartQty(\${item.id}, 1)">+</button>
          </div>
        </div>
      </div>
    \`;
  });
  
  if (smartCart.length === 0) {
    html = '<div style="text-align:center; padding:30px; color:#999;">El carrito está vacío</div>';
  }
  
  document.getElementById('smart-cart-count').innerText = totalQty;
  document.getElementById('smart-cart-items').innerHTML = html;
  document.getElementById('smart-cart-total').innerText = formatMoneda(totalPrice);
}

function openSmartCart() {
  document.getElementById('smart-drawer-overlay').style.display = 'block';
  // delay for reflow
  setTimeout(() => document.getElementById('smart-drawer').classList.add('open'), 10);
}

function closeSmartCart() {
  document.getElementById('smart-drawer').classList.remove('open');
  setTimeout(() => document.getElementById('smart-drawer-overlay').style.display = 'none', 300);
}

function waInquire(id) {
  const p = smartPublicData.productos.find(x => x.id == id);
  if (!p) return;
  const config = smartPublicData.configuracion;
  const waNum = config.whatsapp || '573002397590';
  
  let msg = \`Hola, estoy interesado en este producto de su catálogo.\\n\\n\`;
  msg += \`Catálogo: \${config.nombre}\\n\`;
  msg += \`Producto: \${p.nombre}\\n\`;
  msg += \`Cantidad: 1\\n\\n\`;
  msg += \`¿Podrían brindarme más información?\`;
  
  window.open('https://wa.me/' + waNum + '?text=' + encodeURIComponent(msg), '_blank');
}

function checkoutSmartCart() {
  if (smartCart.length === 0) return;
  const config = smartPublicData.configuracion;
  const waNum = config.whatsapp || '573002397590';
  const showPrices = config.mostrarPrecios;
  
  let msg = \`Hola, quiero realizar un pedido a través de BETTER PLACE DIGITAL.\\n\\n\`;
  msg += \`CATÁLOGO: \${config.nombre}\\n\\n\`;
  msg += \`MI PEDIDO:\\n\`;
  
  let total = 0;
  smartCart.forEach(item => {
    msg += \`✅ \${item.nombre} x \${item.qty}\\n\`;
    total += (item.precio * item.qty);
  });
  
  if (showPrices) {
    msg += \`\\nTotal Estimado: \${formatMoneda(total)}\\n\`;
  }
  
  msg += \`\\nQuiero confirmar disponibilidad, condiciones de entrega y forma de pago.\\nQuedo atento a la confirmación de un asesor.\`;
  
  window.open('https://wa.me/' + waNum + '?text=' + encodeURIComponent(msg), '_blank');
}
</script>
`;

// Insert HTML before closing </body>
content = content.replace('</body>', appHTML + '\n</body>');
// Insert JS before closing </body>
content = content.replace('</body>', appJS + '\n</body>');

fs.writeFileSync(file, content, 'utf8');
console.log('App Pública Inyectada con éxito');
