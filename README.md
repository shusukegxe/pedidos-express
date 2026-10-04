# 🧾 PedidosExpress

Prototipo funcional de un sistema de pedidos en HTML puro: sin instalar nada, sin dependencias,
sin backend real. La "base de datos" es `localStorage` y la "API" es un enrutador simulado con
latencia — pero la forma de las operaciones (`POST /pedidos`, `PATCH /pedidos/:id`…) es la que
tendría un backend de verdad.

**Demo en vivo (GitHub Pages):** https://shusukegxe.github.io/pedidos-express/

## Las 3 apps

| App | Página | Qué es |
|---|---|---|
| 🛒 Cliente | [`cliente.html`](cliente.html) | Tienda: catálogo con stock, carrito, checkout, pagos simulados, seguimiento del pedido. |
| 📊 Manager | [`manager.html`](manager.html) | Panel del negocio: KPIs, gestión de pedidos (avanzar/cancelar), inventario, clientes, notificaciones. |
| 🛠️ DevTools | [`devtools.html`](devtools.html) | Diagrama de arquitectura en vivo, traza completa del backend, datos crudos, reinicio de la demo. |

**Pruébalo en modo multi-ventana:** abre el *cliente* en una pestaña y el *manager* en otra.
Haz un pedido en el cliente → aparece solo en el manager → avanza el estado en el manager →
al cliente le llega el aviso. Las tres apps se hablan por `localStorage` + `BroadcastChannel`
(una foto honesta de lo que sería un backend con webhooks).

También sigue disponible [`prototipo.html`](prototipo.html), la versión monolítica original
(tienda + panel + arquitectura en una sola página).

## Cómo probarlo

1. **Flujo feliz**: cliente agrega productos → checkout → el pedido aparece en el manager →
   avánzalo de estado (`nuevo → en preparación → en camino → entregado`).
2. **Pago rechazado**: en el cliente, marca "forzar rechazo de pago" y paga con tarjeta.
3. **Stock agotado / bajo**: pide más de lo que hay, o vacía un producto (alerta al bajar de 3 u).
4. **Cancelar pedido**: devuelve el stock automáticamente.
5. **Reiniciar demo**: botón en devtools (afecta a todas las pestañas).

## Arquitectura

```
cliente.html ─┐
manager.html ─┼── core.js ── localStorage (datos + traza) + BroadcastChannel (avisos)
devtools.html ┘
```

- `core.js` contiene la "base de datos" (seed, carga, guardado), el enrutador simulado
  (`call()` con latencia), los módulos de negocio (pedidos, inventario, clientes, pagos,
  notificaciones) y el bus de sincronización entre pestañas.
- Cada página tiene solo su capa de vista (render + eventos).
- La traza de cada llamada queda en `localStorage` (`pedidos-express-log-v2`), así que
  devtools ve el tráfico generado por las otras pestañas.

## Límites (a propósito)

Nada de esto es producción: no hay usuarios reales, pagos reales ni multiusuario. Para
llevarlo a producción: reemplazar `call()` por `fetch` a una API real (Node/Express,
etc.), el `localStorage` por una base de datos, y la pasarela simulada por Stripe /
MercadoPago. La separación en módulos está pensada para que ese cambio sea directo.
