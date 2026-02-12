// Test setup – polyfills and global mocks for Vitest + jsdom
import '@testing-library/jest-dom';

// Mock window.shokai for Electron preload APIs
Object.defineProperty(window, 'shokai', {
    value: {
        store: {
            get: async (_k: string) => undefined,
            set: async (_k: string, _v: any) => { },
            delete: async (_k: string) => { },
        },
        updater: {
            checkForUpdate: async () => ({ success: false, error: 'test' }),
            installUpdate: async () => { },
            onStatus: () => () => { },
        },
    },
    writable: true,
});
