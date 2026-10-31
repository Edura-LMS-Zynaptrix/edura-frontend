import '@testing-library/jest-dom';

// Every test starts signed out with empty browser storage.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// jsdom has no layout engine; components that observe size or scroll need stubs.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverStub;
(globalThis as any).IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};
// jsdom's crypto has no randomUUID (the chat widget uses it for guest sessions).
if (!globalThis.crypto?.randomUUID) {
  const { randomUUID } = require('crypto');
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: randomUUID });
}
window.scrollTo = jest.fn() as any;
Element.prototype.scrollIntoView = jest.fn();
Element.prototype.scrollTo = jest.fn() as any;
window.matchMedia =
  window.matchMedia ||
  ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }) as any);
