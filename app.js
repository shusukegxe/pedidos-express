'use strict';
/* Tortas · Hechas a Mano — tienda de pedidos.
   Esta página es SOLO de pedidos: el panel del negocio vive en tortas-manager,
   las estadísticas en tortas-devtools y la cocina en tortas-chef. Comparten el
   mismo Store (localStorage + BroadcastChannel) y se ven en vivo entre pestañas.
   Las personalizadas se describen con editor manual o chatbot de IA (Puter.js)
   y admiten imágenes de referencia. */

const app = (() => {
  const $ = sel => document.querySelector(sel);
  const viewEl = document.getElementById('view');

  // ---------- iconos (svg inline, sin dependencias) ----------
  const P = {
    store: '<path d="M4.5 9.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9.5"/><path d="M3.5 6.3 5 3.5h14l1.5 2.8a2.3 2.3 0 0 1-4.6.6 2.3 2.3 0 0 1-4.5 0 2.3 2.3 0 0 1-4.6.6Z"/><path d="M9.5 20v-5.5h5V20"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 3h2l2.4 12.3a1 1 0 0 0 1 .7h8.4a1 1 0 0 0 1-.8L20.5 7H5.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10h.01M18 14h.01"/>',
    bank: '<path d="M3 22h18"/><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2.5 20.5 7.5h-17Z"/>',
    bell: '<path d="M6.4 9a5.6 5.6 0 0 1 11.2 0c0 6 2.4 7.5 2.4 7.5H4S6.4 15 6.4 9"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  };
  const icon = (n, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

  // ---------- monograma de reserva (si la foto no carga) ----------
  const TILE_COLORS = [
    ['#eef2ff', '#4f46e5'], ['#ecfdf3', '#027a48'], ['#eff8ff', '#175cd3'],
    ['#fffaeb', '#b54708'], ['#f4f3ff', '#6938ef'], ['#f2f4f7', '#475467'],
  ];
  function tile(name, size, fs) {
    const letras = name.split(/\s+/).map(w => (w.match(/[a-záéíóúñü]/i) || [])[0]).filter(Boolean).map(s => s.toUpperCase());
    const ini = letras.length > 1 ? letras.slice(0, 2).join('') : name.replace(/[^a-záéíóúñü]/gi, '').slice(0, 2).toUpperCase();
    const [bg, fg] = TILE_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TILE_COLORS.length];
    return `<span class="tile" style="width:${size}px;height:${size}px;font-size:${fs}px;background:${bg};color:${fg}">${ini}</span>`;
  }
  function pimg(p, size) {
    return `<img class="pimg" src="assets/${p.img}" alt="${Store.esc(p.name)}" loading="lazy" style="width:${size}px;height:${size}px" data-mono="${Store.esc(p.name)}" data-size="${size}">`;
  }
  document.addEventListener('error', e => {
    const t = e.target;
    if (t.tagName === 'IMG' && t.dataset.mono) {
      const s = +t.dataset.size;
      const wrap = document.createElement('span');
      wrap.innerHTML = tile(t.dataset.mono, s, Math.round(s * .36));
      t.replaceWith(wrap.firstChild);
    }
  }, true);

  // ---------- tamaños y precios por tamaño (en soles) ----------
  const TAMAÑOS = [
    { k: 'P', etiqueta: 'Pequeña' },
    { k: 'M', etiqueta: 'Mediana' },
    { k: 'G', etiqueta: 'Grande' },
  ];
  const TAM_PRECIOS = {
    p1: { P: 52, M: 72, G: 95 },
    p2: { P: 48, M: 68, G: 89 },
    p3: { P: 55, M: 78, G: 102 },
    p4: { P: 45, M: 62, G: 82 },
  };
  const tamEtiqueta = k => (TAMAÑOS.find(t => t.k === k) || {}).etiqueta || '';
  const precioDe = (p, tam) => TAM_PRECIOS[p.id] ? (TAM_PRECIOS[p.id][tam] || TAM_PRECIOS[p.id].M) : p.price;
  const esPersonalizada = p => p.id === 'p5';

  // ---------- estado de la interfaz ----------
  const ui = {
    cart: {},              // 'pid-tamaño' -> cantidad (la personalizada usa 'p5')
    lastOrderId: null,
    lastSeenStatus: null,
    payMethod: 'transferencia',
    busy: false,
  };
  let personal = { desc: '', imgs: [] };
  let chatHistoria = [];
  let puterCargado = false;

  const META = { nuevo: { badge: 'b-blue' }, preparando: { badge: 'b-violet' }, enviado: { badge: 'b-amber' }, entregado: { badge: 'b-green' }, cancelado: { badge: 'b-red' } };
  const STATUS_LABEL = Store.STATUS_LABEL;
  const stockDot = n => n <= 0 ? 'var(--red)' : n <= Store.LOW ? 'var(--amber)' : 'var(--green)';
  const stockTxt = n => n <= 0 ? 'Agotado' : n <= Store.LOW ? `Bajo stock · ${n}` : `${n} en stock`;

  // ---------- helpers de UI ----------
  function toast(msg, ic = 'bell') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${icon(ic, 15)}<span>${msg}</span>`;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  const modalRoot = document.getElementById('modal-root');
  function openModal(html) { modalRoot.innerHTML = `<div class="modal">${html}</div>`; modalRoot.style.display = 'flex'; }
  function closeModal() { modalRoot.style.display = 'none'; modalRoot.innerHTML = ''; }
  modalRoot.addEventListener('click', e => { if (e.target === modalRoot) closeModal(); });

  // ---------- la vista (montaje único: esta página es solo pedidos) ----------
  viewEl.innerHTML = `
    <div class="view-head">
      <div>
        <h1>Hacer un pedido</h1>
        <div class="sub">Elige tus tortas — las horneamos el mismo día de la entrega.</div>
      </div>
    </div>
    <div id="tracker-slot"></div>
    <div class="shop">
      <section class="card">
        <div class="card-head">
          <h2>Catálogo</h2>
          <div style="position:relative">
            <input id="prod-search" class="search" placeholder="Buscar torta…" style="padding-left:32px">
            <span style="position:absolute;left:9px;top:7px;color:var(--text-3)">${icon('search', 15)}</span>
          </div>
        </div>
        <div class="card-body"><div id="products" class="products"></div></div>
      </section>
      <section class="card order-panel">
        <div class="card-head"><h2>Tu pedido</h2><span id="cart-count" class="badge b-gray">0 items</span></div>
        <div class="card-body">
          <div id="cart"></div>
          <div id="total-row"></div>
          <div class="field" style="margin-top:8px"><label>Nombre</label><input id="f-name" placeholder="Ana Torres"></div>
          <div class="field"><label>Teléfono</label><input id="f-phone" placeholder="999 999 999"></div>
          <div class="field"><label>Dirección de entrega</label><input id="f-addr" placeholder="Jr. Los Rosales 123"></div>
          <div class="field"><label>Fecha de entrega</label><input type="date" id="f-date"></div>
          <div class="field"><label>Mensaje en la torta <span style="color:var(--text-3)">(opcional)</span></label><input id="f-note" placeholder="Feliz cumpleaños, Mamá"></div>
          <div class="field"><label>Forma de pago</label></div>
          <div class="pay-opt">
            <label><input type="radio" name="pay" value="transferencia" checked> ${icon('bank', 15)} Transferencia</label>
            <label><input type="radio" name="pay" value="efectivo"> ${icon('cash', 15)} Efectivo</label>
          </div>
          <div class="mini-check" id="decline-wrap" hidden>
            <input type="checkbox" id="f-decline"><label for="f-decline" style="margin:0;cursor:pointer">Forzar rechazo de la transferencia (demo)</label>
          </div>
          <button id="btn-checkout" class="btn primary" style="width:100%;padding:10px" data-act="checkout">${icon('cart', 15)} Confirmar pedido</button>
        </div>
      </section>
    </div>`;

  document.getElementById('prod-search').addEventListener('input', updateProducts);
  const fDate = document.getElementById('f-date');
  fDate.min = new Date().toISOString().slice(0, 10);
  fDate.value = fDate.min;

  // ---------- renders ----------
  function visibleProducts() {
    const q = ($('#prod-search') && $('#prod-search').value || '').trim().toLowerCase();
    return Store.db.products.filter(p => !q || p.name.toLowerCase().includes(q));
  }

  function updateProducts() {
    document.getElementById('products').innerHTML = visibleProducts().map(p => {
      const enCarrito = llavesDe(p.id).reduce((s, k) => s + ui.cart[k], 0);
      const agotado = p.stock <= 0;
      const esPers = esPersonalizada(p);
      const action = agotado
        ? `<button class="btn sm" disabled>Agotado</button>`
        : esPers
          ? `<button class="btn primary sm" data-act="personalizar">${icon('plus', 13)} Personalizar</button>`
          : enCarrito > 0
            ? `<span class="qty"><button data-act="dec" data-id="${p.id}">${icon('minus', 13)}</button><span class="n">${enCarrito}</span><button data-act="inc" data-id="${p.id}" ${enCarrito >= p.stock ? 'disabled' : ''}>${icon('plus', 13)}</button></span>`
            : `<button class="btn primary sm" data-act="add" data-id="${p.id}">${icon('plus', 13)} Agregar</button>`;
      const precio = esPers || !TAM_PRECIOS[p.id] ? Store.money(p.price) : 'Desde ' + Store.money(Math.min(...Object.values(TAM_PRECIOS[p.id])));
      return `
        <div class="product">
          ${pimg(p, 56)}
          <div class="name">${Store.esc(p.name)}</div>
          <div class="desc">${Store.esc(p.desc || '')}</div>
          <div class="price">${precio}</div>
          <div class="stock-line"><span class="dot" style="background:${stockDot(p.stock)}"></span>${stockTxt(p.stock)}</div>
          ${action}
        </div>`;
    }).join('') || '<div class="empty">Sin resultados para esa búsqueda</div>';
  }

  function updateTracker() {
    const slot = document.getElementById('tracker-slot');
    const o = ui.lastOrderId && Store.db.orders.find(x => x.id === ui.lastOrderId);
    if (!o || o.status === 'cancelado') {
      slot.innerHTML = o && o.status === 'cancelado'
        ? `<div class="tracker"><span class="oid mono">${o.id}</span><span class="badge b-red"><span class="dot"></span>Pedido cancelado</span><span style="flex:1"></span><span style="font-size:12.5px;color:var(--text-3)">El stock fue repuesto — puedes hacer un nuevo pedido</span></div>`
        : '';
      return;
    }
    const idx = Store.FLOW.indexOf(o.status);
    slot.innerHTML = `
      <div class="tracker">
        <span class="oid mono">${o.id}</span>
        <div class="steps">
          ${Store.FLOW.map((s, i) => `
            ${i ? `<div class="line ${i <= idx ? 'done' : ''}"></div>` : ''}
            <div class="step ${i < idx ? 'done' : ''} ${i === idx ? 'current' : ''}">
              <span class="b">${i < idx ? icon('check', 11) : i === idx ? '<span style="width:9px;height:9px;border-radius:99px;background:currentColor"></span>' : ''}</span>
              ${['Recibido', 'En preparación', 'En camino', 'Entregado'][i]}
            </div>`).join('')}
        </div>
      </div>`;
  }

  // carrito con claves 'pid-tamaño'
  const llavesDe = pid => Object.keys(ui.cart).filter(k => k.split('-')[0] === pid);
  function itemDe(k) {
    const [pid, tam] = k.split('-');
    const p = Store.prod(pid);
    return { pid, tam: p && TAM_PRECIOS[pid] ? tam : null, nombre: p ? p.name : pid, precio: p ? precioDe(p, tam) : 0, qty: ui.cart[k], llave: k };
  }
  const cartItems = () => Object.keys(ui.cart).map(itemDe);
  const cartCount = () => Object.values(ui.cart).reduce((s, n) => s + n, 0);
  const cartTotal = () => cartItems().reduce((s, it) => s + it.precio * it.qty, 0);
  const agregar = (pid, tam) => { const k = pid + (tam ? '-' + tam : ''); ui.cart[k] = (ui.cart[k] || 0) + 1; };

  function updateCart() {
    const its = cartItems();
    document.getElementById('cart-count').textContent = its.length ? `${cartCount()} items` : 'Vacío';
    document.getElementById('cart').innerHTML = its.length ? its.map(it => {
      const p = Store.prod(it.pid);
      const selector = esPersonalizada(p)
        ? `<div class="pers-tag">${it.descripcion ? Store.esc(it.descripcion.slice(0, 44)) + '…' : 'torta personalizada'}${it.imgs ? ' · ' + it.imgs.length + ' img' : ''}</div>`
        : `<select class="pj-tam" data-tam="${it.llave}" aria-label="Tamaño">
             ${TAMAÑOS.map(t => `<option value="${t.k}" ${t.k === it.tam ? 'selected' : ''}>${t.etiqueta} — ${Store.money(precioDe(p, t.k))}</option>`).join('')}
           </select>`;
      return `
        <div class="cart-row">
          ${pimg(p, 34)}
          <div class="ci"><div class="n">${Store.esc(p.name)}</div><div class="p">${Store.money(it.precio)} c/u</div></div>
          ${selector}
          <span class="qty"><button data-act="dec" data-id="${it.llave}">${icon('minus', 13)}</button><span class="n">${it.qty}</span><button data-act="inc" data-id="${it.llave}" ${it.qty >= p.stock ? 'disabled' : ''}>${icon('plus', 13)}</button></span>
          <span class="sub">${Store.money(it.precio * it.qty)}</span>
          <button class="rm" data-act="remove" data-id="${it.llave}" title="Quitar">${icon('x', 14)}</button>
        </div>`;
    }).join('') : `<div class="cart-empty">${icon('cart', 22)}<div style="margin-top:6px">El carrito está vacío.<br>Agrega tortas del catálogo.</div></div>`;
    document.getElementById('total-row').innerHTML = `<div class="total-row"><span class="t">Total</span><span class="v">${Store.money(cartTotal())}</span></div>`;
    const btn = document.getElementById('btn-checkout');
    btn.disabled = !cartCount() || ui.busy;
    btn.innerHTML = `${icon('cart', 15)} ${ui.busy ? 'Procesando…' : 'Confirmar pedido'}`;
  }

  function readDraft() {
    return {
      name: $('#f-name').value.trim(), phone: $('#f-phone').value.trim(),
      address: $('#f-addr').value.trim(), note: $('#f-note').value.trim(),
      deliveryDate: $('#f-date').value || '',
      payMethod: ui.payMethod, forceDecline: $('#f-decline').checked,
      items: cartItems().map(it => ({
        pid: it.pid, name: it.nombre + (it.tam ? ' · ' + tamEtiqueta(it.tam) : ''), price: it.precio, qty: it.qty, tam: it.tam,
        ...(it.pid === 'p5' ? { descripcion: personal.desc, images: personal.imgs } : {}),
      })),
    };
  }

  // ---------- checkout ----------
  async function submitOrder() {
    if (ui.busy || !cartCount()) return;
    const d = readDraft();
    if (!d.name || !d.phone || !d.address) return toast('Completa nombre, teléfono y dirección', 'bell');
    ui.busy = true; updateCart();
    try {
      const res = await Store.placeOrder(d);
      if (res.ok) {
        ui.lastOrderId = res.order.id;
        ui.lastSeenStatus = res.order.status;
        ui.cart = {}; personal = { desc: '', imgs: [] }; chatHistoria = [];
        Store.event('cliente', `confirma ${res.order.id}`);
        const entrega = res.order.deliveryDate ? Store.fecha(res.order.deliveryDate) : 'lo antes posible';
        const waTxt = encodeURIComponent(
          `Hola, Tortas · Hechas a Mano. Confirmo mi pedido ${res.order.id}:\n` +
          res.order.items.map(it => `• ${it.qty}× ${it.name}`).join('\n') +
          `\nTotal: ${Store.money(res.order.total)} (${res.order.payMethod})` +
          `\nEntrega: ${entrega}` +
          `\nNombre: ${res.order.customer.name} — Dirección: ${res.order.customer.address}` +
          (res.order.customer.note ? `\nMensaje en la torta: "${res.order.customer.note}"` : ''));
        openModal(`
          <div class="modal-ic" style="background:var(--green-soft);color:var(--green-text)">${icon('check', 22)}</div>
          <h3>Pedido ${res.order.id} confirmado</h3>
          <div class="rows">
            ${res.order.items.map(it => `<div><span>${it.qty}× ${Store.esc(it.name)}</span><span>${Store.money(it.price * it.qty)}</span></div>`).join('')}
            <div><span><b>Total</b> · ${res.order.payMethod}</span><b>${Store.money(res.order.total)}</b></div>
          </div>
          <p>Pago: <b>${res.order.payStatus}</b> · Entrega: <b>${entrega}</b>.</p>
          <p class="dim">Deja la pestaña abierta: cuando el panel avance tu pedido, te avisamos aquí.</p>
          <div class="btn-row">
            <button class="btn" data-act="modal-close">Cerrar</button>
            <a class="btn wa" href="https://wa.me/?text=${waTxt}" target="_blank" rel="noopener">Enviar por WhatsApp</a>
          </div>`);
      } else {
        openModal(`
          <div class="modal-ic" style="background:var(--red-soft);color:var(--red-text)">${icon('x', 22)}</div>
          <h3>Transferencia rechazada</h3>
          <p>${Store.esc(res.reason)}</p>
          <p class="dim">La pasarela simulada rechaza al marcar la casilla de demo, o el 10% de las veces. El carrito se conserva para reintentar.</p>
          <div class="btn-row"><button class="btn primary" data-act="modal-close">Entendido</button></div>`);
      }
    } catch (err) {
      toast(Store.esc(err.message), 'bell');
    }
    ui.busy = false;
    updateTracker(); updateProducts(); updateCart();
  }

  // ---------- torta personalizada: editor manual + chatbot (Puter.js) ----------
  function cargarPuter() {
    if (puterCargado) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload = () => { puterCargado = true; res(); };
      s.onerror = () => rej(new Error('No se pudo cargar Puter.js'));
      document.head.appendChild(s);
    });
  }

  function abrirPersonalizada() {
    openModal(`
      <h3 class="modal-titulo">Torta personalizada</h3>
      <p class="dim">Desde ${Store.money(120)} — el precio final se confirma por WhatsApp según tu diseño.</p>
      <div class="seg" style="margin:10px 0">
        <button class="on" data-tab-btn="editor">Editor manual</button>
        <button data-tab-btn="ia">Con IA</button>
      </div>
      <div id="tab-editor">
        <div class="field"><label>Masa
          <select id="pj-masa"><option>Vainilla</option><option>Chocolate</option><option>Marmoleado</option><option>Naranja</option></select></label></div>
        <div class="field"><label>Relleno
          <select id="pj-relleno"><option>Manjar blanco</option><option>Crema de lúcuma</option><option>Chocolate</option><option>Fresa</option><option>Chantilly</option></select></label></div>
        <div class="field"><label>Cobertura
          <select id="pj-cobertura"><option>Chantilly</option><option>Fondant</option><option>Buttercream</option><option>Merengue</option></select></label></div>
        <div class="field"><label>Porciones
          <select id="pj-porciones"><option>~10</option><option selected>~20</option><option>~30</option><option>~50</option></select></label></div>
        <div class="field"><label>Dedicatoria<input id="pj-dedicatoria" placeholder="Feliz cumpleaños, Mamá"></label></div>
        <div class="field"><label>Detalles extra (decoración, colores, tema)<input id="pj-extra" placeholder="tema de gatitos, colores rosado y dorado"></label></div>
        <button class="btn" id="pj-generar-desc" style="margin:6px 0 10px">Armar descripción</button>
        <div class="field"><label>Descripción de la torta
          <textarea id="pj-desc" rows="4" placeholder="Describe tu torta… o usa las pestañas de arriba para armarla" style="resize:vertical"></textarea></label></div>
      </div>
      <div id="tab-ia" style="display:none">
        <div id="pj-chat-msgs" style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:10px;max-height:190px;overflow-y:auto;margin-bottom:8px;display:flex;flex-direction:column;gap:6px">
          <div class="pj-chat-msg" style="align-self:flex-start;background:var(--accent-soft);padding:8px 12px;border-radius:12px;font-size:.85rem">¡Hola! Cuéntame qué torta imaginas (ocasión, sabores, decoración) y te ayudo a redactarla.</div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input id="pj-chat-input" placeholder="Quiero una torta para…" style="flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font:inherit">
          <button class="btn" id="pj-chat-enviar">Enviar</button>
        </div>
        <button class="btn" id="pj-chat-usar" disabled>Usar esta descripción</button>
        <p class="dim" style="margin-top:8px">La IA corre con Puter.js: la primera vez te pedirá iniciar sesión gratis con tu cuenta Puter.</p>
      </div>
      <div class="field" style="margin-top:10px"><label>Imágenes de referencia (hasta 3)
        <input type="file" id="pj-imgs" accept="image/*" multiple>
        <div id="pj-thumbs" style="display:flex;gap:8px;margin-top:8px"></div></label></div>
      <button class="btn primary" id="pj-add-pers" style="width:100%;padding:10px">Agregar al pedido</button>`);

    modalRoot.querySelectorAll('[data-tab-btn]').forEach(b => b.addEventListener('click', () => {
      modalRoot.querySelectorAll('[data-tab-btn]').forEach(x => x.classList.toggle('on', x === b));
      document.getElementById('tab-editor').style.display = b.dataset.tabBtn === 'editor' ? '' : 'none';
      document.getElementById('tab-ia').style.display = b.dataset.tabBtn === 'ia' ? '' : 'none';
    }));

    document.getElementById('pj-generar-desc').addEventListener('click', () => {
      const v = id => document.querySelector(id).value;
      document.getElementById('pj-desc').value = `Torta personalizada: masa de ${v('#pj-masa').toLowerCase()}, relleno de ${v('#pj-relleno').toLowerCase()}, cobertura de ${v('#pj-cobertura').toLowerCase()}, aprox. ${v('#pj-porciones')} porciones` +
        (v('#pj-dedicatoria') ? `, con la dedicatoria "${v('#pj-dedicatoria')}"` : '') +
        (v('#pj-extra') ? `. Detalles: ${v('#pj-extra')}` : '') + '.';
    });

    const chatMsgs = () => document.getElementById('pj-chat-msgs');
    const burbuja = (txt, quien) => {
      chatMsgs().insertAdjacentHTML('beforeend', `<div class="pj-chat-msg" style="align-self:${quien === 'yo' ? 'flex-end' : 'flex-start'};background:${quien === 'yo' ? 'var(--accent-soft)' : 'var(--green-soft)'};padding:8px 12px;border-radius:12px;font-size:.85rem;max-width:88%">${Store.esc(txt)}</div>`);
      chatMsgs().scrollTop = chatMsgs().scrollHeight;
    };
    document.getElementById('pj-chat-enviar').addEventListener('click', async () => {
      const entrada = document.getElementById('pj-chat-input');
      const texto = entrada.value.trim();
      if (!texto) return;
      entrada.value = '';
      burbuja(texto, 'yo');
      chatHistoria.push({ role: 'user', content: texto });
      const burbujaIA = document.createElement('div');
      burbujaIA.className = 'pj-chat-msg';
      burbujaIA.style.cssText = 'align-self:flex-start;background:var(--green-soft);padding:8px 12px;border-radius:12px;font-size:.85rem;max-width:88%';
      burbujaIA.textContent = 'Pensando…';
      chatMsgs().appendChild(burbujaIA);
      try {
        await cargarPuter();
        const sistema = 'Eres el asistente de pedidos de "Tortas Hechas a Mano", pastelería casera en Perú. Ayuda a definir la torta personalizada del cliente: masa (vainilla, chocolate, marmoleado), relleno (manjar blanco, lúcuma, chocolate, fresa), cobertura (chantilly, fondant, buttercream), porciones, decoración y dedicatoria. Responde breve; cuando el cliente esté conforme, entrega SOLO la descripción final del pedido en un párrafo que empiece con "Torta personalizada:".';
        const r = await window.puter.ai.chat(chatHistoria.concat([{ role: 'system', content: sistema }]).slice(-8));
        const bruto = r && (r.message?.content || r.text);
        const limpio = typeof bruto === 'string' ? bruto : JSON.stringify(bruto ?? r);
        chatHistoria.push({ role: 'assistant', content: limpio });
        burbujaIA.textContent = limpio;
        document.getElementById('pj-chat-usar').disabled = false;
      } catch (err) {
        burbujaIA.textContent = 'No se pudo conectar con la IA (' + (err.message || 'inicia sesión con Puter') + '). Usa el editor manual, que funciona siempre.';
      }
    });
    document.getElementById('pj-chat-usar').addEventListener('click', () => {
      const ultima = [...chatHistoria].reverse().find(m => m.role === 'assistant');
      if (!ultima) return;
      document.getElementById('pj-desc').value = ultima.content;
      modalRoot.querySelector('[data-tab-btn="editor"]').click();
    });

    document.getElementById('pj-imgs').addEventListener('change', async e => {
      const archivos = [...e.target.files].slice(0, 3 - personal.imgs.length);
      for (const archivo of archivos) {
        try { if (personal.imgs.length < 3) personal.imgs.push(await comprimir(archivo)); }
        catch { toast('No se pudo leer una imagen', 'bell'); }
      }
      renderThumbs();
    });
    function renderThumbs() {
      document.getElementById('pj-thumbs').innerHTML = personal.imgs.map((src, i) =>
        `<div style="position:relative"><img src="${src}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--border)"><button data-quit-img="${i}" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:99px;border:none;background:var(--text);color:#fff;cursor:pointer;font-size:11px">×</button></div>`).join('');
      document.getElementById('pj-thumbs').querySelectorAll('[data-quit-img]').forEach(b => b.addEventListener('click', () => {
        personal.imgs.splice(+b.dataset.quitImg, 1); renderThumbs();
      }));
    }

    document.getElementById('pj-add-pers').addEventListener('click', () => {
      const desc = document.getElementById('pj-desc').value.trim();
      if (!desc) return toast('Describe tu torta (editor o IA)', 'bell');
      personal.desc = desc;
      agregar('p5', null);
      closeModal();
      updateCart();
      toast('Torta personalizada agregada al pedido', 'check');
    });
  }

  async function comprimir(archivo) {
    const bmp = await createImageBitmap(archivo);
    const max = 1100, r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  }

  // ---------- eventos (delegación) ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const { act, id } = el.dataset;
    switch (act) {
      case 'add': { const p = Store.prod(id); agregar(p.id, 'M'); Store.event('web', `carrito: +1 ${p.name} (Mediana)`); updateProducts(); updateCart(); break; }
      case 'inc': { const p = Store.prod(id.split('-')[0]); const k = llavesDe(p.id).find(k => ui.cart[k] > 0) || p.id + '-M'; if ((ui.cart[k] || 0) < p.stock) { ui.cart[k] = (ui.cart[k] || 0) + 1; updateProducts(); updateCart(); } break; }
      case 'dec': {
        const k = llavesDe(id.split('-')[0]).find(k => ui.cart[k] > 0);
        if (!k) break;
        ui.cart[k]--;
        if (ui.cart[k] <= 0) delete ui.cart[k];
        updateProducts(); updateCart(); break;
      }
      case 'remove': { delete ui.cart[id]; Store.event('web', 'carrito: quitar producto'); updateProducts(); updateCart(); break; }
      case 'checkout': submitOrder(); break;
      case 'personalizar': abrirPersonalizada(); break;
      case 'modal-close': closeModal(); break;
    }
  });

  document.addEventListener('change', e => {
    if (e.target.name === 'pay') {
      ui.payMethod = e.target.value;
      document.getElementById('decline-wrap').hidden = ui.payMethod !== 'transferencia';
      return;
    }
    const tam = e.target.closest('.pj-tam');
    if (tam) {
      const vieja = tam.dataset.tam, nueva = tam.value;
      if (nueva !== vieja) {
        const qty = ui.cart[vieja];
        delete ui.cart[vieja];
        ui.cart[vieja.split('-')[0] + '-' + nueva] = qty;
        updateProducts(); updateCart();
      }
    }
  });

  // cambios hechos en otra pestaña (panel, devtools) refrescan la tienda
  Store.subscribe(() => {
    const o = ui.lastOrderId && Store.db.orders.find(x => x.id === ui.lastOrderId);
    if (o && ui.lastSeenStatus && o.status !== ui.lastSeenStatus) {
      toast(`Tu pedido <b>${o.id}</b>: ${STATUS_LABEL[o.status]}`, 'clock');
      ui.lastSeenStatus = o.status;
    }
    updateTracker(); updateProducts(); updateCart();
  });

  updateTracker(); updateProducts(); updateCart();
})();
