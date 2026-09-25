import type { TokenStorage } from './types.js';

export class LocalStorageTokenStorage implements TokenStorage {
  private readonly prefix: string;

  constructor(prefix = 'qo_auth_') {
    this.prefix = prefix;
  }

  getItem(key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(this.prefix + key);
  }

  setItem(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.prefix + key, value);
  }

  removeItem(key: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.prefix + key);
  }
}

export class MemoryTokenStorage implements TokenStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

export function createDefaultStorage(): TokenStorage {
  if (typeof localStorage !== 'undefined') {
    return new LocalStorageTokenStorage();
  }
  return new MemoryTokenStorage();
}
