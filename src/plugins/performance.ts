/**
 * MorrisB Tracking SDK - Performance Plugin
 * @version 3.0.0
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

/**
 * Performance Plugin - Tracks page performance and Web Vitals
 */
export class PerformancePlugin extends BasePlugin {
    name: PluginName = 'performance';

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof window !== 'undefined') {
            // Track performance after page load
            window.addEventListener('load', () => {
                // Delay to ensure all metrics are available
                setTimeout(() => this.trackPerformance(), 100);
            });
        }
    }

    private trackPerformance(): void {
        if (typeof performance === 'undefined') return;

        // Use Navigation Timing API
        const timing = performance.timing;
        if (!timing) return;

        const loadTime = timing.loadEventEnd - timing.navigationStart;
        const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
        const ttfb = timing.responseStart - timing.navigationStart;
        const domInteractive = timing.domInteractive - timing.navigationStart;

        this.track('performance', 'Page Performance', {
            loadTime,
            domReady,
            ttfb, // Time to First Byte
            domInteractive,
        });

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

                // Report CLS after page is hidden
                window.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'hidden' && clsValue > 0) {
                        this.track('performance', 'Web Vital - CLS', {
                            metric: 'CLS',
                            value: Math.round(clsValue * 1000) / 1000,
                        });
                    }
                }, { once: true });
            } catch {
                // CLS not supported
            }
        }
    }
}
