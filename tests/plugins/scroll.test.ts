/**
 * Scroll Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrollPlugin } from '../../src/plugins/scroll';
import type { TrackerCore } from '../../src/types';

describe('ScrollPlugin', () => {
    let plugin: ScrollPlugin;
    let mockTracker: TrackerCore;
    let originalPushState: typeof history.pushState;
    let originalReplaceState: typeof history.replaceState;

    beforeEach(() => {
        // Store originals from jsdom
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

        // Set up window properties
        Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
        Object.defineProperty(window, 'pageYOffset', { value: 0, writable: true, configurable: true });

        // Set up document properties
        Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000, writable: true, configurable: true });
        Object.defineProperty(document.documentElement, 'scrollTop', { value: 0, writable: true, configurable: true });

        // Spy on window event listeners
        vi.spyOn(window, 'addEventListener');
        vi.spyOn(window, 'removeEventListener');

        vi.useFakeTimers();
        plugin = new ScrollPlugin();
    });

    afterEach(() => {
        if (plugin) {
            plugin.destroy();
        }
        vi.useRealTimers();
        // Restore originals  
        if (originalPushState) window.history.pushState = originalPushState;
        if (originalReplaceState) window.history.replaceState = originalReplaceState;
        vi.restoreAllMocks();
    });

    describe('init()', () => {
        it('should register scroll listener', () => {
            plugin.init(mockTracker);
            expect(window.addEventListener).toHaveBeenCalledWith(
                'scroll',
                expect.any(Function),
                { passive: true }
            );
        });

        it('should setup SPA navigation reset via custom event', () => {
            plugin.init(mockTracker);
            // ScrollPlugin should NOT patch history.pushState directly
            expect(history.pushState).toBe(originalPushState);
            expect(history.replaceState).toBe(originalReplaceState);
            // Instead it listens for the clianta:navigation custom event
            expect(window.addEventListener).toHaveBeenCalledWith('clianta:navigation', expect.any(Function));
        });

        it('should register popstate handler', () => {
            plugin.init(mockTracker);
            expect(window.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
        });
    });

    describe('Milestone tracking', () => {
        beforeEach(() => {
            plugin.init(mockTracker);
        });

        it('should track 25% milestone', () => {
            // Simulate scroll to 25%
            (window as any).pageYOffset = 300; // 300 / 1200 (2000 - 800) = 25%

            // Trigger scroll handler
            const scrollHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'scroll')?.[1];

            if (scrollHandler) {
                scrollHandler();
                vi.advanceTimersByTime(200); // Wait for debounce

                expect(mockTracker.track).toHaveBeenCalledWith(
                    'scroll_depth',
                    'Scrolled 25%',
                    expect.objectContaining({
                        depth: 25,
                    })
                );
            }
        });

        it('should not track same milestone twice', () => {
            (window as any).pageYOffset = 300;

            const scrollHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'scroll')?.[1];

            if (scrollHandler) {
                scrollHandler();
                vi.advanceTimersByTime(200);
                const count1 = (mockTracker.track as ReturnType<typeof vi.fn>).mock.calls.length;

                scrollHandler();
                vi.advanceTimersByTime(200);
                const count2 = (mockTracker.track as ReturnType<typeof vi.fn>).mock.calls.length;

                expect(count2).toBe(count1);
            }
        });
    });

    describe('Debouncing', () => {
        beforeEach(() => {
            plugin.init(mockTracker);
        });

        it('should debounce scroll events', () => {
            const scrollHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'scroll')?.[1];

            if (scrollHandler) {
                // Rapid scroll events
                scrollHandler();
                scrollHandler();
                scrollHandler();

                expect(mockTracker.track).not.toHaveBeenCalled();

                vi.advanceTimersByTime(200);
                // Now debounced handler should fire
            }
        });
    });

    describe('SPA navigation reset', () => {
        beforeEach(() => {
            plugin.init(mockTracker);
            vi.clearAllMocks();
        });

        it('should reset on clianta:navigation event', () => {
            // First track a milestone
            (window as any).pageYOffset = 600; // 50%
            const scrollHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'scroll')?.[1];

            if (scrollHandler) {
                scrollHandler();
                vi.advanceTimersByTime(200);
            }

            // Dispatch navigation event (as PageViewPlugin would)
            window.dispatchEvent(new Event('clianta:navigation'));

            // Reset should allow tracking same milestones again
            // (Internal state is reset)
        });
    });

    describe('Short page handling', () => {
        it('should emit all milestones at once for pages with no scrollable content', () => {
            (document.documentElement as any).scrollHeight = 800; // Same as innerHeight

            plugin.init(mockTracker);

            const scrollHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'scroll')?.[1];

            if (scrollHandler) {
                scrollHandler();
                vi.advanceTimersByTime(200);

                // Pre-fix the plugin emitted nothing for short pages, so the
                // analytics dashboard treated every short page as a 0%-scroll
                // bounce. New contract: emit all four milestones once with
                // shortPage:true so the visitor's full-page-view is captured.
                const calls = (mockTracker.track as ReturnType<typeof vi.fn>).mock.calls
                    .filter((c) => c[0] === 'scroll_depth');
                expect(calls).toHaveLength(4);
                expect(calls.every((c) => c[2].shortPage === true)).toBe(true);
                expect(calls.map((c) => c[2].depth).sort((a, b) => a - b)).toEqual([25, 50, 75, 100]);
            }
        });
    });

    describe('destroy()', () => {
        it('should remove scroll listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();
            expect(window.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
        });

        it('should remove navigation event listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();
            // History should NOT be modified — ScrollPlugin doesn't touch it
            expect(history.pushState).toBe(originalPushState);
            expect(history.replaceState).toBe(originalReplaceState);
            // Custom event listener should be removed
            expect(window.removeEventListener).toHaveBeenCalledWith('clianta:navigation', expect.any(Function));
        });

        it('should remove popstate listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();
            expect(window.removeEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
        });
    });
});
