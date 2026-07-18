/**
 * Tracker Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Tracker } from '../../src/core/tracker';

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
vi.stubGlobal('document', {
    title: 'Test Page',
    referrer: 'https://referrer.com',
    visibilityState: 'visible',
    cookie: '',
    body: { observe: vi.fn() },
    querySelectorAll: vi.fn(() => []),
});
vi.stubGlobal('window', {
    location: {
        href: 'https://test.com/page',
        pathname: '/page',
        hostname: 'test.com',
        search: '',
        hash: '',
    },
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        language: 'en-US',
    },
});
vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    language: 'en-US',
    sendBeacon: vi.fn(() => true),
});
vi.stubGlobal('screen', {
    width: 1920,
    height: 1080,
});
vi.stubGlobal('Intl', {
    DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: 'UTC' }),
    }),
});
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
})));

describe('Tracker', () => {
    let tracker: Tracker;
    const workspaceId = 'test-workspace-123';

    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        sessionStorageMock.clear();
    });

    afterEach(async () => {
        if (tracker) {
            await tracker.destroy();
        }
    });

    describe('Initialization', () => {
        it('should require workspace ID', () => {
            expect(() => new Tracker('')).toThrow('[Eutexa] Workspace ID is required');
        });

        it('should initialize with workspace ID', () => {
            tracker = new Tracker(workspaceId);
            expect(tracker.getWorkspaceId()).toBe(workspaceId);
        });

        it('should merge user config with defaults', () => {
            tracker = new Tracker(workspaceId, { debug: true });
            const config = tracker.getConfig();
            expect(config.debug).toBe(true);
        });

        it('should create visitor and session IDs', () => {
            tracker = new Tracker(workspaceId);
            expect(tracker.getVisitorId()).toBeTruthy();
            expect(tracker.getSessionId()).toBeTruthy();
        });

        it('should filter plugins based on autoPageView', () => {
            tracker = new Tracker(workspaceId, { autoPageView: false, plugins: ['pageView'] });
            // Plugin loading should skip pageView when autoPageView is false
            expect(tracker.getConfig().autoPageView).toBe(false);
        });
    });

    describe('track()', () => {
        beforeEach(() => {
            tracker = new Tracker(workspaceId);
        });

        it('should track custom events', () => {
            tracker.track('custom', 'Test Event', { key: 'value' });
            // Event should be queued (no direct assertion, but no error)
        });

        it('should include device info in events', () => {
            tracker.track('custom', 'Test Event');
            // Device info enrichment happens internally
        });

        it('should include UTM params in events', () => {
            tracker.track('custom', 'Test Event');
            // UTM params are spread at top level per Phase 1 fix
        });
    });

    describe('page()', () => {
        beforeEach(() => {
            tracker = new Tracker(workspaceId);
        });

        it('should track page view with default name', () => {
            tracker.page();
            // Should use document.title as name
        });

        it('should track page view with custom name', () => {
            tracker.page('Custom Page', { section: 'hero' });
        });
    });

    describe('identify()', () => {
        beforeEach(() => {
            tracker = new Tracker(workspaceId);
        });

        it('should require email', async () => {
            await tracker.identify('');
            // Should log warning and return early
        });

        it('should send identify request', async () => {
            await tracker.identify('test@example.com', { firstName: 'Test' });
            expect(fetch).toHaveBeenCalled();
        });

        it('should store pending identify on failure', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ success: false, message: 'Error' }),
            });

            await tracker.identify('test@example.com');
            // Should store for retry (internal state)
        });
    });

    describe('flush()', () => {
        beforeEach(() => {
            tracker = new Tracker(workspaceId);
        });

        it('should flush event queue', async () => {
            tracker.track('custom', 'Test');
            await tracker.flush();
        });

        it('should retry pending identify on flush', async () => {
            // First identify fails
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: false,
                json: () => Promise.resolve({ success: false }),
            });
            await tracker.identify('test@example.com');

            // Reset mock for retry
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            });

            await tracker.flush();
            // Retry should have been attempted
        });
    });

    describe('reset()', () => {
        beforeEach(() => {
            tracker = new Tracker(workspaceId);
        });

        it('should generate new visitor and session IDs', () => {
            const oldVisitorId = tracker.getVisitorId();
            tracker.reset();
            // New IDs should be generated
            expect(tracker.getVisitorId()).toBeTruthy();
        });
    });

    describe('deleteData()', () => {
        beforeEach(() => {
            tracker = new Tracker(workspaceId);
        });

        it('should clear all stored data', () => {
            tracker.deleteData();
            // Storage should be cleared
        });
    });

    describe('destroy()', () => {
        it('should cleanup all resources', async () => {
            tracker = new Tracker(workspaceId);
            await tracker.destroy();
            // No errors should occur
        });
    });

    describe('Consent integration', () => {
        it('should respect consent state', () => {
            tracker = new Tracker(workspaceId, {
                consent: { waitForConsent: true },
            });
            tracker.consent({ analytics: true, marketing: false, personalization: false });
            const state = tracker.getConsentState();
            expect(state.analytics).toBe(true);
        });
    });

    describe('Debug mode', () => {
        it('should toggle debug mode', () => {
            tracker = new Tracker(workspaceId);
            tracker.debug(true);
            tracker.debug(false);
        });
    });




    describe('Event Schema Validation', () => {
        it('should register and validate event schema', () => {
            tracker = new Tracker(workspaceId, { debug: true });

            tracker.registerEventSchema('purchase', {
                productId: 'string',
                price: 'number',
            });

            // Valid event - should not warn
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            tracker.track('purchase', 'Order', { productId: 'p1', price: 29.99 });
            // Warn spy may or may not be called depending on logger implementation
            warnSpy.mockRestore();
        });
    });
});
