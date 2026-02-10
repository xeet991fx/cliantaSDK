/**
 * Performance Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformancePlugin } from '../../src/plugins/performance';
import type { TrackerCore } from '../../src/types';

describe('PerformancePlugin', () => {
    let plugin: PerformancePlugin;
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

        // Spy on window event listeners
        vi.spyOn(window, 'addEventListener');
        vi.spyOn(window, 'removeEventListener');

        vi.useFakeTimers();
        plugin = new PerformancePlugin();
    });

    afterEach(() => {
        if (plugin) {
            plugin.destroy();
        }
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('init()', () => {
        it('should register load listener', () => {
            plugin.init(mockTracker);
            expect(window.addEventListener).toHaveBeenCalledWith(
                'load',
                expect.any(Function)
            );
        });
    });

    describe('performance tracking', () => {
        beforeEach(() => {
            // Mock performance API
            const mockNavTiming = {
                startTime: 0,
                loadEventEnd: 1500,
                domContentLoadedEventEnd: 800,
                responseStart: 200,
                requestStart: 100,
                domInteractive: 600,
                domainLookupEnd: 50,
                domainLookupStart: 10,
                connectEnd: 80,
                connectStart: 60,
                transferSize: 50000,
            };

            vi.spyOn(performance, 'getEntriesByType').mockReturnValue([mockNavTiming as unknown as PerformanceEntry]);
        });

        it('should track page performance after load', () => {
            plugin.init(mockTracker);

            // Get load handler
            const loadHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'load')?.[1];

            if (loadHandler) {
                loadHandler();

                // Wait for setTimeout delay
                vi.advanceTimersByTime(150);

                expect(mockTracker.track).toHaveBeenCalledWith(
                    'performance',
                    'Page Performance',
                    expect.objectContaining({
                        loadTime: expect.any(Number),
                        domReady: expect.any(Number),
                        ttfb: expect.any(Number),
                        domInteractive: expect.any(Number),
                    })
                );
            }
        });

        it('should include additional timing metrics', () => {
            plugin.init(mockTracker);

            const loadHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'load')?.[1];

            if (loadHandler) {
                loadHandler();
                vi.advanceTimersByTime(150);

                expect(mockTracker.track).toHaveBeenCalledWith(
                    'performance',
                    'Page Performance',
                    expect.objectContaining({
                        dns: expect.any(Number),
                        connection: expect.any(Number),
                        transferSize: 50000,
                    })
                );
            }
        });
    });

    describe('Web Vitals tracking', () => {
        beforeEach(() => {
            // Mock PerformanceObserver
            const mockObserver = {
                observe: vi.fn(),
                disconnect: vi.fn(),
            };

            vi.stubGlobal('PerformanceObserver', vi.fn(() => mockObserver));

            // Mock navigation timing
            vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{
                startTime: 0,
                loadEventEnd: 1000,
                domContentLoadedEventEnd: 500,
                responseStart: 100,
                requestStart: 50,
                domInteractive: 400,
                domainLookupEnd: 30,
                domainLookupStart: 10,
                connectEnd: 40,
                connectStart: 35,
                transferSize: 10000,
            } as unknown as PerformanceEntry]);
        });

        it('should create LCP observer', () => {
            plugin.init(mockTracker);

            const loadHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'load')?.[1];

            if (loadHandler) {
                loadHandler();
                vi.advanceTimersByTime(150);

                expect(PerformanceObserver).toHaveBeenCalled();
            }
        });

        it('should observe largest-contentful-paint', () => {
            plugin.init(mockTracker);

            const loadHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'load')?.[1];

            if (loadHandler) {
                loadHandler();
                vi.advanceTimersByTime(150);

                const observerInstance = (PerformanceObserver as ReturnType<typeof vi.fn>).mock.results[0]?.value;
                if (observerInstance) {
                    expect(observerInstance.observe).toHaveBeenCalledWith(
                        expect.objectContaining({
                            type: 'largest-contentful-paint',
                            buffered: true,
                        })
                    );
                }
            }
        });
    });

    describe('destroy()', () => {
        it('should remove load listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();

            expect(window.removeEventListener).toHaveBeenCalledWith(
                'load',
                expect.any(Function)
            );
        });

        it('should disconnect all observers', () => {
            const mockObserver = {
                observe: vi.fn(),
                disconnect: vi.fn(),
            };
            vi.stubGlobal('PerformanceObserver', vi.fn(() => mockObserver));

            vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{
                startTime: 0,
                loadEventEnd: 1000,
                domContentLoadedEventEnd: 500,
                responseStart: 100,
                requestStart: 50,
                domInteractive: 400,
                domainLookupEnd: 30,
                domainLookupStart: 10,
                connectEnd: 40,
                connectStart: 35,
                transferSize: 10000,
            } as unknown as PerformanceEntry]);

            plugin.init(mockTracker);

            // Trigger load to create observers
            const loadHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'load')?.[1];

            if (loadHandler) {
                loadHandler();
                vi.advanceTimersByTime(150);
            }

            plugin.destroy();

            // Check that disconnect was called on observers
            expect(mockObserver.disconnect).toHaveBeenCalled();
        });
    });
});
