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
  private capacity: number;
  private cache: Map<string, LruNode>;
  private head: LruNode | null;
  private tail: LruNode | null;

  private constructor(capacity: number = DEFAULT_CAPACITY) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
  }

  public static async getInstance(capacity: number = DEFAULT_CAPACITY): Promise<HttpLru> {
    if (HttpLru.#instance) {
      return HttpLru.#instance;
    }
    const data = await chrome.storage.local.get(["httplru"]);
    if (data.httplru) {
      const httplru = new HttpLru(capacity);
      httplru.cache = new Map(Object.entries(data.httplru.cache));
      httplru.head = data.httplru.head;
      httplru.tail = data.httplru.tail;
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
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      this.moveToHead(node);
      return node.value;
    }
    return null;
  }

  async put(key: string, value: FetchDecoratorResponse): Promise<void> {
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToHead(node);
    } else {
      const newNode: LruNode = { key, value, prev: null, next: this.head };
      if (this.head) {
        this.head.prev = newNode;
      }
      this.head = newNode;
      if (!this.tail) {
        this.tail = newNode;
      }
      this.cache.set(key, newNode);
      if (this.cache.size > this.capacity) {
        this.cache.delete(this.tail.key);
        this.tail = this.tail.prev;
        if (this.tail) {
          this.tail.next = null;
        } else {
          this.head = null;
        }
      }
    }
    // Save to chrome.storage.local
    await this.saveToStorage();
  }

  private async moveToHead(node: LruNode): Promise<void> {
    if (node === this.head) {
      return;
    }
    if (node === this.tail) {
      this.tail = node.prev;
    } else if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    // Save to chrome.storage.local after moving node
    await this.saveToStorage();
  }

  private async saveToStorage(): Promise<void> {
    const cacheData = Object.fromEntries(this.cache);
    await chrome.storage.local.set({
      httplru: {
        cache: cacheData,
        head: this.head,
        tail: this.tail,
      },
    });
  }
}
