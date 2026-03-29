# Currency & Pricing

ChemPal supports multi-currency display with automatic exchange rate conversion, allowing users to compare prices across international suppliers in their preferred currency.

## How It Works

```mermaid
flowchart LR
subgraph Input["Raw Price from Supplier"]
RAW["'$12.99' or '€45,00'\nor '¥1,200'"]
end

subgraph Parse["Price Parsing"]
PP["parsePrice(price)\nExtracts amount + currency symbol"]
SYM["getCurrencySymbol(price)\nDetects symbol from string"]
CODE["getCurrencyCodeFromSymbol(symbol)\nMaps symbol → ISO code"]
PP --> SYM --> CODE
end

subgraph Convert["Currency Conversion"]
RATE["getCurrencyRate(from, to)\nHexarate API with LRU cache"]
TOUSD["toUSD(amount, code)\nNormalize to USD"]
FROMUSD["USDto(amount, targetCode)\nConvert to user's currency"]
RATE --> TOUSD --> FROMUSD
end

subgraph Output["Displayed Price"]
DISPLAY["Formatted in user's\nselected currency"]
end

Input --> Parse --> Convert --> Output

classDef input fill:#5A7D8B,stroke:#3E5A66,color:#fff
classDef parse fill:#2EAD6B,stroke:#1F7A4A,color:#fff
classDef convert fill:#4A90D9,stroke:#2C5F8A,color:#fff
classDef output fill:#E8A838,stroke:#B8841F,color:#fff

class RAW input
class PP,SYM,CODE parse
class RATE,TOUSD,FROMUSD convert
class DISPLAY output
```

## Supported Currencies

| Code | Symbol | Location |
|------|--------|----------|
| USD | `$` | United States |
| CAD | `CA$` | Canada |
| GBP | `£` | United Kingdom |
| AUD | `AU$` | Australia |
| CNY | `¥` | China |
| INR | `₹` | India |
| RUB | `₽` | Russia |
| EUR | `€` | Finland, Germany |

## Key Functions

Located in `src/helpers/currency.ts`:

| Function | Description |
|----------|-------------|
| `parsePrice(price)` | Full price parsing — extracts numeric amount and detects currency |
| `getCurrencySymbol(price)` | Extracts the currency symbol from a price string |
| `getCurrencyRate(from, to)` | Fetches the exchange rate between two currencies (LRU cached, max 5 entries) |
| `toUSD(amount, currencyCode)` | Converts an amount to USD |
| `USDto(amount, currencyCode)` | Converts a USD amount to the target currency |
| `getCurrencyCodeFromSymbol(symbol)` | Maps a currency symbol to its ISO code |
| `getCurrencyCodeFromLocation(location)` | Maps a location code to the local currency |

## Exchange Rate Source

Rates are fetched from the [Hexarate API](https://hexarate.paikama.co) and cached using an in-memory LRU cache (max 5 entries) to avoid redundant API calls during a single session.

## Price Parsing

ChemPal uses the `price-parser` library (v3.4.0) for robust price extraction from varied supplier formats, supplemented by custom logic for currency symbol detection and normalization.
