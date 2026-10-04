# 🧾 PedidosExpress v3

Prototipo profesional de un sistema de pedidos en una sola página (SPA sin framework):
la "base de datos" es `localStorage`, la "API" es un enrutador simulado con latencia y
registro de peticiones, y las tres aplicaciones conviven en la misma interfaz con router
hash — compartiendo datos y tráfico en vivo entre pestañas del navegador.

**Demo en vivo (GitHub Pages):** https://shusukegxe.github.io/pedidos-express/

## Las 3 aplicaciones (rutas)

| Ruta | App | Qué es |
|---|---|---|
| `#/tienda` | 🛒 **Tienda** | Catálogo con búsqueda y stock en vivo, carrito, checkout con métodos de pago, confirmación modal y barra de seguimiento del pedido (Recibido → En preparación → En camino → Entregado) que avanza en tiempo real. |
| `#/panel` | 📊 **Panel del negocio** | KPIs, pedidos con filtros (Todos / En curso / Entregados / Cancelados) y acciones de un click, inventario con barras de stock y reposición, clientes y actividad reciente. |
| `#/devtools` | 🛠️ **DevTools** | Arquitectura en vivo (contadores por módulo), registro estructurado de peticiones (método, ruta, origen, código HTTP, latencia), estado crudo en JSON y reinicio de la demo. |

**Pruébalo multi-ventana:** abre `#/tienda` en una pestaña y `#/panel` en otra.
Un pedido hecho en la tienda aparece solo en el panel; al avanzar el estado, la tienda
recibe el aviso. Todo viaja por `localStorage` + `BroadcastChannel`.

## Arquitectura

```
index.html (shell + sidebar) ── app.js (router + vistas + iconos SVG)
        │
     core.js (Store: datos + API simulada + bus entre pestañas)
        │
   localStorage (pedidos-express-v3: productos, pedidos, clientes,
                 notificaciones y registro de eventos/peticiones)
```

- **`core.js`** — el núcleo: seed, carga/guardado, enrutador simulado `api()` (latencia
  80–220 ms, códigos de estado reales: 200/402/409), módulos de negocio (pedidos,
  inventario, clientes, pagos, notificaciones) y sincronización.
- **`app.js`** — la interfaz: router hash, tres vistas con render estructural + updates
  dirigidos (sin re-render global), delegación de eventos en un solo listener, e iconos
  SVG inline (cero dependencias).
- **`style.css`** — design system: tokens de color, componentes (botones, badges,
  tablas, KPIs, modales, toasts) y responsive.

## Qué probar

1. **Flujo feliz**: Tienda → agrega productos → confirma → el pedido aparece en Panel →
   avánzalo con la flecha y mira la barra de seguimiento en Tienda (si está abierta).
2. **Pago rechazado**: en Tienda elige Tarjeta, marca "forzar rechazo (demo)" y confirma
   — verás un HTTP `402` en DevTools.
3. **Stock**: pide más unidades de las que hay (HTTP `409`), vacía un producto (alerta
   de bajo stock) y repón con "+5" desde el Panel.
4. **Cancelar pedido**: desde el Panel, con devolución de stock.
5. **DevTools**: tabla de peticiones en vivo (`POST /pedidos · cliente · 200 · 142 ms`),
   diagrama de arquitectura con contadores, JSON de estado y reinicio.

## Límites (a propósito)

Nada de esto es producción: no hay usuarios reales, pagos reales ni multiusuario. Para
llevarlo a producción: reemplazar `api()` por `fetch` contra un backend real (Node/Express
o similar), `localStorage` por una base de datos, y la pasarela simulada por Stripe /
MercadoPago. La separación core/vistas está pensada para que ese cambio sea directo.

## Changelog

- **v3** — rediseño completo: SPA con router, design system propio, API con log
  estructurado (método/ruta/estado/latencia), seguimiento visual de pedidos, filtros y
  búsqueda. Reemplaza la versión de 3 páginas y el monolito (en el historial de git).
- **v2** — 3 apps separadas (cliente/manager/devtools) compartiendo localStorage.
- **v1** — prototipo monolítico en un solo HTML.
