# Tortas · Hechas a Mano — sistema de pedidos

Prototipo profesional de un sistema de pedidos para un negocio de tortas caseras,
construido como SPA sin framework. El diseño, el catálogo y los precios están tomados
del repo de referencia [venta-tortas-caseras](https://github.com/shusukegxe/venta-tortas-caseras)
(paleta kraft/marrón/dorado, tipografías Caveat + Playfair Display + Poppins, fotos reales
de producto).

La "base de datos" es `localStorage`, la "API" es un enrutador simulado con latencia y
registro de peticiones, y las tres aplicaciones conviven en la misma interfaz con router
hash — compartiendo datos y tráfico en vivo entre pestañas del navegador.

**Demo en vivo (GitHub Pages):** https://shusukegxe.github.io/pedidos-express/

## Las 3 aplicaciones (rutas)

| Ruta | App | Qué es |
|---|---|---|
| `#/tienda` | **Hacer pedido** | Catálogo de tortas con fotos reales, precios en CLP, búsqueda, carrito, fecha de entrega, mensaje en la torta, transferencia/efectivo simulados y envío del resumen por WhatsApp. |
| `#/panel` | **Panel del negocio** | KPIs, pedidos con filtros y acciones de un click, disponibilidad del día con reposición, clientes y actividad reciente. |
| `#/devtools` | **DevTools** | Arquitectura en vivo, registro estructurado de peticiones (método, ruta, origen, código HTTP, latencia), estado crudo en JSON y reinicio de la demo. |

**Pruébalo multi-ventana:** abre `#/tienda` en una pestaña y `#/panel` en otra.
Un pedido hecho en la tienda aparece solo en el panel; al avanzar el estado, la tienda
recibe el aviso. Todo viaja por `localStorage` + `BroadcastChannel`.

## El catálogo (del repo de referencia)

| Torta | Precio |
|---|---|
| Selva Negra | $18.000 |
| Tres Leches | $17.000 |
| Cheesecake | $20.000 |
| Torta de Chantilly | $16.500 |
| Personalizada | desde $22.000 |

Los estados del pedido siguen el flujo real del negocio:
`Recibido → En preparación → En camino → Entregado`.

## Arquitectura

```
index.html (shell + sidebar) ── app.js (router + vistas + iconos SVG)
        │
     core.js (Store: datos + API simulada + bus entre pestañas)
        │
   localStorage (tortas-pedidos-v1: productos, pedidos, clientes,
                 notificaciones y registro de eventos/peticiones)
        │
   assets/ (fotos de tortas redimensionadas desde venta-tortas-caseras)
```

## Qué probar

1. **Flujo feliz**: Tienda → agrega tortas → confirma → el pedido aparece en Panel →
   avánzalo con la flecha y mira la barra de seguimiento en Tienda (si está abierta).
2. **WhatsApp**: al confirmar, el modal ofrece "Enviar por WhatsApp" con el resumen del
   pedido ya redactado (wa.me).
3. **Transferencia rechazada**: marca "forzar rechazo (demo)" y confirma — HTTP `402`.
4. **Disponibilidad**: pide más de la capacidad del día (HTTP `409`) y repón con "+5".
5. **DevTools**: tabla de peticiones en vivo (`POST /pedidos · cliente · 200 · 142 ms`).

## Límites (a propósito)

Nada de esto es producción: no hay usuarios reales, pagos reales ni multiusuario. Para
llevarlo a producción: reemplazar `api()` por `fetch` contra un backend real, `localStorage`
por una base de datos, y la pasarela simulada por un proveedor real (webpay/transferencia
con verificación, MercadoPago, etc.). La separación core/vistas está pensada para que ese
cambio sea directo.

## Tests

`test/smoke.cjs` verifica el flujo completo (carrito, checkout CLP, WhatsApp, seguimiento,
avance de estado, registro de devtools, persistencia y ausencia de emojis) con código real
sobre jsdom: `npm i jsdom && node test/smoke.cjs`.

## Changelog

- **v4 (rebrand "Tortas")** — adaptación al negocio real de venta-tortas-caseras: catálogo
  y precios CLP, fotos de producto, paleta kraft, tipografías del sitio original, fecha de
  entrega y envío del pedido por WhatsApp.
- **v3.1** — pulido visual: fuente profesional, monogramas sin emojis, detalles CSS.
- **v3** — SPA con router, design system propio, API con log estructurado.
- **v2** — 3 apps separadas compartiendo localStorage. **v1** — monolito en un HTML.
