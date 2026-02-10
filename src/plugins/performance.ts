/**
 * Clianta SDK - Performance Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

/**
 * Performance Plugin - Tracks page performance and Web Vitals
 */
export class PerformancePlugin extends BasePlugin {
    name: PluginName = 'performance';
    private boundLoadHandler: (() => void) | null = null;
    private observers: PerformanceObserver[] = [];
    private boundClsVisibilityHandler: (() => void) | null = null;

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof window !== 'undefined') {
            // Track performance after page load
            this.boundLoadHandler = () => {
                // Delay to ensure all metrics are available
                setTimeout(() => this.trackPerformance(), 100);
            };
            window.addEventListener('load', this.boundLoadHandler);
        }
    }

    destroy(): void {
        if (this.boundLoadHandler && typeof window !== 'undefined') {
            window.removeEventListener('load', this.boundLoadHandler);
        }
        for (const observer of this.observers) {
            observer.disconnect();
        }
        this.observers = [];
        if (this.boundClsVisibilityHandler && typeof window !== 'undefined') {
            window.removeEventListener('visibilitychange', this.boundClsVisibilityHandler);
        }
        super.destroy();
    }

    private trackPerformance(): void {
        if (typeof performance === 'undefined') return;

        // Use modern Navigation Timing API (PerformanceNavigationTiming)
        const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];

        if (entries.length > 0) {
            const navTiming = entries[0];

            const loadTime = Math.round(navTiming.loadEventEnd - navTiming.startTime);
            const domReady = Math.round(navTiming.domContentLoadedEventEnd - navTiming.startTime);
            const ttfb = Math.round(navTiming.responseStart - navTiming.requestStart);
            const domInteractive = Math.round(navTiming.domInteractive - navTiming.startTime);

            this.track('performance', 'Page Performance', {
                loadTime,
                domReady,
                ttfb, // Time to First Byte
                domInteractive,
                // Additional modern metrics
                dns: Math.round(navTiming.domainLookupEnd - navTiming.domainLookupStart),
                connection: Math.round(navTiming.connectEnd - navTiming.connectStart),
                transferSize: navTiming.transferSize,
            });
        } else {
            // Fallback for older browsers using deprecated API
            const timing = performance.timing;
            if (!timing) return;

            const loadTime = timing.loadEventEnd - timing.navigationStart;
            const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
            const ttfb = timing.responseStart - timing.navigationStart;
            const domInteractive = timing.domInteractive - timing.navigationStart;

            this.track('performance', 'Page Performance', {
                loadTime,
                domReady,
                ttfb,
                domInteractive,
            });
        }

        // Track Web Vitals if available
        this.trackWebVitals();
    }

    private trackWebVitals(): void {
        // LCP (Largest Contentful Paint)
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
                    if (lastEntry) {
                        this.track('performance', 'Web Vital - LCP', {
                            metric: 'LCP',
                            value: Math.round(lastEntry.startTime),
                        });
                    }
                });
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
                this.observers.push(lcpObserver);
            } catch {
                // LCP not supported
            }

            // FID (First Input Delay)
            try {
                const fidObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const firstEntry = entries[0] as PerformanceEntry & { processingStart: number; startTime: number };
                    if (firstEntry) {
                        this.track('performance', 'Web Vital - FID', {
                            metric: 'FID',
                            value: Math.round(firstEntry.processingStart - firstEntry.startTime),
                        });
                    }
                });
                fidObserver.observe({ type: 'first-input', buffered: true });
                this.observers.push(fidObserver);
            } catch {
                // FID not supported
            }

            // CLS (Cumulative Layout Shift)
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    entries.forEach((entry: PerformanceEntry & { hadRecentInput?: boolean; value?: number }) => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value || 0;
                        }
                    });
                });
                clsObserver.observe({ type: 'layout-shift', buffered: true });
                this.observers.push(clsObserver);

                // Report CLS after page is hidden
                this.boundClsVisibilityHandler = () => {
                    if (document.visibilityState === 'hidden' && clsValue > 0) {
                        this.track('performance', 'Web Vital - CLS', {
                            metric: 'CLS',
                            value: Math.round(clsValue * 1000) / 1000,
                        });
                    }
                };
                window.addEventListener('visibilitychange', this.boundClsVisibilityHandler, { once: true });
            } catch {
                // CLS not supported
            }
        }
    }
}
