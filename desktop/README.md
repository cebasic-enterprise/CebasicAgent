# CeBasic Agent — app de escritorio (Mac y Windows)

App de [Electron](https://www.electronjs.org/) que abre CeBasic Agent (LibreChat) en su propia ventana, con su icono, su menú en español y su instalador.

- La app no incluye el servidor. Se conecta a la URL de CeBasic Agent.
- El login es el de CeBasic (OpenID Connect) y ocurre dentro de la ventana. La app no guarda contraseñas.

## Seguridad

La página del servidor corre con `contextIsolation`, `sandbox` y sin `nodeIntegration`.

- **Enlaces externos:** los que abren pestaña nueva (`target=_blank`) se abren en el navegador del sistema.
- **Permisos:** solo el servidor configurado puede pedir micrófono (dictado), notificaciones y portapapeles.
- **Preload:** solo lo usan las páginas locales de ajustes y sin conexión. El proceso principal ignora sus mensajes si vienen de una página remota.

## Desarrollo

Requisitos: Node 22+.

```bash
cd desktop
npm install
npm start
```

La URL del servidor se decide así, de mayor a menor prioridad:

1. La variable `CEBASIC_AGENT_URL`, por ejemplo `CEBASIC_AGENT_URL=https://agent.ejemplo.com npm start`.
2. Lo que el usuario guarde en el menú **Servidor…** (`Cmd+,` en Mac, `Ctrl+,` en Windows). Se guarda en `config.json`, dentro de la carpeta de datos de la app.
3. `cebasic.defaultServerUrl` en `package.json`. Hoy es `https://agent.24-199-99-67.sslip.io` (producción en el droplet). Para probar contra local: `CEBASIC_AGENT_URL=http://localhost:3080 npm start`.

Si el servidor no responde, la app muestra una página con **Reintentar** y **Cambiar servidor**.

## Instaladores

```bash
npm run dist:mac   # dist/CeBasic Agent-<versión>-arm64.dmg (Apple Silicon) y CeBasic Agent-<versión>.dmg (Intel)
npm run dist:win   # dist/CeBasic Agent Setup <versión>.exe (Windows x64)
```

Los dos se generan desde una Mac. Windows no necesita Wine.

### Firma

- **Mac:** electron-builder firma con el certificado *Developer ID Application* del llavero. Falta **notarizar**; sin eso, macOS muestra una advertencia en otras Macs. Para notarizar:
  1. Exporta `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` y `APPLE_TEAM_ID` (o usa una API key de App Store Connect).
  2. Agrega `"notarize": true` en `build.mac`.
- **Windows:** el instalador sale sin firma, así que SmartScreen muestra "Windows protegió su PC" → *Más información* → *Ejecutar de todas formas*. Para quitar la advertencia hace falta un certificado de firma de código (OV/EV o Azure Trusted Signing).

## Iconos

Los iconos vienen del app icon de cebasicwork (`images/appicon.png`). Hay una copia en `../branding/source-appicon-cebasicwork.png`.

- `build/icon.png` (1024 px) tiene la forma de icono de macOS. De él salen `icon.icns` (Mac) e `icon.ico` (Windows).
- Para regenerar `icon.icns` desde `icon.png` usa `sips` + `iconutil`. Para `icon.ico` usa `magick`.
