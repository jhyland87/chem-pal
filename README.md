Just a simple React/Typescript plugin for Chrome - A simple proof of concept.

To use it:
```bash
git clone https://github.com/jhyland87/chem-crawler.git
cd chem-crawler
npm install
npm run build
```

Then import the build folder as an unpacked chrome extension.

## Development
- Make sure youre on node v23 and npm v10 or higher.
```bash
# Install dev dependencies
npm run install-dev

# Run unit tests
npm run test

# Start local app (doesn't work so well currently, outside of chrome)
npm run dev
```