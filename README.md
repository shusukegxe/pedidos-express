# Tortas · Hechas a Mano — Pedidos

Página de pedidos para el negocio de tortas caseras **Tortas · Hechas a Mano**:
catálogo con fotos reales, carrito, fecha de entrega, mensaje en la torta,
transferencia/efectivo simulados y envío del resumen por WhatsApp.
Esta página es **solo de pedidos** — la gestión vive en el panel y las
estadísticas/devtools en sus propios sitios.

**Demo en vivo:** https://shusukegxe.github.io/pedidos-express/

Diseño, catálogo y precios tomados del repo de referencia
[venta-tortas-caseras](https://github.com/shusukegxe/venta-tortas-caseras)
(paleta kraft/marrón/dorado, tipografías Caveat + Playfair Display + Poppins).

Las tres aplicaciones del sistema (repos separados, mismo Store compartido vía
`localStorage` + `BroadcastChannel` en `shusukegxe.github.io` — ábrelas en
pestañas distintas y véalas hablarse):

| Página | Repo | Qué hace |
|---|---|---|
| **Hacer pedido** (esta) | [pedidos-express](https://github.com/shusukegxe/pedidos-express) | Catálogo con fotos, carrito, checkout y WhatsApp. |
| Panel del negocio | [tortas-manager](https://github.com/shusukegxe/tortas-manager) | KPIs, gestión de pedidos, disponibilidad, clientes y actividad. |
| Estadísticas y DevTools | [tortas-devtools](https://github.com/shusukegxe/tortas-devtools) | Ventas por producto, ingresos por día, arquitectura en vivo, registro de la API. |

## El catálogo (del repo de referencia)

| Torta | Precio |
|---|---|
| Selva Negra | $18.000 |
| Tres Leches | $17.000 |
| Cheesecake | $20.000 |
| Torta de Chantilly | $16.500 |
| Personalizada | desde $22.000 |

Flujo del pedido: `Recibido → En preparación → En camino → Entregado` — con la
barra de seguimiento en vivo y avisos cuando el panel avanza tu pedido.

## Técnica

SPA sin framework: `core.js` (Store: datos + API simulada con log + bus entre
pestañas) + `app.js` (vista única de pedidos) + `style.css` (design system).
Cero emojis en la UI, iconografía SVG inline, sin build.

Test funcional: `npm i jsdom && node test/smoke.cjs`.
