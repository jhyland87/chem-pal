import { UOM } from "constants/app";
import { toUSD } from "helpers/currency";
import { toBaseQuantity } from "helpers/quantity";
import { type Product } from "types";
import type { CAS } from "types/cas";

/**
 * Builder class for constructing Product objects
 * Implements the Builder pattern to handle complex product construction
 */
export class ProductBuilder {
  private product: Partial<Product> = {};
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  protected _isCAS(cas: unknown): cas is CAS<string> {
    if (typeof cas !== "string") return false;
    return cas.match(/^\d{2}-\d{3}-\d{3}$/) !== null;
  }

  setBasicInfo(title: string, url: string, supplier: string): ProductBuilder {
    this.product.title = title;
    this.product.url = url;
    this.product.supplier = supplier;
    return this;
  }

  setPricing(price: number, currencyCode: string, currencySymbol: string): ProductBuilder {
    this.product.price = price;
    this.product.currencyCode = currencyCode;
    this.product.currencySymbol = currencySymbol;
    return this;
  }

  setQuantity(quantity: number, uom: string): ProductBuilder {
    this.product.quantity = quantity;
    this.product.uom = uom;
    return this;
  }

  setDescription(description: string): ProductBuilder {
    this.product.description = description;
    return this;
  }

  setCAS(cas: string): ProductBuilder {
    if (this._isCAS(cas)) {
      this.product.cas = cas;
    }
    return this;
  }

  private _isMinimalProduct(product: unknown): product is Partial<Product> {
    if (!product || typeof product !== "object") return false;

    const requiredStringProps = {
      quantity: "number",
      price: "number",
      uom: "string",
      url: "string",
      currencyCode: "string",
      currencySymbol: "string",
      title: "string",
    };

    const hasAllRequiredProps = Object.entries(requiredStringProps).every(([key, val]) => {
      return key in product && typeof product[key as keyof typeof product] === val;
    });

    return hasAllRequiredProps;
  }

  private _isProduct(product: unknown): product is Product {
    return (
      typeof product === "object" &&
      product !== null &&
      "price" in product &&
      "quantity" in product &&
      "uom" in product
    );
  }

  private _href(path: string | URL): string {
    const urlObj = new URL(path, this.baseURL);
    return urlObj.toString();
  }

  async build(): Promise<Product | void> {
    if (!this._isMinimalProduct(this.product)) {
      return;
    }

    this.product.usdPrice = this.product.price ?? 0;
    this.product.baseQuantity =
      toBaseQuantity(this.product.quantity ?? 0, this.product.uom as UOM) ??
      this.product.quantity ??
      0;

    if (this.product.currencyCode !== "USD") {
      this.product.usdPrice = await toUSD(
        this.product.price ?? 0,
        this.product.currencyCode ?? "USD",
      );
    }

    if (!this._isProduct(this.product)) {
      console.error(`ProductBuilder| Invalid product: ${JSON.stringify(this.product)}`);
      return;
    }

    this.product.url = this._href(this.product.url);
    return this.product as Product;
  }
}
