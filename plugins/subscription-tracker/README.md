# Subscription & Quota Tracker (`subscription-tracker`)

Plugin para Google Antigravity que añade una interfaz gráfica en el panel lateral (Auxiliary Pane) con estética de terminal minimalista para monitorizar en tiempo real el consumo de cuotas por modelo y ciclo de suscripción.

## Características

- 📟 **Estética Terminal Minimalista**: Fondo negro profundo (`#000`), tipografía monospace, indicadores en color ámbar (`▶ ▶`) y barras de progreso ultra-delgadas (2px) en color coral (`#ff6b4a`).
- 🤖 **Desglose de Cuotas por Modelo**:
  - `gemini-3.8-flash`: Ventana de 5 horas (`5h`) y ciclo mensual (`month`).
  - `gemini-4-argon`: Ventana semanal (`week`) y ciclo mensual (`month`).
  - `claude-sonnet-5.5`: Ventana de sesión (`5h`) y ciclo mensual (`month`).
  - `claude-opus-5.5`: Ventana de sesión (`5h`) y ciclo mensual (`month`).
  - `gpt-oss-120b`: Ventana de sesión (`5h`) y ciclo mensual (`month`).
- ⏱️ **Cálculo de Ciclo Mensual Perpetuo**: Reseteo automático cada día 16 de mes (configurable en 1 clic directamente desde el botón `corte: día 16` en la interfaz).
- 🔄 **Sincronización Automática cada 1 Minuto**: Actualización en segundo plano con el servidor de lenguaje local de Antigravity (`auto 1m`), manteniendo los contadores regresivos en vivo segundo a segundo.
- 🎯 **Orden Inmutable y Fijo**: Mantiene siempre la misma jerarquía de modelos y el mismo orden de niveles de esfuerzo (`high · medium · low`).

## Acceso Rápido

Haz clic en el enlace para abrir la vista en Antigravity:

- [Abrir Monitor de Cuotas](sidecar://subscription-tracker/quota-monitor/)
