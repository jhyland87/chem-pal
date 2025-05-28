import { FetchDecoratorResponse } from "@/helpers/request/fetch";

interface LruNode {
  key: string;
  value: FetchDecoratorResponse;
  prev: LruNode | null;
  next: LruNode | null;
}

const DEFAULT_CAPACITY = 100;

export class HttpLru {
  static #instance: HttpLru | null = null;
  private _capacity: number;
  private _cache: Map<string, LruNode>;
  private _head: LruNode | null;
  private _tail: LruNode | null;

  private constructor(capacity: number = DEFAULT_CAPACITY) {
    this._capacity = capacity;
    this._cache = new Map();
    this._head = null;
    this._tail = null;
  }

  public static async getInstance(capacity: number = DEFAULT_CAPACITY): Promise<HttpLru> {
    if (HttpLru.#instance) {
      return HttpLru.#instance;
    }
    const data = await chrome.storage.local.get(["httplru"]);
    if (data.httplru) {
      const httplru = new HttpLru(capacity);
      httplru._cache = new Map(Object.entries(data.httplru.cache));
      httplru._head = data.httplru.head;
      httplru._tail = data.httplru.tail;
      HttpLru.#instance = httplru;
      return httplru;
    } else {
      HttpLru.#instance = new HttpLru(capacity);
      return HttpLru.#instance;
    }
  }

  async getByHash(hash: string): Promise<FetchDecoratorResponse | null> {
    return await this.get(hash);
  }

  async putByHash(hash: string, value: FetchDecoratorResponse): Promise<void> {
    return await this.put(hash, value);
  }

  async get(key: string): Promise<FetchDecoratorResponse | null> {
    if (this._cache.has(key)) {
      const node = this._cache.get(key)!;
      this.moveToHead(node);
      return node.value;
    }
    return null;
  }

  async put(key: string, value: FetchDecoratorResponse): Promise<void> {
    if (this._cache.has(key)) {
      const node = this._cache.get(key)!;
      node.value = value;
      this.moveToHead(node);
    } else {
      const newNode: LruNode = { key, value, prev: null, next: this._head };
      if (this._head) {
        this._head.prev = newNode;
      }
      this._head = newNode;
      if (!this._tail) {
        this._tail = newNode;
      }
      this._cache.set(key, newNode);
      if (this._cache.size > this._capacity) {
        this._cache.delete(this._tail.key);
        this._tail = this._tail.prev;
        if (this._tail) {
          this._tail.next = null;
        } else {
          this._head = null;
        }
      }
    }
    // Save to chrome.storage.local
    await this.saveToStorage();
  }

  private async moveToHead(node: LruNode): Promise<void> {
    if (node === this._head) {
      return;
    }
    if (node === this._tail) {
      this._tail = node.prev;
    } else if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
    node.prev = null;
    node.next = this._head;
    if (this._head) {
      this._head.prev = node;
    }
    this._head = node;
    // Save to chrome.storage.local after moving node
    await this.saveToStorage();
  }

  private async saveToStorage(): Promise<void> {
    const cacheData = Object.fromEntries(this._cache);
    await chrome.storage.local.set({
      httplru: {
        cache: cacheData,
        head: this._head,
        tail: this._tail,
      },
    });
  }
}
