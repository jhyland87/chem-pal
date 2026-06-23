# Getting Started

## Prerequisites

- **Node.js** v22.15.0 or higher
- **npm** v10.9.2 or higher
- **pnpm** (installed globally)

### Installing Node.js via NVM

**macOS:**
```bash
brew install nvm
# Follow the output instructions to update your ~/.bash_profile
```

**Windows:**
Download the installer from [nvm-windows releases](https://github.com/coreybutler/nvm-windows/releases).

**After NVM is installed:**
```bash
nvm install --lts
nvm use --lts
node --version   # Should output v22.15.0
```

### Installing pnpm

```bash
npm install -g pnpm
```

## Building the Extension

```bash
git clone https://github.com/jhyland87/chem-pal.git
cd chem-pal
pnpm run setup
pnpm run build
```

The build output is written to the `build/` directory.

## Loading in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `build/` directory

The extension will appear in your toolbar. Click the icon to open the popup, or use the side panel.

## Loading in Firefox

Firefox uses a separate build (the manifest swaps the Chrome side panel for a
sidebar and the service worker for a background script):

```bash
pnpm run build:firefox
```

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `build-firefox/manifest.json`

The extension appears in your toolbar; open it from the sidebar. Temporary
add-ons are removed when Firefox restarts.

## Development Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start Vite dev server |
| `pnpm run dev-mock` | Dev server with mocked API responses |
| `pnpm run build` | Build the Chrome extension to `build/` |
| `pnpm run build:firefox` | Build the Firefox extension to `build-firefox/` |
| `pnpm run build:aggregate` | Build with response capture enabled |
| `pnpm run build:full` | Type-check + build |
| `pnpm run test` | Run unit tests (Vitest, watch mode) |
| `pnpm run test:run` | Run unit tests once |
| `pnpm run test:e2e` | Run Chrome E2E tests (Playwright) |
| `pnpm run test:e2e:firefox` | Run Firefox load smoke test |
| `pnpm run lint:firefox` | Lint the Firefox build with `web-ext` |
| `pnpm run test:coverage` | Run tests with coverage report |
| `pnpm run test:ui` | Open Vitest UI with coverage |
| `pnpm run docs` | Generate TypeDoc API documentation |
| `pnpm run wwwdocs` | Serve generated docs on `localhost:8080` |
| `pnpm run lint` | Run ESLint |
| `pnpm run type-check` | Run TypeScript compiler (no emit) |
