/**
 * PageView Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PageViewPlugin } from '../../src/plugins/pageView';
import type { TrackerCore } from '../../src/types';

describe('PageViewPlugin', () => {
    let plugin: PageViewPlugin;
    let mockTracker: TrackerCore;
    let originalPushState: any;
    let originalReplaceState: any;

    beforeEach(() => {
        // Store originals from jsdom before we start mocking
        originalPushState = window.history?.pushState;
        originalReplaceState = window.history?.replaceState;

        mockTracker = {
            track: vi.fn(),
            page: vi.fn(),
            identify: vi.fn(),
            consent: vi.fn(),
            getConsentState: vi.fn(),
            getVisitorId: vi.fn(() => 'visitor-123'),
            getSessionId: vi.fn(() => 'session-123'),
            getWorkspaceId: vi.fn(() => 'workspace-123'),
            getConfig: vi.fn(() => ({ apiEndpoint: 'https://api.test.com' })),
            flush: vi.fn(),
            reset: vi.fn(),
            deleteData: vi.fn(),
            debug: vi.fn(),
        } as unknown as TrackerCore;

        // Set up document properties
        Object.defineProperty(document, 'title', { value: 'Test Page', writable: true });
        Object.defineProperty(document, 'referrer', { value: 'https://referrer.com', writable: true });

        // Set up window location
        Object.defineProperty(window, 'location', {
            value: {
                pathname: '/test-page',
                search: '?query=1',
                hash: '#section',
                href: 'https://test.com/test-page?query=1#section',
            },
            writable: true,
        });

        // Spy on window event listeners
        vi.spyOn(window, 'addEventListener');
        vi.spyOn(window, 'removeEventListener');

        plugin = new PageViewPlugin();
    });

    afterEach(() => {
        if (plugin) {
            plugin.destroy();
        }
        // Restore originals
        if (originalPushState) window.history.pushState = originalPushState;
        if (originalReplaceState) window.history.replaceState = originalReplaceState;

        vi.restoreAllMocks();
    });

    describe('init()', () => {
        it('should track initial page view using document.title as the event name', () => {
            plugin.init(mockTracker);
            expect(mockTracker.track).toHaveBeenCalledWith(
                'page_view',
                'Test Page', // event name = document.title
                expect.objectContaining({
                    title: 'Test Page',
                    path: '/test-page',
                })
            );
        });

        it('should intercept pushState', () => {
            plugin.init(mockTracker);
            expect(history.pushState).not.toBe(originalPushState);
        });

        it('should intercept replaceState', () => {
            plugin.init(mockTracker);
            expect(history.replaceState).not.toBe(originalReplaceState);
        });

        it('should register popstate handler', () => {
            plugin.init(mockTracker);
            expect(window.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
        });
    });

    describe('SPA navigation', () => {
        beforeEach(() => {
            plugin.init(mockTracker);
            vi.clearAllMocks();
        });

        it('should track page view on pushState', () => {
            history.pushState({}, '', '/new-page');
            expect(mockTracker.track).toHaveBeenCalledWith(
                'page_view',
                expect.any(String),
                expect.any(Object)
            );
        });

        it('should track page view on replaceState', () => {
            history.replaceState({}, '', '/replaced-page');
            expect(mockTracker.track).toHaveBeenCalledWith(
                'page_view',
                expect.any(String),
                expect.any(Object)
            );
        });
    });

    describe('destroy()', () => {
        it('should restore original pushState', () => {
            plugin.init(mockTracker);
            plugin.destroy();
            expect(history.pushState).toBe(originalPushState);
        });

        it('should restore original replaceState', () => {
            plugin.init(mockTracker);
            plugin.destroy();
            expect(history.replaceState).toBe(originalReplaceState);
        });

        it('should remove popstate listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();
            expect(window.removeEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
        });
    });
});
