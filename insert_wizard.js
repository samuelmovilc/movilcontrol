const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend', 'index.html');
let content = fs.readFileSync(file, 'utf8');

const wizardHTML = `
<!-- SMART COMMERCE WIZARD MODAL -->
<div class="modal-overlay" id="modal-smart-wizard" style="display:none; z-index:9999;">
  <div class="modal" style="width: 800px; max-width: 95vw; max-height: 90vh; overflow-y: auto;">
    <div class="modal-header" style="background: linear-gradient(135deg, #10b981, #3b82f6); color: white;">
      <h3><i class="fa-solid fa-store"></i> Crear Catálogo Smart Commerce</h3>
      <button class="close-btn" onclick="closeModal('modal-smart-wizard')" style="color: white;"><i class="fa-solid fa-times"></i></button>
    </div>
    <div class="modal-body">
      
      <!-- STEP 1: Seleccion -->
      <div id="smart-step-1" class="smart-step">
        <h4 style="color: var(--electric); margin-bottom: 15px;"><i class="fa-solid fa-1"></i> Paso 1: Confirmar Productos</h4>
        <p>Se han seleccionado <strong id="smart-selected-count">0</strong> productos para este catálogo.</p>
        <div style="max-height: 200px; overflow-y: auto; background: #f9f9f9; padding: 10px; border-radius: 6px; margin-bottom: 15px; border: 1px solid #ddd;" id="smart-products-list"></div>
        <button class="btn btn-primary" style="width: 100%" onclick="smartGoToStep2()">Continuar al Paso 2 <i class="fa-solid fa-arrow-right"></i></button>
      </div>

      <!-- STEP 2: Generar Prompt IA -->
      <div id="smart-step-2" class="smart-step" style="display:none;">
        <h4 style="color: var(--electric); margin-bottom: 15px;"><i class="fa-solid fa-2"></i> Paso 2: Generar Ángulos de Venta (IA)</h4>
        <p>Copia el siguiente Prompt y pégalo en Claude o ChatGPT para que la IA genere los textos persuasivos de tus productos.</p>
        <textarea id="smart-prompt-text" class="form-control" style="height: 150px; font-family: monospace; font-size: 12px; margin-bottom: 10px;" readonly></textarea>
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
          <button class="btn btn-warning" onclick="copySmartPrompt()"><i class="fa-solid fa-copy"></i> Copiar Prompt</button>
        </div>
        <button class="btn btn-primary" style="width: 100%" onclick="smartGoToStep3()">Ya tengo el JSON, Continuar al Paso 3 <i class="fa-solid fa-arrow-right"></i></button>
        <button class="btn btn-secondary" style="width: 100%; margin-top: 10px;" onclick="smartGoToStep1()"><i class="fa-solid fa-arrow-left"></i> Volver</button>
      </div>

      <!-- STEP 3: Pegar JSON y Configurar -->
      <div id="smart-step-3" class="smart-step" style="display:none;">
        <h4 style="color: var(--electric); margin-bottom: 15px;"><i class="fa-solid fa-3"></i> Paso 3: Configurar y Pegar JSON</h4>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div class="form-group">
            <label>Nombre del Catálogo</label>
            <input type="text" id="smart-catalog-name" class="form-control" placeholder="Ej. Colección Verano">
          </div>
          <div class="form-group">
            <label>URL Logo (Opcional)</label>
            <input type="text" id="smart-catalog-logo" class="form-control" placeholder="https://...">
          </div>
          <div class="form-group">
            <label>Mostrar Precios</label>
            <select id="smart-catalog-prices" class="form-control">
              <option value="1">Sí, mostrar precios</option>
              <option value="0">No, solo catálogo</option>
            </select>
          </div>
          <div class="form-group">
            <label>WhatsApp de Contacto</label>
            <input type="text" id="smart-catalog-wa" class="form-control" value="573002397590">
          </div>
        </div>

        <label>Pega aquí el JSON devuelto por la IA:</label>
        <textarea id="smart-json-input" class="form-control" style="height: 120px; font-family: monospace; font-size: 12px; margin-bottom: 15px;" placeholder='[{"id": 1, "emocional": "...", "funcional": "...", "racional": "..."}]'></textarea>
        
        <button class="btn btn-success" style="width: 100%; background: linear-gradient(135deg, #10b981, #3b82f6); border:none;" onclick="smartPublish()"><i class="fa-solid fa-rocket"></i> Validar y Publicar Catálogo</button>
        <button class="btn btn-secondary" style="width: 100%; margin-top: 10px;" onclick="smartGoToStep2()"><i class="fa-solid fa-arrow-left"></i> Volver</button>
      </div>

      <!-- STEP 4: Exito -->
      <div id="smart-step-4" class="smart-step" style="display:none; text-align: center;">
        <i class="fa-solid fa-circle-check" style="font-size: 60px; color: #10b981; margin-bottom: 20px;"></i>
        <h3 style="color: #10b981; margin-bottom: 10px;">¡Catálogo Publicado con Éxito!</h3>
        <p>Tu Smart Commerce Experience está lista.</p>
        <input type="text" id="smart-public-url" class="form-control" style="text-align: center; margin: 20px 0; font-weight: bold; font-size: 16px;" readonly>
        
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button class="btn btn-primary" onclick="copySmartUrl()"><i class="fa-solid fa-copy"></i> Copiar Link</button>
          <button class="btn btn-success" onclick="shareSmartWA()"><i class="fa-brands fa-whatsapp"></i> Compartir</button>
          <a id="smart-open-link" href="#" target="_blank" class="btn btn-warning"><i class="fa-solid fa-external-link"></i> Abrir</a>
        </div>
      </div>

    </div>
  </div>
</div>
`;

const wizardJS = `
<script>
// --- SMART COMMERCE WIZARD LOGIC ---
let smartSelectedProducts = [];

function openSmartCommerceWizard() {
  const ids = getSelectedProducts();
  if (!ids.length) {
    toast('Selecciona al menos un producto', 'error');
    return;
  }
  
  smartSelectedProducts = productosCache.filter(p => ids.includes(p.id));
  document.getElementById('smart-selected-count').innerText = smartSelectedProducts.length;
  
  let listHtml = '';
  smartSelectedProducts.forEach(p => {
    listHtml += \`<div style="font-size:12px; padding: 3px 0; border-bottom: 1px solid #eee;">\${p.nombre} (ID: \${p.id})</div>\`;
  });
  document.getElementById('smart-products-list').innerHTML = listHtml;
  
  // Reset UI
  document.querySelectorAll('.smart-step').forEach(el => el.style.display = 'none');
  document.getElementById('smart-step-1').style.display = 'block';
  document.getElementById('smart-json-input').value = '';
  document.getElementById('smart-catalog-name').value = 'Catálogo ' + new Date().toLocaleDateString();
  
  openModal('modal-smart-wizard');
}

function smartGoToStep1() {
  document.querySelectorAll('.smart-step').forEach(el => el.style.display = 'none');
  document.getElementById('smart-step-1').style.display = 'block';
}

function smartGoToStep2() {
  document.querySelectorAll('.smart-step').forEach(el => el.style.display = 'none');
  document.getElementById('smart-step-2').style.display = 'block';
  
  // Generate Prompt
  let prodsList = smartSelectedProducts.map(p => \`ID: \${p.id} | Nombre: \${p.nombre}\`).join('\\n');
  
  let promptText = \`Actúa como un experto en copywriting para e-commerce. Genera textos de alta conversión para los siguientes productos.
Para cada producto, genera 3 ángulos de venta con nombres llamativos:
1. Emocional / Aspiracional
2. Funcional
3. Racional (sin descripciones técnicas extensas)
Textos cortos, naturales que deriven opciones del producto.

Dame EXACTAMENTE la respuesta en el siguiente formato JSON puro (sin formato markdown \` + \`\`\`json\`:
[
  {
    "id": "ID_DEL_PRODUCTO",
    "emocional": "Texto emocional corto...",
    "funcional": "Texto funcional corto...",
    "racional": "Texto racional corto..."
  }
]

Lista de Productos:
\${prodsList}
\`;

  document.getElementById('smart-prompt-text').value = promptText;
}

function copySmartPrompt() {
  const copyText = document.getElementById("smart-prompt-text");
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  document.execCommand("copy");
  toast('Prompt copiado al portapapeles', 'success');
}

function smartGoToStep3() {
  document.querySelectorAll('.smart-step').forEach(el => el.style.display = 'none');
  document.getElementById('smart-step-3').style.display = 'block';
}

async function smartPublish() {
  const jsonInput = document.getElementById('smart-json-input').value.trim();
  let aiData = [];
  
  if (jsonInput) {
    try {
      aiData = JSON.parse(jsonInput);
    } catch(e) {
      toast('El JSON de la IA es inválido. Por favor revisa el formato.', 'error');
      return;
    }
  }
  
  // Merge AI data with products
  let finalProducts = smartSelectedProducts.map(p => {
    let copy = { ...p };
    // Find AI data for this ID
    let aiMatch = aiData.find(a => a.id == p.id || String(a.id) == String(p.id));
    if (aiMatch) {
      copy.smart_angles = {
        emocional: aiMatch.emocional || '',
        funcional: aiMatch.funcional || '',
        racional: aiMatch.racional || ''
      };
    } else {
      // Genérico si falla
      copy.smart_angles = {
        emocional: "Descubre productos que hacen mejor tu día.",
        funcional: "Ideal para tus necesidades cotidianas.",
        racional: "Excelente relación calidad-precio."
      };
    }
    return copy;
  });
  
  const config = {
    nombre: document.getElementById('smart-catalog-name').value || 'Catálogo',
    logo: document.getElementById('smart-catalog-logo').value || '',
    mostrarPrecios: document.getElementById('smart-catalog-prices').value === '1',
    whatsapp: document.getElementById('smart-catalog-wa').value || '573002397590',
    tema: 'TECH' // Por defecto
  };
  
  showLoading('Publicando...');
  try {
    const res = await fetch('/api/catalogos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        configuracion: config,
        productos: finalProducts
      })
    });
    
    const data = await res.json();
    hideLoading();
    
    if (data.success) {
      const publicUrl = window.location.origin + '/catalogo/' + data.slug;
      document.getElementById('smart-public-url').value = publicUrl;
      document.getElementById('smart-open-link').href = publicUrl;
      
      document.querySelectorAll('.smart-step').forEach(el => el.style.display = 'none');
      document.getElementById('smart-step-4').style.display = 'block';
    } else {
      toast('Error al publicar: ' + (data.error || 'Desconocido'), 'error');
    }
  } catch(e) {
    hideLoading();
    toast('Error de red: ' + e.message, 'error');
  }
}

function copySmartUrl() {
  const copyText = document.getElementById("smart-public-url");
  copyText.select();
  document.execCommand("copy");
  toast('Enlace copiado', 'success');
}

function shareSmartWA() {
  const url = document.getElementById("smart-public-url").value;
  const text = encodeURIComponent("¡Hola! Te invito a ver nuestro nuevo catálogo interactivo: " + url);
  window.open("https://wa.me/?text=" + text, "_blank");
}
</script>
`;

// Insert HTML before closing </body>
content = content.replace('</body>', wizardHTML + '\n</body>');
// Insert JS before closing </body>
content = content.replace('</body>', wizardJS + '\n</body>');

fs.writeFileSync(file, content, 'utf8');
console.log('Wizard HTML y JS inyectados con éxito');
