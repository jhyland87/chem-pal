> [!NOTE]
> WORK IN PROGRESS - Plenty of bugs exist and were working on them as time permits.

Just a simple React/Typescript plugin for Chrome

Example output:

<img src="./assets/images/chem-pal-demo.gif" alt="chem-pal example" width="600"/>

## Node version

- Make sure youre on node v22.15.0 and npm v10.9.2 or higher (use nvm if needed)

- Windows NVM: Installer is [here](https://github.com/coreybutler/nvm-windows/releases) (i've never tried it)
- OSX: Run `brew install nvm`, then follow the steps about updating your `~/.bash_profile` that it shows you in the output.

After nvm is installed, run:

```bash
nvm install --lts
nvm use --lts
node --version # Should output v22.15.0
```

Install pnpm (package manager)
```bash
npm install -g pnpm
```

## Building the extension

For local development — loading as an unpacked extension:

```bash
git clone https://github.com/jhyland87/chem-pal.git
cd chem-pal
pnpm run setup
pnpm run build
```

Then import the `build/` folder as an unpacked Chrome extension.

> [!WARNING]
> `pnpm run build` produces a **development** build and includes the MSW
> mock service worker plus source maps. Do **not** submit the output of
> `pnpm run build` to the Chrome Web Store.

For a Chrome Web Store submission bundle, use:

```bash
pnpm run build:prod
```

This runs the production Vite build and packs the extension via
`tools/pack-extension.js`. The resulting artifact is the only build
intended for store submission.

## Development

```bash
# Install dev dependencies
pnpm run setup

# Run unit tests
pnpm run test

# Run the build.
pnpm run build
```