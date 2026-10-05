const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.js');
const indexHtmlPath = path.join(__dirname, 'index.html');

let code = fs.readFileSync(indexHtmlPath, 'utf8').replace(/\r\n/g, '\n');

const loginCSS = `
/* ── SAAS LOGIN ── */
#saas-login-overlay {
  position: fixed; inset: 0; background: var(--bg); z-index: 10000;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.saas-login-card {
  background: var(--surface); padding: 30px; border-radius: var(--radius);
  box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 100%; max-width: 400px;
  text-align: center; border: 1px solid var(--border);
}
.saas-login-card h2 { color: var(--electric); margin-bottom: 20px; }
.saas-login-card .form-group { text-align: left; margin-bottom: 15px; }
.saas-login-card input { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 4px; }
.saas-login-btn { width: 100%; padding: 12px; font-size: 16px; background: var(--electric); color: white; border: none; border-radius: 4px; cursor: pointer; }
.saas-login-btn:hover { background: var(--electric-dark); }
</style>
`;
code = code.replace('</style>', loginCSS);

const loginHTML = `
<body>
<div id="saas-login-overlay">
  <div class="saas-login-card">
    <i class="fa-solid fa-store" style="font-size: 40px; color: var(--electric); margin-bottom: 10px;"></i>
    <h2>Acceso al Sistema</h2>
    <div class="form-group">
      <label>Usuario / Negocio</label>
      <input type="text" id="saas-user" placeholder="Ej: micomercio">
    </div>
    <div class="form-group">
      <label>Contraseña</label>
      <input type="password" id="saas-pass" placeholder="••••••••">
    </div>
    <button class="saas-login-btn" onclick="saasLogin()"><i class="fa-solid fa-right-to-bracket"></i> Ingresar</button>
    <p id="saas-login-error" style="color: var(--red); margin-top: 10px; display: none;"></p>
  </div>
</div>
`;
code = code.replace('<body>', loginHTML);

const loginJS = `
async function saasLogin() {
  const u = document.getElementById('saas-user').value.trim();
  const p = document.getElementById('saas-pass').value.trim();
  if(!u || !p) return;
  const btn = document.querySelector('.saas-login-btn');
  btn.textContent = 'Verificando...'; btn.disabled = true;
  try {
    const res = await fetch(API_BASE+'/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if(res.ok && data.token) {
      localStorage.setItem('saas_token', data.token);
      localStorage.setItem('saas_business', data.business_name);
      localStorage.setItem('saas_modules', JSON.stringify(data.modules));
      document.getElementById('saas-login-overlay').style.display = 'none';
      initApp(); // Iniciar la app normal
    } else {
      const err = document.getElementById('saas-login-error');
      err.textContent = data.error || 'Error de acceso';
      err.style.display = 'block';
    }
  } catch(e) {
    const err = document.getElementById('saas-login-error');
    err.textContent = 'Error de red';
    err.style.display = 'block';
  }
  btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Ingresar'; btn.disabled = false;
}

function saasLogout() {
  localStorage.removeItem('saas_token');
  localStorage.removeItem('saas_business');
  localStorage.removeItem('saas_modules');
  location.reload();
}

function checkModules() {
  const mods = JSON.parse(localStorage.getItem('saas_modules') || '{}');
  if(mods.pos === false) document.getElementById('tab-pos').style.display = 'none';
  if(mods.productos === false) document.getElementById('tab-productos').style.display = 'none';
  if(mods.clientes === false) document.getElementById('tab-clientes').style.display = 'none';
  if(mods.cartera === false) document.getElementById('tab-cartera').style.display = 'none';
  if(mods.finanzas === false) document.getElementById('tab-finanzas').style.display = 'none';
  if(mods.config === false) document.getElementById('tab-config').style.display = 'none';
  
  // Update business name in UI if element exists
  const bName = localStorage.getItem('saas_business');
  const bTitle = document.querySelector('.app-logo');
  if(bTitle && bName) bTitle.innerHTML = '<i class="fa-solid fa-cash-register"></i> ' + bName;
}

function getSaasHeaders() {
  const t = localStorage.getItem('saas_token');
  if(!t) { saasLogout(); throw new Error('No token'); }
  return { 'Authorization': 'Bearer ' + t };
}
`;

// Inject before "/* ═══ API HELPERS ═══ */"
code = code.replace('/* ═══ API HELPERS ═══ */', loginJS + '\n/* ═══ API HELPERS ═══ */');

// Rewrite API helpers
code = code.replace(/async function apiGet\(url\)\{[\s\S]+?return r\.json\(\);\s*\}/, `async function apiGet(url){
  var r=await fetch(API_BASE+url, {headers: getSaasHeaders()});
  if(r.status===401) { saasLogout(); return; }
  if(!r.ok)throw new Error('Error '+r.status);
  return r.json();
}`);

code = code.replace(/async function apiPost\(url,data\)\{[\s\S]+?return r\.json\(\);\s*\}/, `async function apiPost(url,data){
  var r=await fetch(API_BASE+url,{method:'POST',headers:{'Content-Type':'application/json',...getSaasHeaders()},body:JSON.stringify(data)});
  if(r.status===401) { saasLogout(); return; }
  if(!r.ok){var e=await r.json();throw new Error(e.error||'Error '+r.status)}
  return r.json();
}`);

code = code.replace(/async function apiPut\(url,data\)\{[\s\S]+?return r\.json\(\);\s*\}/, `async function apiPut(url,data){
  var r=await fetch(API_BASE+url,{method:'PUT',headers:{'Content-Type':'application/json',...getSaasHeaders()},body:JSON.stringify(data)});
  if(r.status===401) { saasLogout(); return; }
  if(!r.ok){var e=await r.json();throw new Error(e.error||'Error '+r.status)}
  return r.json();
}`);

code = code.replace(/async function apiPatch\(url,data\)\{[\s\S]+?return r\.json\(\);\s*\}/, `async function apiPatch(url,data){
  var r=await fetch(API_BASE+url,{method:'PATCH',headers:{'Content-Type':'application/json',...getSaasHeaders()},body:JSON.stringify(data||{})});
  if(r.status===401) { saasLogout(); return; }
  if(!r.ok){var e=await r.json();throw new Error(e.error||'Error '+r.status)}
  return r.json();
}`);

code = code.replace(/async function apiDelete\(url\)\{[\s\S]+?return r\.json\(\);\s*\}/, `async function apiDelete(url){
  var r=await fetch(API_BASE+url,{method:'DELETE',headers:getSaasHeaders()});
  if(r.status===401) { saasLogout(); return; }
  if(!r.ok){var e=await r.json();throw new Error(e.error||'Error '+r.status)}
  return r.json();
}`);

// Inject check inside initApp
code = code.replace('async function initApp(){', `async function initApp(){
  if(!localStorage.getItem('saas_token')) {
    document.getElementById('saas-login-overlay').style.display = 'flex';
    return;
  }
  document.getElementById('saas-login-overlay').style.display = 'none';
  checkModules();
`);

// Change the 'salir' function to saasLogout
code = code.replace(/function salir\(\)\{[\s\S]+?\}/, `function salir() {
  if(confirm('¿Cerrar sesión?')) {
    saasLogout();
  }
}`);

// Avoid pin validation if we are in saas mode, just disable the pin screen directly.
code = code.replace(`var ps=document.getElementById('pin-screen');`, `var ps=document.getElementById('pin-screen'); if(ps) { ps.style.display='none'; }`);

fs.writeFileSync(indexHtmlPath, code);
console.log('Frontend refactorizado correctamente para SaaS.');
