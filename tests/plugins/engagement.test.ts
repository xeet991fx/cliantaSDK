/**
 * Engagement Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EngagementPlugin } from '../../src/plugins/engagement';
import type { TrackerCore } from '../../src/types';

describe('EngagementPlugin', () => {
    let plugin: EngagementPlugin;
    let mockTracker: TrackerCore;

    beforeEach(() => {
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

        // Spy on event listeners
        vi.spyOn(document, 'addEventListener');
        vi.spyOn(document, 'removeEventListener');
        vi.spyOn(window, 'addEventListener');
        vi.spyOn(window, 'removeEventListener');

        vi.useFakeTimers();
        plugin = new EngagementPlugin();
    });

    afterEach(() => {
        if (plugin) {
            plugin.destroy();
        }
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('init()', () => {
        it('should register engagement event listeners', () => {
            plugin.init(mockTracker);

            // Check for mousemove, keydown, touchstart, scroll listeners
            expect(document.addEventListener).toHaveBeenCalledWith(
                'mousemove',
                expect.any(Function),
                { passive: true }
            );
            expect(document.addEventListener).toHaveBeenCalledWith(
                'keydown',
                expect.any(Function),
                { passive: true }
            );
            expect(document.addEventListener).toHaveBeenCalledWith(
                'touchstart',
                expect.any(Function),
                { passive: true }
            );
            expect(document.addEventListener).toHaveBeenCalledWith(
                'scroll',
                expect.any(Function),
                { passive: true }
            );
        });

        it('should register beforeunload listener', () => {
            plugin.init(mockTracker);
            expect(window.addEventListener).toHaveBeenCalledWith(
                'beforeunload',
                expect.any(Function)
            );
        });

        it('should register visibilitychange listener', () => {
            plugin.init(mockTracker);
            expect(document.addEventListener).toHaveBeenCalledWith(
                'visibilitychange',
                expect.any(Function)
            );
        });
    });

    describe('engagement tracking', () => {
        it('should track user engaged on first interaction', () => {
            plugin.init(mockTracker);

            // Simulate mouse move to trigger engagement
            const mousemoveHandler = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'mousemove')?.[1];

            if (mousemoveHandler) {
                mousemoveHandler();

                expect(mockTracker.track).toHaveBeenCalledWith(
                    'engagement',
                    'User Engaged',
                    expect.objectContaining({
                        timeToEngage: expect.any(Number),
                    })
                );
            }
        });

        it('should only track engagement once per session', () => {
            plugin.init(mockTracker);

            const mousemoveHandler = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'mousemove')?.[1];

            if (mousemoveHandler) {
                mousemoveHandler();
                mousemoveHandler();
                mousemoveHandler();

                // Should only track once for 'engagement' event
                const engagementCalls = (mockTracker.track as ReturnType<typeof vi.fn>).mock.calls
                    .filter((call) => call[0] === 'engagement');
                expect(engagementCalls).toHaveLength(1);
            }
        });

        it('should not re-fire engagement after long inactivity (once-per-page contract)', () => {
            plugin.init(mockTracker);

            const mousemoveHandler = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'mousemove')?.[1];

            if (mousemoveHandler) {
                // First engagement
                mousemoveHandler();
                expect(mockTracker.track).toHaveBeenCalledTimes(1);

                // Advance 30+ seconds
                vi.advanceTimersByTime(60_000);

                // Subsequent interactions should NOT produce more engagement events.
                // (Pre-fix: 30s of idle would re-arm the event and flood the queue.)
                mousemoveHandler();
                mousemoveHandler();
                const engagementCalls = (mockTracker.track as ReturnType<typeof vi.fn>).mock.calls
                    .filter((call) => call[0] === 'engagement');
                expect(engagementCalls).toHaveLength(1);
            }
        });
    });

    describe('time on page tracking', () => {
        it('should track cumulative time on page on beforeunload', () => {
            plugin.init(mockTracker);

            // Spend 5 seconds on the page
            vi.advanceTimersByTime(5000);

            // Find and invoke the unload handler
            const unloadHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'beforeunload')?.[1];

            if (unloadHandler) {
                unloadHandler();

                expect(mockTracker.track).toHaveBeenCalledWith(
                    'time_on_page',
                    'Time Spent',
                    expect.objectContaining({
                        seconds: expect.any(Number),
                        engaged: expect.any(Boolean),
                    })
                );
            }
        });

        it('should fire time_on_page only once per page lifecycle', () => {
            plugin.init(mockTracker);
            vi.advanceTimersByTime(2000);

            const unloadHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'beforeunload')?.[1];

            if (unloadHandler) {
                unloadHandler();
                unloadHandler();
                unloadHandler();

                const timeCalls = (mockTracker.track as ReturnType<typeof vi.fn>).mock.calls
                    .filter((call) => call[0] === 'time_on_page');
                expect(timeCalls).toHaveLength(1);
            }
        });

        it('should NOT flush time_on_page on visibility:hidden — only pause the timer', () => {
            plugin.init(mockTracker);
            vi.advanceTimersByTime(3000);

            const visibilityHandler = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'visibilitychange')?.[1];

            if (visibilityHandler) {
                Object.defineProperty(document, 'visibilityState', {
                    value: 'hidden',
                    writable: true,
                });
                visibilityHandler();

                const timeCalls = (mockTracker.track as ReturnType<typeof vi.fn>).mock.calls
                    .filter((call) => call[0] === 'time_on_page');
                // visibility:hidden should NOT emit time_on_page; that's reserved
                // for actual page unload. (Pre-fix: it would emit, then re-emit
                // on visibility:visible → hidden cycles.)
                expect(timeCalls).toHaveLength(0);
            }
        });
    });

    describe('destroy()', () => {
        it('should remove all event listeners', () => {
            plugin.init(mockTracker);
            plugin.destroy();

            // Check mousemove, keydown, touchstart, scroll were removed
            expect(document.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
            expect(document.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
            expect(document.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
        });

        it('should remove beforeunload listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();
            expect(window.removeEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
        });

        it('should remove visibilitychange listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();
            expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        });
    });
});
