'use strict';
/* Tortas · Hechas a Mano — tienda de pedidos.
   Esta página es SOLO de pedidos: el panel del negocio vive en tortas-manager
   y las estadísticas/devtools en tortas-devtools. Las tres comparten el mismo
   Store (localStorage + BroadcastChannel) y se ven en vivo entre pestañas. */

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
  document.querySelectorAll('.nav a[data-icon]').forEach(a => a.insertAdjacentHTML('afterbegin', icon(a.dataset.icon, 17)));

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

  // ---------- estado de la interfaz ----------
  const ui = {
    cart: {},            // pid -> cantidad
    lastOrderId: null,
    lastSeenStatus: null,
    payMethod: 'transferencia',
    busy: false,
  };

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

  // ---------- renders ----------
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
          <p class="dim">Te escribimos para confirmar. Deja la pestaña abierta y verás el avance de tu pedido aquí mismo.</p>
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

  // ---------- eventos (delegación) ----------
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const { act, id } = el.dataset;
    switch (act) {
      case 'add': { const p = Store.prod(id); ui.cart[p.id] = (ui.cart[p.id] || 0) + 1; Store.event('web', `carrito: +1 ${p.name}`); updateProducts(); updateCart(); break; }
      case 'inc': { const p = Store.prod(id); if (ui.cart[p.id] < p.stock) { ui.cart[p.id]++; Store.event('web', `carrito: +1 ${p.name}`); updateProducts(); updateCart(); } break; }
      case 'dec': { const p = Store.prod(id); ui.cart[p.id] = (ui.cart[p.id] || 0) - 1; if (ui.cart[p.id] <= 0) delete ui.cart[p.id]; else Store.event('web', `carrito: -1 ${p.name}`); updateProducts(); updateCart(); break; }
      case 'remove': { const p = Store.prod(id); delete ui.cart[id]; Store.event('web', `carrito: quitar ${p.name}`); updateProducts(); updateCart(); break; }
      case 'checkout': submitOrder(); break;
      case 'modal-close': closeModal(); break;
    }
  });

  document.addEventListener('change', e => {
    if (e.target.name === 'pay') {
      ui.payMethod = e.target.value;
      document.getElementById('decline-wrap').hidden = ui.payMethod !== 'transferencia';
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
