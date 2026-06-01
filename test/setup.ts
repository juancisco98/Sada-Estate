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
