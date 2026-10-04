'use strict';
/* PedidosExpress — vistas + router hash (#/tienda, #/panel, #/devtools).
   Render estructural una vez por navegación; los datos se refrescan de forma
   dirigida (update) con cada evento del Store, incluidos los de otras pestañas. */

const app = (() => {
  const $ = sel => document.querySelector(sel);
  const viewEl = document.getElementById('view');

  // ---------- iconos (svg inline, sin dependencias) ----------
  const P = {
    store: '<path d="M4.5 9.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9.5"/><path d="M3.5 6.3 5 3.5h14l1.5 2.8a2.3 2.3 0 0 1-4.6.6 2.3 2.3 0 0 1-4.5 0 2.3 2.3 0 0 1-4.6.6Z"/><path d="M9.5 20v-5.5h5V20"/>',
    panel: '<rect x="3" y="3" width="7.5" height="9.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5"/><rect x="13.5" y="12" width="7.5" height="9" rx="1.5"/><rect x="3" y="16" width="7.5" height="5" rx="1.5"/>',
    terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 3h2l2.4 12.3a1 1 0 0 0 1 .7h8.4a1 1 0 0 0 1-.8L20.5 7H5.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    package: '<path d="M21 8.5v7a2 2 0 0 1-1 1.73l-6 3.5a2 2 0 0 1-2 0l-6-3.5a2 2 0 0 1-1-1.73v-7a2 2 0 0 1 1-1.73l6-3.5a2 2 0 0 1 2 0l6 3.5a2 2 0 0 1 1 1.73Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 12v9.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="3.5"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/><path d="M15.5 3.6a3.5 3.5 0 0 1 0 6.8"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/>',
    bell: '<path d="M6.4 9a5.6 5.6 0 0 1 11.2 0c0 6 2.4 7.5 2.4 7.5H4S6.4 15 6.4 9"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
    receipt: '<path d="M14 2.5H6.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V7.5Z"/><path d="M14 2.5v5h5"/><path d="M9 12.5h6M9 16h6"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10h.01M18 14h.01"/>',
    bank: '<path d="M3 22h18"/><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7"/><path d="M12 2.5 20.5 7.5h-17Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    refresh: '<path d="M3 12a9 9 0 1 0 2.6-6.3L3 8"/><path d="M3 3v5h5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    zap: '<path d="M13 2 3 14h8l-1 8 11-13h-9l1-7Z"/>',
  };
  const icon = (n, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

  // inyecta los iconos del menú lateral
  document.querySelectorAll('.nav a[data-icon]').forEach(a => a.insertAdjacentHTML('afterbegin', icon(a.dataset.icon, 17)));

  // ---------- estado de la interfaz (por sesión) ----------
  const ui = {
    route: 'tienda',
    cart: {},            // pid -> cantidad
    lastOrderId: null,
    lastSeenStatus: null,
    payMethod: 'efectivo',
    filter: 'todos',     // filtro de pedidos en el panel
    tab: 'inventario',   // pestaña secundaria del panel
    logFilter: 'todos',  // filtro del registro en devtools
    busy: false,
  };

  const META = {
    nuevo:      { badge: 'b-blue' }, preparando: { badge: 'b-violet' },
    enviado:    { badge: 'b-amber' }, entregado: { badge: 'b-green' },
    cancelado:  { badge: 'b-red' },
  };
  const PAY = { aprobado: 'b-green', cobrado: 'b-green', pendiente: 'b-amber', rechazado: 'b-red' };
  const STATUS_LABEL = Store.STATUS_LABEL;
  const stockDot = n => n <= 0 ? 'var(--red)' : n <= Store.LOW ? 'var(--amber)' : 'var(--green)';
  const stockTxt = n => n <= 0 ? 'Agotado' : n <= Store.LOW ? `Bajo stock · ${n}` : `${n} en stock`;

  // monograma determinista: iniciales del producto sobre paleta suave
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

  // foto real del producto (assets/); si no carga, cae al monograma
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

  let pendingConfirm = null;
  function confirmDialog({ title, body, ok, danger, onOk }) {
    pendingConfirm = onOk;
    openModal(`
      <h3 style="margin-top:0">${title}</h3>
      <p>${body}</p>
      <div class="btn-row">
        <button class="btn" data-act="modal-close">Cancelar</button>
        <button class="btn ${danger ? 'primary' : 'primary'}" style="${danger ? 'background:var(--red-text);border-color:var(--red-text)' : ''}" data-act="confirm-ok">${ok}</button>
      </div>`);
  }

  // ---------- router ----------
  function navigate(r) { if (location.hash !== '#/' + r) location.hash = '#/' + r; else render(); }
  function currentRoute() { return (location.hash.replace('#/', '') || 'tienda').split('?')[0]; }
  function render() {
    ui.route = currentRoute();
    if (!VIEWS[ui.route]) ui.route = 'tienda';
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === ui.route));
    VIEWS[ui.route].mount();
  }
  window.addEventListener('hashchange', render);

  // cada cambio del Store (local o de otra pestaña) refresca la vista activa
  Store.subscribe(() => {
    const o = ui.lastOrderId && Store.db.orders.find(x => x.id === ui.lastOrderId);
    if (o && ui.lastSeenStatus && o.status !== ui.lastSeenStatus) {
      toast(`Tu pedido <b>${o.id}</b>: ${STATUS_LABEL[o.status]}`, 'clock');
      ui.lastSeenStatus = o.status;
    }
    VIEWS[ui.route].update && VIEWS[ui.route].update();
  });

  /* ================= VISTA: TIENDA ================= */
  const VIEWS = {
    tienda: {
      mount() {
        viewEl.innerHTML = `
          <div class="view-head">
            <div>
              <h1>Hacer un pedido</h1>
              <div class="sub">Elige tus tortas — las horneamos el mismo día de la entrega.</div>
            </div>
            <div class="seg" id="catalog-filter" hidden></div>
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
                <div class="field"><label>Teléfono</label><input id="f-phone" placeholder="555-0101"></div>
                <div class="field"><label>Dirección de entrega</label><input id="f-addr" placeholder="Calle 1 #23"></div>
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
        updateTracker(); updateProducts(); updateCart();
      },
      update() { updateTracker(); updateProducts(); updateCart(); },
    },

    /* ================= VISTA: PANEL ================= */
    panel: {
      mount() {
        viewEl.innerHTML = `
          <div class="view-head">
            <div>
              <h1>Panel del negocio</h1>
              <div class="sub">${new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })} — se actualiza en vivo, también con pedidos hechos en otra pestaña.</div>
            </div>
          </div>
          <div class="kpis" id="kpis"></div>
          <div class="panel-grid">
            <section class="card">
              <div class="card-head">
                <h2>Pedidos</h2>
                <div class="seg" id="order-filters"></div>
              </div>
              <div style="overflow-x:auto">
                <table class="table">
                  <thead><tr><th>Pedido</th><th>Cliente</th><th>Artículos</th><th class="num" style="text-align:right">Total</th><th>Pago</th><th>Estado</th><th></th></tr></thead>
                  <tbody id="orders-body"></tbody>
                </table>
              </div>
            </section>
            <section class="card">
              <div class="card-head">
                <h2 id="tab-title">Inventario</h2>
                <div class="seg" id="panel-tabs"></div>
              </div>
              <div class="tab-body" id="tab-body"></div>
            </section>
          </div>`;
        updateKPIs(); updateFilters(); updateOrders(); updateTab();
      },
      update() { updateKPIs(); updateOrders(); updateTab(); },
    },

    /* ================= VISTA: DEVTOOLS ================= */
    devtools: {
      mount() {
        viewEl.innerHTML = `
          <div class="view-head">
            <div>
              <h1>DevTools</h1>
              <div class="sub">Observabilidad del prototipo: arquitectura en vivo, tráfico de la API y estado crudo.</div>
            </div>
            <button class="btn danger" data-act="reset">${icon('refresh', 15)} Reiniciar demo</button>
          </div>
          <div class="kpis" id="dev-kpis"></div>
          <div class="dev-grid">
            <section class="card">
              <div class="card-head"><h2>Arquitectura en vivo</h2><span class="badge b-gray">eventos por módulo</span></div>
              <div class="card-body">
                <div class="arch">
                  <div class="arch-box big" id="arq-cliente"><div class="t">Cliente</div><div class="m" id="arq-cliente-c">—</div></div>
                  <div class="arrow"></div>
                  <div class="arch-box big" id="arq-web"><div class="t">Web / App de pedidos</div><div class="m" id="arq-web-c">—</div></div>
                  <div class="arrow"></div>
                  <div class="arch-box big" id="arq-api"><div class="t">Backend · API + datos</div><div class="m" id="arq-api-c">—</div></div>
                  <div class="fan" style="margin-top:14px">
                    ${['pedidos', 'inventario', 'clientes', 'pagos', 'notificaciones'].map(m => `
                      <div><div class="stub"></div>
                        <div class="arch-box" id="arq-${m}"><div class="t">${m[0].toUpperCase() + m.slice(1)}</div><div class="m" id="arq-${m}-c">0</div><div class="last" id="arq-${m}-l">—</div></div>
                      </div>`).join('')}
                  </div>
                  <div class="fan-merge" style="width:100%">
                    <div class="stub2"></div><div class="stub2"></div><div class="stub2"></div><div class="stub2"></div><div class="stub2"></div>
                  </div>
                  <div class="arrow"></div>
                  <div class="arch-box big" id="arq-panel"><div class="t">Panel del negocio</div><div class="m" id="arq-panel-c">—</div></div>
                </div>
              </div>
            </section>
            <section class="card">
              <div class="card-head">
                <h2>Estado</h2>
                <button class="btn sm" data-act="copy-state">${icon('copy', 14)} Copiar JSON</button>
              </div>
              <div class="card-body"><pre class="dbpre" id="state-view"></pre></div>
            </section>
          </div>
          <section class="card">
            <div class="card-head">
              <h2>Registro de peticiones y eventos</h2>
              <div class="seg" id="log-filters"></div>
            </div>
            <div style="overflow-x:auto">
              <table class="table">
                <thead><tr><th>Hora</th><th>Operación</th><th>Origen</th><th>Módulo</th><th>Estado</th><th class="num" style="text-align:right">Latencia</th></tr></thead>
                <tbody id="req-body"></tbody>
              </table>
            </div>
          </section>`;
        updateDevKPIs(); updateArch(); updateRequests(); updateState();
      },
      update() { updateDevKPIs(); updateArch(true); updateRequests(); updateState(); },
    },
  };

  /* ---------- tienda: renders ---------- */
  function visibleProducts() {
    const q = ($('#prod-search') && $('#prod-search').value || '').trim().toLowerCase();
    return Store.db.products.filter(p => !q || p.name.toLowerCase().includes(q));
  }

  function updateProducts() {
    document.getElementById('products').innerHTML = visibleProducts().map(p => {
      const inCart = ui.cart[p.id] || 0;
      const action = p.stock <= 0
        ? `<button class="btn sm" disabled>Agotado</button>`
        : inCart > 0
          ? `<span class="qty"><button data-act="dec" data-id="${p.id}">${icon('minus', 13)}</button><span class="n">${inCart}</span><button data-act="inc" data-id="${p.id}" ${inCart >= p.stock ? 'disabled' : ''}>${icon('plus', 13)}</button></span>`
          : `<button class="btn primary sm" data-act="add" data-id="${p.id}">${icon('plus', 13)} Agregar</button>`;
      return `
        <div class="product">
          ${pimg(p, 56)}
          <div class="name">${Store.esc(p.name)}</div>
          <div class="desc">${Store.esc(p.desc || '')}</div>
          <div class="price">${Store.money(p.price)}</div>
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

  function updateCart() {
    const entries = Object.entries(ui.cart);
    const total = entries.reduce((s, [pid, q]) => s + Store.prod(pid).price * q, 0);
    document.getElementById('cart-count').textContent = entries.length ? `${entries.reduce((s, [, q]) => s + q, 0)} items` : 'Vacío';
    document.getElementById('cart').innerHTML = entries.length ? entries.map(([pid, q]) => {
      const p = Store.prod(pid);
      return `
        <div class="cart-row">
          ${pimg(p, 34)}
          <div class="ci"><div class="n">${Store.esc(p.name)}</div><div class="p">${Store.money(p.price)} c/u</div></div>
          <span class="qty"><button data-act="dec" data-id="${pid}">${icon('minus', 13)}</button><span class="n">${q}</span><button data-act="inc" data-id="${pid}" ${q >= p.stock ? 'disabled' : ''}>${icon('plus', 13)}</button></span>
          <span class="sub">${Store.money(p.price * q)}</span>
          <button class="rm" data-act="remove" data-id="${pid}" title="Quitar">${icon('x', 14)}</button>
        </div>`;
    }).join('') : `<div class="cart-empty">${icon('cart', 22)}<div style="margin-top:6px">El carrito está vacío.<br>Agrega tortas del catálogo.</div></div>`;
    document.getElementById('total-row').innerHTML = `<div class="total-row"><span class="t">Total</span><span class="v">${Store.money(total)}</span></div>`;
    const btn = document.getElementById('btn-checkout');
    btn.disabled = !entries.length || ui.busy;
    btn.innerHTML = `${icon('cart', 15)} ${ui.busy ? 'Procesando…' : 'Confirmar pedido'}`;
  }

  /* ---------- tienda: acciones ---------- */
  const cartCount = () => Object.values(ui.cart).reduce((s, n) => s + n, 0);

  function readDraft() {
    return {
      name: $('#f-name').value.trim(), phone: $('#f-phone').value.trim(),
      address: $('#f-addr').value.trim(), note: $('#f-note').value.trim(),
      deliveryDate: $('#f-date').value || '',
      payMethod: ui.payMethod, forceDecline: $('#f-decline').checked,
      items: Object.entries(ui.cart).map(([pid, qty]) => { const p = Store.prod(pid); return { pid, name: p.name, price: p.price, qty }; }),
    };
  }

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
        ui.cart = {};
        Store.event('cliente', `confirma ${res.order.id}`);
        const entrega = res.order.deliveryDate ? Store.fecha(res.order.deliveryDate) : 'lo antes posible';
        const waTxt = encodeURIComponent(
          `Hola, Tortas · Hechas a Mano. Quiero hacer un pedido:\n` +
          res.order.items.map(it => `• ${it.qty}× ${it.name}`).join('\n') +
          `\nTotal: ${Store.money(res.order.total)} (${res.order.payMethod})` +
          `\nEntrega: ${entrega}` +
          `\nNombre: ${res.order.customer.name} — Dirección: ${res.order.customer.address}` +
          (res.order.customer.note ? `\nMensaje en la torta: "${res.order.customer.note}"` : '')
        );
        openModal(`
          <div class="modal-ic" style="background:var(--green-soft);color:var(--green-text)">${icon('check', 22)}</div>
          <h3>Pedido ${res.order.id} confirmado</h3>
          <div class="rows">
            ${res.order.items.map(it => `<div><span>${it.qty}× ${Store.esc(it.name)}</span><span>${Store.money(it.price * it.qty)}</span></div>`).join('')}
            <div><span><b>Total</b> · ${res.order.payMethod}</span><b>${Store.money(res.order.total)}</b></div>
          </div>
          <p>Pago: <b>${res.order.payStatus}</b> · Entrega: <b>${entrega}</b>.</p>
          <p class="dim">Te escribimos para confirmar. Deja la pestaña abierta y verás el avance del pedido aquí mismo.</p>
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

  /* ---------- panel: renders ---------- */
  function updateKPIs() {
    const db = Store.db;
    const hoy = new Date().toDateString();
    const todays = db.orders.filter(o => new Date(o.createdAt).toDateString() === hoy);
    const ingresos = db.orders.filter(o => o.payStatus === 'aprobado' || o.payStatus === 'cobrado').reduce((s, o) => s + o.total, 0);
    const validos = db.orders.filter(o => o.status !== 'cancelado').length;
    const pendientes = db.orders.filter(o => ['nuevo', 'preparando', 'enviado'].includes(o.status)).length;
    document.getElementById('kpis').innerHTML = [
      ['receipt', 'gold', 'Pedidos hoy', todays.length],
      ['cash', 'green', 'Ingresos', Store.money(ingresos)],
      ['zap', 'blue', 'Ticket promedio', Store.money(ingresos / Math.max(1, validos))],
      ['clock', 'amber', 'Pendientes', pendientes],
    ].map(([ic, cl, k, v]) => `
      <div class="kpi"><div class="ic ${cl}">${icon(ic, 17)}</div><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');
  }

  function filteredOrders() {
    const f = ui.filter;
    return Store.db.orders.filter(o =>
      f === 'todos' ? true :
      f === 'activos' ? ['nuevo', 'preparando', 'enviado'].includes(o.status) :
      f === 'entregados' ? o.status === 'entregado' :
      o.status === 'cancelado');
  }

  function updateFilters() {
    document.getElementById('order-filters').innerHTML = [
      ['todos', 'Todos'], ['activos', 'En curso'], ['entregados', 'Entregados'], ['cancelados', 'Cancelados'],
    ].map(([v, l]) => `<button class="${ui.filter === v ? 'on' : ''}" data-act="filter" data-v="${v}">${l}</button>`).join('');
  }

  function updateOrders() {
    const list = filteredOrders();
    document.getElementById('orders-body').innerHTML = list.map(o => `
      <tr class="${o.status === 'cancelado' ? 'dim-row' : ''}">
        <td><div class="strong mono">${o.id}</div><div class="cell-sub">${Store.hora(o.createdAt)}${o.deliveryDate ? ` · entrega ${Store.fecha(o.deliveryDate)}` : ""}</div></td>
        <td><div>${Store.esc(o.customer.name)}</div><div class="cell-sub">${Store.esc(o.customer.phone)} · ${Store.esc(o.customer.address)}</div></td>
        <td class="items-cell" title="${o.items.map(it => `${it.qty}× ${Store.esc(it.name)}`).join(', ')}">${o.items.map(it => `${it.qty}× ${Store.esc(it.name)}`).join(', ')}</td>
        <td class="num">${Store.money(o.total)}</td>
        <td><span class="badge ${PAY[o.payStatus]}"><span class="dot"></span>${o.payStatus}${o.payMethod === 'efectivo' ? ' · efvo.' : ' · transf.'}</span></td>
        <td><span class="badge ${META[o.status].badge}"><span class="dot"></span>${STATUS_LABEL[o.status]}</span></td>
        <td class="row-actions">
          ${Store.NEXT[o.status] ? `<button class="btn sm" data-act="advance" data-id="${o.id}" title="Avanzar a ${STATUS_LABEL[Store.NEXT[o.status]]}">${icon('arrow', 14)} ${STATUS_LABEL[Store.NEXT[o.status]]}</button>` : ''}
          ${!['entregado', 'cancelado'].includes(o.status) ? `<button class="btn sm icon" data-act="ask-cancel" data-id="${o.id}" title="Cancelar pedido">${icon('x', 14)}</button>` : ''}
        </td>
      </tr>`).join('') || '<tr><td colspan="7"><div class="empty">Sin pedidos en este filtro</div></td></tr>';
  }

  function updateTab() {
    const db = Store.db;
    document.getElementById('panel-tabs').innerHTML = [
      ['inventario', 'Disponibilidad'], ['clientes', 'Clientes'], ['actividad', 'Actividad'],
    ].map(([v, l]) => `<button class="${ui.tab === v ? 'on' : ''}" data-act="tab" data-v="${v}">${l}</button>`).join('');

    const body = document.getElementById('tab-body');
    document.getElementById('tab-title').textContent = { inventario: 'Disponibilidad del dia', clientes: 'Clientes', actividad: 'Actividad reciente' }[ui.tab];

    if (ui.tab === 'inventario') {
      body.innerHTML = `<table class="table">
        <thead><tr><th>Producto</th><th class="num" style="text-align:right">Precio</th><th>Stock</th><th></th></tr></thead>
        <tbody>${db.products.map(p => `
          <tr>
            <td><div style="display:flex;align-items:center;gap:10px">${pimg(p, 30)}<b>${Store.esc(p.name)}</b></div></td>
            <td class="num">${Store.money(p.price)}</td>
            <td><div class="stockbar"><span class="bar"><i style="width:${Math.min(100, p.stock / 30 * 100)}%;background:${stockDot(p.stock)}"></i></span><span style="font-size:12.5px;color:var(--text-2)">${p.stock} u</span></div></td>
            <td class="row-actions"><button class="btn sm" data-act="restock" data-id="${p.id}" title="Ampliar capacidad del dia">+5</button></td>
          </tr>`).join('')}</tbody>
      </table>`;
    } else if (ui.tab === 'clientes') {
      body.innerHTML = `<table class="table">
        <thead><tr><th>Cliente</th><th>Teléfono</th><th class="num" style="text-align:right">Pedidos</th><th class="num" style="text-align:right">Consumo</th></tr></thead>
        <tbody>${db.customers.map(c => `
          <tr><td><b>${Store.esc(c.name)}</b></td><td class="mono">${Store.esc(c.phone)}</td><td class="num">${c.orders}</td><td class="num">${Store.money(c.spent)}</td></tr>`).join('')
          || '<tr><td colspan="4"><div class="empty">Sin clientes aún</div></td></tr>'}</tbody>
      </table>`;
    } else {
      const IC = { order: 'receipt', stock: 'package', pay: 'card', client: 'users' };
      const CL = { order: 'gold', stock: 'amber', pay: 'green', client: 'blue' };
      body.innerHTML = `<div class="feed">${db.notifications.map(n => `
        <div class="feed-item">
          <span class="ic ${CL[n.kind] || 'indigo'}">${icon(IC[n.kind] || 'bell', 15)}</span>
          <div><div class="tx">${Store.esc(n.text)}</div><div class="tm">${n.at}</div></div>
        </div>`).join('') || '<div class="empty">Sin actividad</div>'}</div>`;
    }
  }

  /* ---------- devtools: renders ---------- */
  function updateDevKPIs() {
    const ev = Store.db.events;
    const http = ev.filter(e => e.kind === 'http');
    const avg = http.length ? Math.round(http.reduce((s, e) => s + (e.ms || 0), 0) / http.length) : 0;
    document.getElementById('dev-kpis').innerHTML = [
      ['receipt', 'indigo', 'Peticiones HTTP', http.length],
      ['zap', 'green', 'Latencia media', avg ? avg + ' ms' : '—'],
      ['bell', 'amber', 'Eventos de negocio', ev.length - http.length],
    ].map(([ic, cl, k, v]) => `
      <div class="kpi"><div class="ic ${cl}">${icon(ic, 17)}</div><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');
  }

  const ARQ_MODULES = ['pedidos', 'inventario', 'clientes', 'pagos', 'notificaciones'];
  function updateArch(pulse) {
    const ev = Store.db.events;
    const byMod = m => ev.filter(e => (e.modules || [e.module]).includes(m));
    const evOf = m => ev.filter(e => (e.modules || []).includes(m) || e.module === m || e.source === m);
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    // capas fijas
    set('arq-cliente-c', `${evOf('cliente').length} eventos`);
    set('arq-web-c', `${evOf('web').length} eventos`);
    set('arq-api-c', `${ev.filter(e => e.kind === 'http').length} peticiones`);
    set('arq-panel-c', `${evOf('panel').length} eventos`);
    for (const m of ARQ_MODULES) {
      const list = byMod(m);
      set(`arq-${m}-c`, `${list.length} eventos`);
      set(`arq-${m}-l`, list[0] ? (list[0].label || list[0].path || '') : '—');
    }
    if (pulse) {
      const box = document.getElementById('arq-' + (ev[0] && (ev[0].modules || [ev[0].module])[0]));
      if (box) { box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse'); setTimeout(() => box.classList.remove('pulse'), 420); }
    }
  }

  function updateRequests() {
    const ev = Store.db.events.filter(e =>
      ui.logFilter === 'todos' ? true : ui.logFilter === 'http' ? e.kind === 'http' : e.kind === 'ev');
    document.getElementById('log-filters').innerHTML = [
      ['todos', 'Todos'], ['http', 'HTTP'], ['ev', 'Eventos'],
    ].map(([v, l]) => `<button class="${ui.logFilter === v ? 'on' : ''}" data-act="log-filter" data-v="${v}">${l}</button>`).join('');
    document.getElementById('req-body').innerHTML = ev.map(e => `
      <tr>
        <td class="mono" style="color:var(--text-3)">${e.at}</td>
        <td>${e.kind === 'http'
          ? `<span class="method m-${e.method}">${e.method}</span><span class="mono">${Store.esc(e.path)}</span>${e.label ? `<div class="cell-sub">${Store.esc(e.label)}</div>` : ''}`
          : `<span class="method m-EVT">EVT</span>${Store.esc(e.label)}`}</td>
        <td><span class="badge b-gray">${e.source || 'sistema'}</span></td>
        <td>${(e.modules || [e.module]).map(m => `<span class="mod-chip">${m}</span>`).join('')}</td>
        <td>${e.kind === 'http'
          ? (e.status < 300 ? `<span class="status-ok mono">${e.status}</span>` : `<span class="status-bad mono">${e.status}</span>`)
          : '<span style="color:var(--text-3)">—</span>'}</td>
        <td class="num mono" style="color:var(--text-2)">${e.ms != null ? e.ms + ' ms' : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="6"><div class="empty">Sin tráfico aún — haz algo en la tienda o el panel</div></td></tr>';
  }

  function updateState() {
    const { events, ...data } = Store.db;
    document.getElementById('state-view').textContent = JSON.stringify(data, null, 2);
  }

  /* ---------- acciones globales (delegación) ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const { act, id, v } = el.dataset;
    switch (act) {
      case 'add': { const p = Store.prod(id); ui.cart[p.id] = (ui.cart[p.id] || 0) + 1; Store.event('web', `carrito: +1 ${p.name}`); updateProducts(); updateCart(); break; }
      case 'inc': { const p = Store.prod(id); if (ui.cart[p.id] < p.stock) { ui.cart[p.id]++; Store.event('web', `carrito: +1 ${p.name}`); updateProducts(); updateCart(); } break; }
      case 'dec': { const p = Store.prod(id); ui.cart[p.id] = (ui.cart[p.id] || 0) - 1; if (ui.cart[p.id] <= 0) delete ui.cart[p.id]; else Store.event('web', `carrito: -1 ${p.name}`); updateProducts(); updateCart(); break; }
      case 'remove': { const p = Store.prod(id); delete ui.cart[id]; Store.event('web', `carrito: quitar ${p.name}`); updateProducts(); updateCart(); break; }
      case 'checkout': submitOrder(); break;
      case 'modal-close': closeModal(); break;
      case 'confirm-ok': { const cb = pendingConfirm; pendingConfirm = null; closeModal(); cb && cb(); break; }
      case 'ask-cancel':
        confirmDialog({
          title: `¿Cancelar pedido ${id}?`,
          body: 'El stock reservado volverá al inventario y el cliente quedará notificado.',
          ok: 'Cancelar pedido', danger: true,
          onOk: () => Store.cancelOrder(id).catch(err => toast(Store.esc(err.message), 'bell')),
        });
        break;
      case 'advance': Store.advanceOrder(id).catch(err => toast(Store.esc(err.message), 'bell')); break;
      case 'restock': Store.restock(id).catch(err => toast(Store.esc(err.message), 'bell')); break;
      case 'filter': ui.filter = v; updateFilters(); updateOrders(); break;
      case 'tab': ui.tab = v; updateTab(); break;
      case 'log-filter': ui.logFilter = v; updateRequests(); break;
      case 'copy-state':
        navigator.clipboard.writeText(JSON.stringify(Store.db, null, 2))
          .then(() => toast('JSON copiado al portapapeles', 'check'))
          .catch(() => toast('No se pudo copiar', 'bell'));
        break;
      case 'reset':
        confirmDialog({
          title: '¿Reiniciar la demo?',
          body: 'Se regeneran los datos de ejemplo y se borra la traza. Afecta a todas las pestañas abiertas.',
          ok: 'Reiniciar', danger: true,
          onOk: () => Store.resetDemo(),
        });
        break;
    }
  });

  document.addEventListener('change', e => {
    if (e.target.name === 'pay') {
      ui.payMethod = e.target.value;
      document.getElementById('decline-wrap').hidden = ui.payMethod !== 'transferencia';
    }
  });

  render();
})();
