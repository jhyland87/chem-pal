Just a simple React/Typescript plugin for Chrome - A simple proof of concept.


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

## Building the extension

```bash
git clone https://github.com/jhyland87/chem-crawler.git
cd chem-crawler
npm install --legacy-peer-deps
npm run build
```

Then import the build folder as an unpacked chrome extension.

## Development

```bash
# Install dev dependencies
npm run install-dev

# Run unit tests
npm run test

# Start local app (doesn't work so well currently, outside of chrome)
npm run dev
```