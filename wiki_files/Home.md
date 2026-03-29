# ChemPal Wiki

ChemPal is a Chrome extension for searching chemical suppliers and comparing product prices across 17+ vendors simultaneously. Built with React 19, TypeScript, and Vite, it streams results in real time as they arrive from each supplier.

## Quick Links

| Topic | Description |
|-------|-------------|
| [Getting Started](Getting-Started) | Prerequisites, installation, building, and loading the extension |
| [Architecture Overview](Architecture-Overview) | High-level system design and data flow |
| [Supplier System](Supplier-System) | How suppliers work, base classes, and adding new suppliers |
| [Search Flow](Search-Flow) | End-to-end search execution from input to rendered results |
| [Caching](Caching) | Chrome storage caching with LRU eviction |
| [Currency & Pricing](Currency-and-Pricing) | Multi-currency support, exchange rates, and price parsing |
| [PubChem Integration](PubChem-Integration) | Compound lookups, autocomplete, and SDQ queries |
| [Settings & Configuration](Settings-and-Configuration) | User settings, supplier selection, and persistence |
| [Testing](Testing) | Unit tests, E2E tests, mocking responses, and MSW setup |
| [Project Structure](Project-Structure) | Directory layout and file organization |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 |
| Language | TypeScript 5.8 |
| Bundler | Vite 6 |
| Component Library | MUI v7 (Material UI) |
| Data Table | TanStack React Table 8 |
| Package Manager | pnpm |
| Unit Testing | Vitest + MSW |
| E2E Testing | Vitest + Playwright |
| API Docs | TypeDoc |
| Extension Target | Chrome (Manifest v3) |
