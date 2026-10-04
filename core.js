'use strict';
/* PedidosExpress — núcleo: estado + API simulada + sincronización entre pestañas.
   El "backend" es un setTimeout y la "base de datos" es localStorage, pero la forma
   de las operaciones (POST /pedidos, PATCH /pedidos/:id...) es la que tendría una
   API real; toda llamada queda registrada con método, ruta, estado y latencia. */

const Store = (() => {
  const KEY = 'pedidos-express-v3-1';
  const LOW = 3;

  // ---------- utilidades ----------
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const lat = () => 80 + Math.random() * 140;
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
        { id: 'p1', name: 'Hamburguesa clásica', price: 8.5,  stock: 12 },
        { id: 'p2', name: 'Pizza pepperoni',     price: 11,   stock: 8  },
        { id: 'p3', name: 'Tacos (3 u)',         price: 7,    stock: 15 },
        { id: 'p4', name: 'Papas fritas',        price: 3.5,  stock: 20 },
        { id: 'p5', name: 'Refresco',            price: 2,    stock: 30 },
        { id: 'p6', name: 'Brownie',             price: 4,    stock: 5  },
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
        { kind: 'order', text: 'Sistema iniciado con datos de ejemplo.', at: '09:00:00' },
      ],
      events: [],
    };
  }

  function load() {
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

  let db = load() || seedAndWrite();
  const prod = id => db.products.find(p => p.id === id);

  // ---------- sincronización entre pestañas ----------
  const bus = 'BroadcastChannel' in window ? new BroadcastChannel('pedidos-express-v3') : null;
  const subs = new Set();
  const emit = () => { for (const fn of subs) { try { fn(); } catch {} } };
  window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) sync(); });
  if (bus) bus.onmessage = () => sync();
  let syncing = false;
  function sync() {
    if (syncing) return;
    syncing = true;
    try {
      const fresh = load();
      if (fresh) { db = fresh; emit(); }
    } finally { syncing = false; }
  }
  function subscribe(fn) { subs.add(fn); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
    try { bus && bus.postMessage(Date.now()); } catch {}
  }

  // ---------- registro de eventos (lo que ve devtools) ----------
  function record(e) {
    db.events.unshift({ at: ahora(), ...e });
    if (db.events.length > 150) db.events.length = 150;
    save();
    emit();
  }
  // evento de dominio (sin http): "bajo stock", "pedido creado"...
  function event(module, label) { record({ kind: 'ev', module, label }); }

  // ---------- API simulada ----------
  async function api(method, path, modules, source, work) {
    const t0 = performance.now();
    await sleep(lat());
    try {
      const res = await work();
      record({ kind: 'http', method, path, modules, source, status: (res && res.status) || 200, ms: Math.round(performance.now() - t0), label: res && res.reason });
      return res;
    } catch (err) {
      record({ kind: 'http', method, path, modules, source, status: err.status || 400, ms: Math.round(performance.now() - t0), label: err.message });
      throw err;
    }
  }

  // ---------- módulo notificaciones ----------
  function notify(kind, text) {
    db.notifications.unshift({ kind, text, at: ahora() });
    if (db.notifications.length > 40) db.notifications.length = 40;
  }

  function checkLow(p) {
    if (p.stock <= LOW && !p.lowWarned) {
      p.lowWarned = true;
      event('inventario', `bajo stock: ${p.name} (${p.stock} u)`);
      notify('stock', `Bajo stock: ${p.name} — quedan ${p.stock} u`);
    } else if (p.stock > LOW) p.lowWarned = false;
  }

  // ---------- operaciones de negocio ----------
  const NEXT = { nuevo: 'preparando', preparando: 'enviado', enviado: 'entregado' };
  const STATUS_LABEL = { nuevo: 'Nuevo', preparando: 'En preparación', enviado: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado' };
  const FLOW = ['nuevo', 'preparando', 'enviado', 'entregado'];

  async function placeOrder(draft) {
    return api('POST', '/pedidos', ['pedidos', 'clientes', 'inventario', 'pagos'], 'cliente', async () => {
      if (!draft.items.length) { const e = new Error('El carrito está vacío'); e.status = 400; throw e; }

      event('clientes', `upsert cliente ${draft.phone}`);
      let cust = db.customers.find(c => c.phone === draft.phone);
      if (!cust) db.customers.push(cust = { phone: draft.phone, name: draft.name, orders: 0, spent: 0 });

      for (const it of draft.items) {
        const p = prod(it.pid);
        if (!p || p.stock < it.qty) { const e = new Error(`Stock insuficiente de ${it.name}`); e.status = 409; throw e; }
      }
      event('inventario', `stock reservado (${draft.items.length} artículos)`);

      let payStatus = 'pendiente';
      if (draft.payMethod === 'tarjeta') {
        event('pagos', 'autorizando tarjeta…');
        await sleep(lat());
        payStatus = draft.forceDecline ? 'rechazado' : (Math.random() < 0.9 ? 'aprobado' : 'rechazado');
        event('pagos', `autorización: ${payStatus}`);
      }
      if (payStatus === 'rechazado') {
        notify('pay', `Pago rechazado de ${draft.name}`);
        save();
        return { ok: false, status: 402, reason: 'El pago fue rechazado. Prueba con otro método.' };
      }

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
      event('pedidos', `${id} creado · ${money(order.total)}`);
      notify('order', `Nuevo pedido ${id} de ${draft.name} · ${money(order.total)}`);
      save();
      return { ok: true, order };
    });
  }

  async function advanceOrder(id) {
    return api('PATCH', `/pedidos/${id}`, ['pedidos', 'pagos'], 'panel', async () => {
      const o = db.orders.find(x => x.id === id);
      const next = NEXT[o.status];
      if (!next) { const e = new Error('El pedido ya está en estado final'); e.status = 409; throw e; }
      o.status = next;
      o.history.push({ status: next, at: Date.now() });
      if (next === 'entregado' && o.payMethod === 'efectivo' && o.payStatus === 'pendiente') {
        o.payStatus = 'cobrado';
        event('pagos', `cobro en efectivo registrado (${id})`);
      }
      event('pedidos', `${id} → ${STATUS_LABEL[next].toLowerCase()}`);
      notify('order', `Pedido ${id}: ${STATUS_LABEL[next]}`);
      save();
      return o;
    });
  }

  async function cancelOrder(id) {
    return api('PATCH', `/pedidos/${id}`, ['pedidos', 'inventario'], 'panel', async () => {
      const o = db.orders.find(x => x.id === id);
      if (!o || o.status === 'entregado' || o.status === 'cancelado') { const e = new Error('No cancelable'); e.status = 409; throw e; }
      o.status = 'cancelado';
      o.history.push({ status: 'cancelado', at: Date.now() });
      for (const it of o.items) { const p = prod(it.pid); if (p) { p.stock += it.qty; checkLow(p); } }
      event('inventario', `stock devuelto (${id})`);
      event('pedidos', `${id} cancelado`);
      notify('order', `Pedido ${id} cancelado · stock repuesto`);
      save();
      return o;
    });
  }

  async function restock(pid) {
    return api('POST', `/inventario/${pid}/reposicion`, ['inventario'], 'panel', async () => {
      const p = prod(pid);
      p.stock += 5; p.lowWarned = false;
      event('inventario', `reposición: ${p.name} +5 u (${p.stock} u)`);
      notify('stock', `Reposición: ${p.name} ahora ${p.stock} u`);
      save();
      return p;
    });
  }

  function resetDemo() {
    db = seedAndWrite();
    save();
    emit();
  }

  return {
    get db() { return db; },
    LOW, NEXT, FLOW, STATUS_LABEL,
    money, hora, ahora, esc,
    subscribe, save, prod, event,
    placeOrder, advanceOrder, cancelOrder, restock, resetDemo,
  };
})();
