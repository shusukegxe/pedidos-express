'use strict';
/* Smoke test funcional de la página de pedidos (código real sobre jsdom). */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const DIR = __dirname + '/..';
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

  // 1. render inicial: SOLO pedidos (sin panel ni devtools en el contenido)
  ok(d.querySelectorAll('.product').length === 5, 'tienda: 5 tortas renderizadas');
  ok(d.querySelectorAll('.product img.pimg').length === 5, 'productos: foto real en cada tarjeta');
  ok(d.querySelectorAll('.nav a').length === 0, 'sidebar: sin enlaces a otras apps');
  const uiTxt = d.getElementById('app').textContent;
  ok(uiTxt.indexOf('Panel del negocio') === -1 && uiTxt.indexOf('DevTools') === -1
    && uiTxt.indexOf('tortas-manager') === -1 && uiTxt.indexOf('tortas-devtools') === -1,
    'página: solo pedidos — sin rastro del panel o las devtools en la UI');
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{25A0}-\u{25FF}]/u;
  ok(!EMOJI.test(d.body.textContent), 'UI sin emojis ni glifos decorativos');

  // 2. carrito con tamaños
  d.querySelector('[data-act="add"][data-id="p1"]').click();
  d.querySelector('[data-act="inc"][data-id="p1"]').click();
  d.querySelector('[data-act="add"][data-id="p3"]').click();
  await sleep(50);
  ok(d.getElementById('cart-count').textContent === '3 items', 'carrito: 3 items tras agregar');
  ok(d.getElementById('total-row').textContent.includes('S/ 222.00'), 'carrito: 2 Selva Negra M (S/ 72) + Cheesecake M (S/ 78) = S/ 222.00');
  ok(!!d.querySelector('#cart .pj-tam'), 'carrito: selector de tamaño por línea');
  const sel = d.querySelector('#cart .pj-tam');
  sel.value = 'G';
  sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await sleep(30);
  ok(d.getElementById('total-row').textContent.includes('S/ 268.00'), 'tamaños: Selva Negra a Grande → S/ 268.00');
  const gsel = [...d.querySelectorAll('#cart .pj-tam')].find(x => x.dataset.tam === 'p1-G');
  gsel.value = 'M';
  gsel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await sleep(30);
  d.querySelector('[data-act="dec"][data-id="p1"]').click();
  await sleep(20);
  ok(d.getElementById('total-row').textContent.includes('S/ 150.00'), 'carrito: -1 Selva Negra → S/ 150.00');

  // 3. personalizada: editor manual + chat presente
  d.querySelector('[data-act="personalizar"]').click();
  await sleep(30);
  ok(!!d.querySelector('#pj-masa'), 'personalizada: modal con editor');
  ok(!!d.querySelector('#pj-chat-input'), 'personalizada: chat de IA presente');
  d.getElementById('pj-extra').value = 'tema de mariposas';
  d.getElementById('pj-generar-desc').click();
  ok(d.getElementById('pj-desc').value.includes('mariposas'), 'personalizada: descripción armada desde los campos');
  d.getElementById('pj-add-pers').click();
  await sleep(30);
  ok(d.getElementById('cart-count').textContent === '3 items', 'personalizada: agregada al carrito (3 unidades en 3 líneas)');
  ok(d.getElementById('total-row').textContent.includes('S/ 270.00'), 'personalizada: total S/ 270.00 (150 + 120)');

  // 4. checkout en efectivo (determinista: la transferencia simulada rechaza el 10% al azar)
  d.querySelector('input[name="pay"][value="efectivo"]').checked = true;
  d.querySelector('input[name="pay"][value="efectivo"]').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  d.getElementById('f-name').value = 'Cliente de prueba';
  d.getElementById('f-phone').value = '555-0199';
  d.getElementById('f-addr').value = 'Av. Test #123';
  d.getElementById('btn-checkout').click();
  await sleep(1600);
  const modalTxt = d.getElementById('modal-root').textContent;
  ok(modalTxt.includes('Pedido O-0003 confirmado'), 'checkout: modal de confirmación con O-0003');
  ok(modalTxt.includes('S/ 270.00'), 'checkout: total correcto en soles');
  ok(!!d.querySelector('.modal .btn.wa') && d.querySelector('.modal .btn.wa').href.includes('wa.me'), 'checkout: enlace wa.me con el resumen');
  ok(!!d.querySelector('.tracker'), 'tienda: barra de seguimiento visible');
  ok(d.querySelector('.tracker').textContent.includes('Recibido'), 'tracker: paso "Recibido" presente');
  d.querySelector('[data-act="modal-close"]').click();

  // 4. persistencia
  const persisted = JSON.parse(dom.window.localStorage.getItem('tortas-pedidos-v1'));
  ok(persisted.orders.length === 3 && persisted.seq === 4, 'persistencia: localStorage con 3 pedidos y seq=4');
  ok(!EMOJI.test(JSON.stringify(persisted.products)), 'datos: seed sin emojis');

  console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('EXCEPCIÓN:', e); process.exit(1); });
