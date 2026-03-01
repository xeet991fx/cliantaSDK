/**
 * Index (Entry Point) Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Setup mocks before import
import { type Mock } from 'vitest';

// Mock storage interface
interface StorageMock {
    store: Record<string, string>;
    getItem: Mock<[string], string | null>;
    setItem: Mock<[string, string], void>;
    removeItem: Mock<[string], void>;
    clear: Mock<[], void>;
}

function createStorageMock(): StorageMock {
    const mockStore: Record<string, string> = {};
    return {
        store: mockStore,
        getItem: vi.fn((key: string): string | null => mockStore[key] || null),
        setItem: vi.fn((key: string, value: string): void => { mockStore[key] = value; }),
        removeItem: vi.fn((key: string): void => { delete mockStore[key]; }),
        clear: vi.fn((): void => {
            for (const key in mockStore) delete mockStore[key];
        }),
    };
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', sessionStorageMock);
vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => '12345678-1234-1234-1234-123456789abc'),
});

// Mock navigator.sendBeacon
Object.defineProperty(navigator, 'sendBeacon', {
    value: vi.fn(() => true),
    writable: true,
});

// Mock fetch
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
})));

// Don't stub window, document, or history - jsdom provides real implementations

import { clianta, Tracker, ConsentManager, SDK_VERSION } from '../src/index';

describe('SDK Entry Point', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        sessionStorageMock.clear();
    });

    describe('clianta()', () => {
        it('should create tracker instance', () => {
            const tracker = clianta('workspace-1');
            expect(tracker).toBeDefined();
            expect(tracker.getWorkspaceId()).toBe('workspace-1');
        });

        it('should return same instance for same workspace', () => {
            const tracker1 = clianta('workspace-1');
            const tracker2 = clianta('workspace-1');
            expect(tracker1).toBe(tracker2);
        });

        it('should create new instance for different workspace', async () => {
            const tracker1 = clianta('workspace-1');
            const id1 = tracker1.getWorkspaceId();

            const tracker2 = clianta('workspace-2');
            const id2 = tracker2.getWorkspaceId();

            expect(id2).toBe('workspace-2');
            expect(id2).not.toBe(id1);
        });

        it('should accept configuration options', () => {
            const tracker = clianta('workspace-1', {
                debug: true,
                batchSize: 20,
            });
            const config = tracker.getConfig();
            expect(config.debug).toBe(true);
            expect(config.batchSize).toBe(20);
        });
    });

    describe('Exports', () => {
        it('should export Tracker class', () => {
            expect(Tracker).toBeDefined();
            expect(typeof Tracker).toBe('function');
        });



        it('should export ConsentManager class', () => {
            expect(ConsentManager).toBeDefined();
            expect(typeof ConsentManager).toBe('function');
        });

        it('should export SDK_VERSION', () => {
            expect(SDK_VERSION).toBeDefined();
            expect(typeof SDK_VERSION).toBe('string');
            expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
        });
    });

    describe('Window attachment', () => {
        it('should attach clianta to window', () => {
            expect((window as any).clianta).toBeDefined();
        });

        it('should attach Clianta namespace to window', () => {
            expect((window as any).Clianta).toBeDefined();
            expect((window as any).Clianta.clianta).toBe(clianta);
            expect((window as any).Clianta.Tracker).toBe(Tracker);
        });
    });
});
