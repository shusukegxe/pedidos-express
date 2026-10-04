'use strict';
/* Smoke test funcional de la SPA PedidosExpress v3, con código real en jsdom. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const DIR = 'C:/Users/etc/Desktop/prototipo-pedidos';
const html = fs.readFileSync(`${DIR}/index.html`, 'utf8')
  .replace('<script src="core.js"></script>', () => `<script>\n${fs.readFileSync(`${DIR}/core.js`, 'utf8')}\n</script>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${fs.readFileSync(`${DIR}/app.js`, 'utf8')}\n</script>`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  OK ' : ' FAIL') + ' ' + msg); if (!cond) fails++; };

(async () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  dom.window.onerror = e => { console.log('  ONERROR ' + e); fails++; };
  const d = dom.window.document;
  await sleep(300);

  // 1. render inicial de la tienda
  ok(d.querySelectorAll('.product').length === 5, 'tienda: 5 tortas renderizadas');
  ok(d.querySelectorAll('.product img.pimg').length === 5, 'productos: foto real en cada tarjeta');
  ok(d.querySelectorAll('.nav a').length === 3, 'sidebar: 3 apps en el menú');
  ok(!!d.querySelector('.product .name'), 'productos: nombre visible');
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{25A0}-\u{25FF}]/u;
  ok(!EMOJI.test(d.body.textContent), 'UI sin emojis ni glifos decorativos');

  // 2. carrito (tras agregar, el botón se convierte en stepper +/−)
  d.querySelector('[data-act="add"][data-id="p1"]').click();
  d.querySelector('[data-act="inc"][data-id="p1"]').click();
  d.querySelector('[data-act="add"][data-id="p3"]').click();
  await sleep(50);
  ok(d.getElementById('cart-count').textContent === '3 items', 'carrito: 3 items tras agregar');
  ok(d.getElementById('total-row').textContent.includes('$56.000'), 'carrito: total $56.000 en formato CLP (2 Selva Negra + Cheesecake)');
  const stepper = d.querySelector('[data-act="inc"][data-id="p1"]');
  ok(!!stepper, 'producto en carrito muestra stepper');
  d.querySelector('[data-act="dec"][data-id="p1"]').click();
  await sleep(20);
  ok(d.getElementById('total-row').textContent.includes('$38.000'), 'carrito: -1 Selva Negra → $38.000');

  // 3. checkout (efectivo, 2 latencias simuladas)
  d.getElementById('f-name').value = 'Cliente de prueba';
  d.getElementById('f-phone').value = '555-0199';
  d.getElementById('f-addr').value = 'Av. Test #123';
  d.getElementById('btn-checkout').click();
  await sleep(1400);
  const modalTxt = d.getElementById('modal-root').textContent;
  ok(modalTxt.includes('Pedido O-0003 confirmado'), 'checkout: modal de confirmación con O-0003');
  ok(modalTxt.includes('$38.000'), 'checkout: total correcto en CLP');
  ok(!!d.querySelector('.modal .btn.wa'), 'checkout: boton enviar por WhatsApp');
  ok(d.querySelector('.modal .btn.wa').href.includes('wa.me'), 'checkout: enlace wa.me con el resumen');
  ok(!!d.querySelector('.tracker'), 'tienda: barra de seguimiento visible');
  ok(d.querySelector('.tracker').textContent.includes('Recibido'), 'tracker: paso "Recibido" presente');
  d.querySelector('[data-act="modal-close"]').click();

  // 4. panel: el pedido nuevo aparece y avanza de estado
  dom.window.location.hash = '#/panel';
  await sleep(100);
  let fila = d.querySelector('#orders-body tr').textContent;
  ok(fila.includes('O-0003') && fila.includes('Cliente de prueba'), 'panel: O-0003 visible');
  ok(fila.includes('Nuevo'), 'panel: estado nuevo');
  ok(d.querySelectorAll('.kpi').length === 4, 'panel: 4 KPIs');
  d.querySelector('[data-act="advance"][data-id="O-0003"]').click();
  await sleep(1200);
  fila = d.querySelector('#orders-body tr').textContent;
  ok(fila.includes('En preparación'), 'panel: O-0003 avanzó a en preparación');

  // 5. devtools: registro y arquitectura
  dom.window.location.hash = '#/devtools';
  await sleep(100);
  const reqRows = d.querySelectorAll('#req-body tr').length;
  ok(reqRows >= 4, `devtools: registro con ${reqRows} filas (http + eventos)`);
  ok(d.getElementById('req-body').textContent.includes('POST') && d.getElementById('req-body').textContent.includes('/pedidos'), 'devtools: POST /pedidos registrado');
  ok(d.getElementById('req-body').textContent.includes('PATCH'), 'devtools: PATCH registrado');
  const pedidosCount = d.getElementById('arq-pedidos-c').textContent;
  ok(/^[1-9]/.test(pedidosCount), `devtools: módulo pedidos con eventos (${pedidosCount})`);
  ok(JSON.parse(d.getElementById('state-view').textContent).orders.length === 3, 'devtools: estado JSON con 3 pedidos');

  // 6. filtro del panel y persistencia
  dom.window.location.hash = '#/panel';
  await sleep(100);
  d.querySelector('[data-act="filter"][data-v="entregados"]').click();
  await sleep(50);
  ok(!d.querySelector('#orders-body').textContent.includes('O-0003'), 'panel: filtro entregados oculta O-0003');
  const persisted = JSON.parse(dom.window.localStorage.getItem('tortas-pedidos-v1'));
  ok(persisted.orders.length === 3 && persisted.seq === 4, 'persistencia: localStorage con 3 pedidos y seq=4');
  ok(!EMOJI.test(JSON.stringify(persisted.products)), 'datos: seed sin emojis');

  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('EXCEPCIÓN:', e); process.exit(1); });
