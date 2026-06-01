import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Desmonta el árbol de React tras cada test para evitar fugas entre tests.
afterEach(() => {
  cleanup();
});

// jsdom no implementa matchMedia (lo usa el ThemeContext / dark mode). Stub mínimo.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// jsdom no implementa scrollTo; algunos componentes lo invocan al montar.
if (!window.scrollTo) {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
}

// localStorage no siempre está disponible/funcional en jsdom bajo Node.
// Lo usa ThemeContext (dark mode). Stub in-memory.
if (typeof window.localStorage?.getItem !== 'function') {
  const store = new Map<string, string>();
  const localStorageMock: Storage = {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  });
}
