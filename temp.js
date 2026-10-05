
let smartPublicData = null;
let smartCart = [];

function formatMoneda(valor) {
  return '$' + parseFloat(valor).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

(function initSmartCommerce() {
  if (window.location.pathname.startsWith('/catalogo')) {
    
    // Función para ocultar la UI original
    const hideAdminUI = () => {
      const login = document.getElementById('modal-login');
      if(login) login.setAttribute('style', 'display: none !important');
      const app = document.getElementById('app-container');
      if(app) app.setAttribute('style', 'display: none !important');
      document.body.style.background = '#f4f6f9';
      document.getElementById('smart-commerce-app').style.display = 'block';
    };

    // Ocultar inmediatamente y también en el onload para pisar el de index.html
    hideAdminUI();
    window.addEventListener('load', () => {
      hideAdminUI();
      setTimeout(hideAdminUI, 100);
      setTimeout(hideAdminUI, 500);
    });
    
    // Load Cart from session storage
    try {
      let saved = sessionStorage.getItem('smartCart');
      if (saved) smartCart = JSON.parse(saved);
    } catch(e) {}
    
    updateSmartCartUI();
    
    // Fetch Catalog Data - ALWAYS fetch latest for /catalogo or /catalogo/
    let slug = window.location.pathname.split('/').pop() || 'latest';
    if (slug === 'catalogo') slug = 'latest';

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
