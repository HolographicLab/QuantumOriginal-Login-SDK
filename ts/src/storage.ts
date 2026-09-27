import type { TokenStorage } from './types.js';

/** Stores authentication data in browser `localStorage`. */
export class LocalStorageTokenStorage implements TokenStorage {
  private readonly prefix: string;

  /**
   * Creates a local-storage adapter.
   *
   * @param prefix Prefix applied to every storage key.
   */
  constructor(prefix = 'qo_auth_') {
    this.prefix = prefix;
  }

  /** Reads a value from local storage. */
  getItem(key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(this.prefix + key);
  }

  /** Writes a value to local storage. */
  setItem(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.prefix + key, value);
  }

  /** Removes a value from local storage. */
  removeItem(key: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.prefix + key);
  }
}

/** Stores authentication data in memory for the lifetime of this instance. */
export class MemoryTokenStorage implements TokenStorage {
  private readonly map = new Map<string, string>();

  /** Reads a value from memory. */
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  /** Writes a value to memory. */
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  /** Removes a value from memory. */
  removeItem(key: string): void {
    this.map.delete(key);
  }

  /** Removes every value stored by this instance. */
  clear(): void {
    this.map.clear();
  }
}

/**
 * Creates the default storage adapter for the current runtime.
 *
 * @returns Local storage in browsers or in-memory storage in other environments.
 */
export function createDefaultStorage(): TokenStorage {
  if (typeof localStorage !== 'undefined') {
    return new LocalStorageTokenStorage();
  }
  return new MemoryTokenStorage();
}
