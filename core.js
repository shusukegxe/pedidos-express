'use strict';
// PedidosExpress — núcleo compartido por las 3 apps (cliente, manager, devtools).
// el "backend" es un setTimeout y la "base de datos" es localStorage, pero la
// forma de las operaciones es la que tendría una API real. Las 3 apps comparten
// datos y traza vía localStorage + BroadcastChannel/storage events, así que
// abiertas en pestañas distintas se ven en vivo entre sí.

const Core = (() => {
  const KEY = 'pedidos-express-db-v2';
  const KEY_LOG = 'pedidos-express-log-v2';
  const LOW = 3;

  // ---------- utilidades ----------
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const lat = () => 120 + Math.random() * 250;              // latencia simulada de red
  const money = n => '$' + n.toFixed(2);
  const hora = t => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const ahora = () => new Date().toLocaleTimeString('es', { hour12: false });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  // ---------- la base de datos ----------
  function seedDb() {
    const t = Date.now();
    return {
      seq: 3,
      products: [
        { id: 'p1', emoji: '🍔', name: 'Hamburguesa clásica', price: 8.5,  stock: 12 },
        { id: 'p2', emoji: '🍕', name: 'Pizza pepperoni',     price: 11,   stock: 8  },
        { id: 'p3', emoji: '🌮', name: 'Tacos (3 u)',        price: 7,    stock: 15 },
        { id: 'p4', emoji: '🍟', name: 'Papas fritas',        price: 3.5,  stock: 20 },
        { id: 'p5', emoji: '🥤', name: 'Refresco',            price: 2,    stock: 30 },
        { id: 'p6', emoji: '🍰', name: 'Brownie',             price: 4,    stock: 5  },
      ],
      orders: [
        {
          id: 'O-0001', customer: { name: 'Ana Torres', phone: '555-0101', address: 'Calle 1 #23', note: '' },
          items: [{ pid: 'p1', name: 'Hamburguesa clásica', price: 8.5, qty: 2 }, { pid: 'p5', name: 'Refresco', price: 2, qty: 2 }],
          total: 21, payMethod: 'tarjeta', payStatus: 'aprobado', status: 'entregado', createdAt: t - 86400000,
          history: [{ status: 'nuevo', at: t - 86400000 }, { status: 'entregado', at: t - 86400000 + 3600000 }],
        },
        {
          id: 'O-0002', customer: { name: 'Luis Pérez', phone: '555-0102', address: 'Av. Central #45', note: 'sin cebolla' },
          items: [{ pid: 'p3', name: 'Tacos (3 u)', price: 7, qty: 2 }, { pid: 'p4', name: 'Papas fritas', price: 3.5, qty: 1 }],
          total: 17.5, payMethod: 'efectivo', payStatus: 'pendiente', status: 'nuevo', createdAt: t - 3600000,
          history: [{ status: 'nuevo', at: t - 3600000 }],
        },
      ],
      customers: [
        { phone: '555-0101', name: 'Ana Torres', orders: 1, spent: 21 },
        { phone: '555-0102', name: 'Luis Pérez', orders: 1, spent: 17.5 },
      ],
      notifications: [
        { icon: '👋', text: 'Prototipo iniciado. ¡Haz un pedido de prueba!', at: '09:00:00' },
      ],
    };
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.products)) return d;
      }
    } catch {}
    return null;
  }

  function seedAndWrite() {
    const d = seedDb();
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {}
    return d;
  }

  let db = loadFromStorage() || seedAndWrite();

  // ---------- bus entre pestañas ----------
  // al escribir en localStorage el navegador avisa a las OTRAS pestañas con un
  // evento `storage`; BroadcastChannel cubre el caso especial. El bus solo
  // "toca" a las otras pestañas: ellas releen todo de localStorage.
  const bus = 'BroadcastChannel' in window ? new BroadcastChannel('pedidos-express-bus-v2') : null;
  const listeners = new Set();
  const poke = () => { try { bus && bus.postMessage({ t: Date.now() }); } catch {} };

  window.addEventListener('storage', e => {
    if (e.key === KEY || e.key === KEY_LOG || e.key === null) syncNow();
  });
  if (bus) bus.onmessage = () => syncNow();

  let syncing = false;
  function syncNow() {
    if (syncing) return;
    syncing = true;
    try {
      const fresh = loadFromStorage();
      if (fresh) db = fresh;                       // tras un reset puede faltar un instante: se conserva
      for (const fn of listeners) { try { fn(); } catch {} }
    } finally { syncing = false; }
  }

  function onSync(fn) { listeners.add(fn); }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
    poke();
  }

  // ---------- la traza (lo que ve devtools) ----------
  const MODS = ['cliente', 'web', 'api', 'pedidos', 'inventario', 'clientes', 'pagos', 'notificaciones', 'panel'];
  const MOD_COLOR = {
    cliente: '#8ab4ff', web: '#7bd88f', api: '#ffd866', pedidos: '#ff8b6b', inventario: '#a9dc76',
    clientes: '#78dce8', pagos: '#ff6188', notificaciones: '#fc9867', panel: '#ab9df2',
  };

  function flowLog() {
    try { return JSON.parse(localStorage.getItem(KEY_LOG)) || []; } catch { return []; }
  }

  function flow(mod, msg) {
    const log = flowLog();
    log.unshift({ at: ahora(), mod, msg });
    if (log.length > 80) log.length = 80;
    try { localStorage.setItem(KEY_LOG, JSON.stringify(log)); } catch {}
    poke();
  }

  function counts(log) {
    const c = Object.fromEntries(MODS.map(m => [m, 0]));
    for (const e of log) if (e.mod in c) c[e.mod]++;
    return c;
  }

  // ---------- módulo notificaciones ----------
  function notify(icon, text) {
    db.notifications.unshift({ icon, text, at: ahora() });
    if (db.notifications.length > 40) db.notifications.pop();
    flow('notificaciones', text);
  }

  function checkLow(p) {
    if (p.stock <= LOW && !p.lowWarned) {
      p.lowWarned = true;
      notify('📦', `Bajo stock: ${p.name} (${p.stock} u)`);
    } else if (p.stock > LOW) p.lowWarned = false;
  }

  // ---------- backend simulado: enrutador ----------
  async function call(from, method, path, work) {
    flow(from, `${method} ${path}`);
    await sleep(lat());
    flow('api', `enrutando ${method} ${path}`);
    await sleep(lat());
    try {
      const res = await work();
      flow('api', `200 OK → ${from}`);
      return res;
    } catch (e) {
      flow('api', `error ${path}: ${e.message}`);
      throw e;
    }
  }

  // ---------- operaciones de negocio ----------
  const NEXT = { nuevo: 'preparando', preparando: 'enviado', enviado: 'entregado' };
  const STATUS_TXT = { nuevo: 'nuevo', preparando: 'en preparación', enviado: 'en camino', entregado: 'entregado', cancelado: 'cancelado' };
  const prod = id => db.products.find(p => p.id === id);

  async function placeOrder(draft) {
    return call('cliente', 'POST', '/pedidos', async () => {
      if (!draft.items.length) throw new Error('El carrito está vacío');

      // módulo clientes: upsert por teléfono
      flow('clientes', `upsert cliente ${draft.phone}`);
      let cust = db.customers.find(c => c.phone === draft.phone);
      if (!cust) db.customers.push(cust = { phone: draft.phone, name: draft.name, orders: 0, spent: 0 });

      // módulo inventario: validar stock
      for (const it of draft.items) {
        const p = prod(it.pid);
        if (!p || p.stock < it.qty) throw new Error(`Stock insuficiente de ${it.name} (quedan ${p ? p.stock : 0})`);
      }
      flow('inventario', `stock OK para ${draft.items.length} artículos`);

      // módulo pagos
      let payStatus = 'pendiente';
      if (draft.payMethod === 'tarjeta') {
        flow('pagos', 'autorizando tarjeta…');
        await sleep(lat());
        payStatus = draft.forceDecline ? 'rechazado' : (Math.random() < 0.9 ? 'aprobado' : 'rechazado');
        flow('pagos', `autorización: ${payStatus}`);
      }

      if (payStatus === 'rechazado') {
        flow('pedidos', 'pedido no generado (pago rechazado)');
        notify('❌', `Pago rechazado de ${draft.name}. No se generó pedido.`);
        save();
        return { ok: false, reason: 'El pago fue rechazado. Prueba con otro método.' };
      }

      // módulo pedidos: crear pedido + descontar inventario
      const id = 'O-' + String(db.seq++).padStart(4, '0');
      const order = {
        id,
        customer: { name: draft.name, phone: draft.phone, address: draft.address, note: draft.note },
        items: draft.items.map(it => ({ ...it })),
        total: draft.items.reduce((s, it) => s + it.price * it.qty, 0),
        payMethod: draft.payMethod, payStatus, status: 'nuevo',
        createdAt: Date.now(), history: [{ status: 'nuevo', at: Date.now() }],
      };
      for (const it of order.items) { const p = prod(it.pid); p.stock -= it.qty; checkLow(p); }
      db.orders.unshift(order);
      cust.orders++; cust.spent += order.total;
      flow('pedidos', `${id} creado · ${money(order.total)}`);
      notify('🧾', `Nuevo pedido ${id} de ${draft.name} — ${money(order.total)}`);
      save();
      return { ok: true, order };
    });
  }

  async function advanceOrder(id) {
    flow('panel', `avanzar ${id}`);
    return call('panel', 'PATCH', `/pedidos/${id}`, async () => {
      const o = db.orders.find(x => x.id === id);
      const next = NEXT[o.status];
      if (!next) throw new Error('Estado final');
      o.status = next;
      o.history.push({ status: next, at: Date.now() });
      flow('pedidos', `${id} → ${STATUS_TXT[next]}`);
      if (next === 'entregado' && o.payMethod === 'efectivo' && o.payStatus === 'pendiente') {
        o.payStatus = 'cobrado';
        flow('pagos', `cobro en efectivo registrado (${id})`);
      }
      notify('🚚', `Pedido ${id}: ${STATUS_TXT[next]}. Cliente notificado.`);
      flow('cliente', `recibe actualización de ${id}`);
      save();
      return o;
    });
  }

  async function cancelOrder(id) {
    flow('panel', `cancelar ${id}`);
    return call('panel', 'PATCH', `/pedidos/${id}`, async () => {
      const o = db.orders.find(x => x.id === id);
      if (!o || o.status === 'entregado' || o.status === 'cancelado') throw new Error('No cancelable');
      o.status = 'cancelado';
      o.history.push({ status: 'cancelado', at: Date.now() });
      for (const it of o.items) { const p = prod(it.pid); if (p) { p.stock += it.qty; checkLow(p); } }
      flow('inventario', `stock devuelto de ${id}`);
      flow('pedidos', `${id} cancelado`);
      notify('🚫', `Pedido ${id} cancelado. Stock repuesto.`);
      save();
      return o;
    });
  }

  async function restock(pid) {
    flow('panel', `reponer ${pid}`);
    return call('panel', 'POST', `/inventario/${pid}`, async () => {
      const p = prod(pid);
      p.stock += 5; p.lowWarned = false;
      flow('inventario', `${p.name} +5 u (total ${p.stock})`);
      notify('📦', `Reposición: ${p.name} ahora ${p.stock} u.`);
      save();
      return p;
    });
  }

  function resetDemo() {
    flow('api', 'reiniciando demo…');
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_LOG);
    db = seedAndWrite();
    flow('api', 'demo reiniciada (datos regenerados)');
    poke();
  }

  // ---------- toasts (todas las apps los usan) ----------
  function toast(msg) {
    let wrap = document.getElementById('toasts');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toasts'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  return {
    get db() { return db; },
    LOW, NEXT, STATUS_TXT, MODS, MOD_COLOR,
    sleep, lat, money, hora, ahora, esc, toast,
    flow, flowLog, counts, notify, checkLow, call, save,
    placeOrder, advanceOrder, cancelOrder, restock, resetDemo,
    onSync,
    prod,
  };
})();
