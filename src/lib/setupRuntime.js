import AsyncStorage from '@react-native-async-storage/async-storage';

const memory = new Map();

function hydrateKey(k) {
  AsyncStorage.getItem(k)
    .then((v) => {
      if (v != null) memory.set(k, v);
    })
    .catch(() => {});
}

/**
 * Minimal localStorage shim for POS web code ported to RN (OrderPanel, Footer, etc.).
 * Values persist to AsyncStorage asynchronously.
 */
export function installLocalStorageShim(keysToHydrate = []) {
  if (!globalThis.localStorage) {
  globalThis.localStorage = {
    getItem(k) {
      if (memory.has(k)) return memory.get(k);
      return null;
    },
    setItem(k, v) {
      const s = String(v);
      memory.set(k, s);
      AsyncStorage.setItem(k, s).catch(() => {});
    },
    removeItem(k) {
      memory.delete(k);
      AsyncStorage.removeItem(k).catch(() => {});
    },
    clear() {
      memory.clear();
      AsyncStorage.clear().catch(() => {});
    },
  };
  }
  for (const k of keysToHydrate) hydrateKey(k);
}

/**
 * Rewrites same-origin paths to hit the Node backend from the tablet.
 */
export function installFetchRewrite(apiBase) {
  const base = String(apiBase || '').replace(/\/$/, '');
  const origin = base.endsWith('/api') ? base.slice(0, -4) : base.replace(/\/api$/, '');
  const apiPrefix = base.endsWith('/api') ? base : `${origin}/api`;

  const origFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (input, init) => {
    if (typeof input === 'string') {
      let url = input;
      if (url.startsWith('/api')) {
        url = `${apiPrefix}${url.slice(4)}`;
      } else if (url.startsWith('/') && !url.startsWith('//')) {
        url = `${origin}${url}`;
      }
      return origFetch(url, init);
    }
    return origFetch(input, init);
  };

  return { origin, apiPrefix };
}
