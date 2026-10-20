# Better Antigravity 🚀

Colección monorepo de plugins, extensiones, sidecars y herramientas avanzadas para optimizar y personalizar la experiencia en **Google Antigravity**.

Este repositorio está estructurado para alojar múltiples plugins modulares e independientes, permitiendo instalarlos y desplegarlos fácilmente en el entorno local de Antigravity (`~/.gemini/config/plugins/`).

---

## 📦 Plugins Incluidos

| Plugin | Versión | Tipo | Descripción |
| :--- | :--- | :--- | :--- |
| [**subscription-tracker**](./plugins/subscription-tracker) | `1.0.0` | UI Sidecar & Skill | Monitor visual en tiempo real de consumo de cuotas por modelo, ventanas temporales (`5h`, `week`, `month`), contadores regresivos y ciclo de facturación mensual perpetuo con estética de terminal minimalista. |

---

## 🎨 Características de `subscription-tracker`

- 📟 **Estética Terminal Minimalista**: Fondo negro absoluto (`#000`), fuentes monoespaciadas, micro-tarjetas con bordes punteados e indicadores de estado en color ámbar (`▶ ▶`).
- 📊 **Monitorización Simultánea por Ventana**: Muestra barras de progreso ultra-delgadas (2px) para cada ventana de tiempo disponible por modelo (`5h`, `semanal` y `mensual`).
- 🤖 **Jerarquía Fija de Modelos**:
  1. `gemini-3.8-flash`
  2. `gemini-4-argon`
  3. `claude-sonnet-5.5`
  4. `claude-opus-5.5`
  5. `gpt-oss-120b`
- 🎯 **Orden Consistente de Niveles de Razonamiento**: Muestra los niveles siempre en la secuencia `high · medium · low`.
- ⏱️ **Ciclo Mensual Perpetuo**: Reseteo automático cada día 16 de mes (o fecha configurable en un solo clic con el botón `corte: día 16`).
- 🔄 **Sincronización en Vivo**: Auto-actualización cada minuto con el Language Server local (`auto 1m`), con contadores regresivos locales en tiempo real segundo a segundo.
- ⚡ **Acceso Rápido**: Accesible directamente mediante el protocolo nativo `sidecar://subscription-tracker/quota-monitor/` o desde la paleta de comandos / skills.

---

## 📁 Estructura del Monorepo

```text
better-antigravity/
├── plugins/
│   └── subscription-tracker/
│       ├── sidecars/
│       │   └── quota-monitor/
│       │       ├── server.mjs       # Servidor HTTP nativo Node.js e interfaz visual
│       │       ├── sidecar.json    # Definición de puerto y comando de inicio
│       │       └── settings.json   # Configuraciones de persistencia local
│       ├── skills/
│       │   └── quota-tracker/
│       │       └── SKILL.md        # Definición de skill para el agente Antigravity
│       ├── plugin.json             # Manifiesto del plugin
│       ├── package.json            # Metadatos del paquete
│       └── README.md               # Documentación específica del plugin
├── scripts/
│   ├── install-plugins.ps1         # Script de instalación para Windows PowerShell
│   └── install-plugins.sh          # Script de instalación para Linux / macOS
├── .gitignore
├── package.json                    # Configuración raíz del monorepo
└── README.md                       # Documentación principal
```

---

## 🚀 Instalación y Despliegue Local

Para instalar todos los plugins del monorepo en tu entorno local de Antigravity:

### En Windows (PowerShell)
```powershell
# Ejecutar script directo
.\scripts\install-plugins.ps1

# O utilizando npm
npm run install:plugins
```

### En Linux / macOS (Bash)
```bash
# Ejecutar script directo
./scripts/install-plugins.sh

# O utilizando npm
npm run install:plugins:sh
```

El script copia y sincroniza automáticamente cada plugin dentro del directorio estándar de Antigravity:
- Windows: `%USERPROFILE%\.gemini\config\plugins\`
- Linux / macOS: `~/.gemini/config/plugins/`

---

## 🛠️ Cómo Añadir Nuevos Plugins al Monorepo

Para agregar un nuevo plugin a este repositorio:

1. **Crear el directorio del plugin:**
   ```bash
   mkdir -p plugins/mi-nuevo-plugin
   ```

2. **Crear el manifiesto `plugin.json`:**
   ```json
   {
     "name": "mi-nuevo-plugin",
     "version": "1.0.0",
     "description": "Descripción de la funcionalidad de tu plugin",
     "author": "Tu Nombre",
     "skills": ["skills/mi-skill/SKILL.md"],
     "sidecars": ["sidecars/mi-sidecar/sidecar.json"]
   }
   ```

3. **Desarrollar tus componentes:**
   - Si incluye interfaz gráfica o servidor de soporte, colócalo bajo `sidecars/<nombre>/`.
   - Si incluye habilidades para el agente de IA, añade sus guías bajo `skills/<nombre>/SKILL.md`.

4. **Probar la instalación local:**
   ```powershell
   npm run install:plugins
   ```

5. **Hacer commit y push a la rama principal:**
   ```bash
   git add plugins/mi-nuevo-plugin
   git commit -m "feat(plugin): añadir plugin mi-nuevo-plugin"
   git push origin main
   ```

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).
