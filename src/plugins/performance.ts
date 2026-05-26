/**
 * Clianta SDK - Performance Plugin
 *
 * Tracks page performance and Web Vitals (LCP, FID, CLS, TTFB).
 *
 * SPA-aware:
 *   - Initial measurement comes from the Navigation Timing API on `window.load`.
 *   - On every `clianta:navigation` (dispatched by PageViewPlugin's history wrapper)
 *     the plugin re-arms its observers and emits a synthetic `Page Performance`
 *     event for the new route — so SPA routes are no longer invisible to perf
 *     dashboards.
 *
 * Each Web Vital is reported AT MOST ONCE per page lifecycle:
 *   - LCP: final value at navigation-away / visibility:hidden / pagehide.
 *   - FID: first-input-delay only fires once natively.
 *   - CLS: cumulative value at navigation-away / visibility:hidden / pagehide.
 *
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

    // Per-page state
    private pageStartTime = 0;
    private lcpValue = 0;
    private lcpReported = false;
    private clsValue = 0;
    private clsReported = false;
    private fidReported = false;

    private boundReportFinalVitals: (() => void) | null = null;
    private boundVisibilityHandler: (() => void) | null = null;
    private boundPageHide: (() => void) | null = null;
    private navigationHandler: (() => void) | null = null;
    private popstateHandler: (() => void) | null = null;

    /** Guards trackInitialPerformance against double-fire when both addEventListener('load') and the readyState shortcut run. */
    private initialPerfReported = false;

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof window === 'undefined') return;

        this.pageStartTime = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();

        // Initial perf event after the document fully loads (Navigation Timing API)
        this.boundLoadHandler = () => {
            // Slight delay so loadEventEnd is populated
            setTimeout(() => this.trackInitialPerformance(), 100);
        };
        // Always register so SDKs that mount before 'load' get the listener,
        // AND fire immediately if readyState is already 'complete' (SDKs that
        // mount after hydration in SPAs).
        window.addEventListener('load', this.boundLoadHandler);
        if (typeof document !== 'undefined' && document.readyState === 'complete') {
            this.boundLoadHandler();
        }

        // Web Vitals observers (live for the whole tab lifetime; per-page state
        // is reset on navigation so each route gets its own LCP/CLS)
        this.armWebVitalObservers();

        // Final-vital flushers — fire ONCE per page when the user leaves or hides
        this.boundReportFinalVitals = () => this.reportFinalVitals();
        this.boundVisibilityHandler = () => {
            if (document.visibilityState === 'hidden') this.reportFinalVitals();
        };
        this.boundPageHide = () => this.reportFinalVitals();
        document.addEventListener('visibilitychange', this.boundVisibilityHandler);
        window.addEventListener('pagehide', this.boundPageHide);

        // SPA navigation — flush vitals for the leaving route, then reset
        this.navigationHandler = () => this.handleSpaNavigation();
        window.addEventListener('clianta:navigation', this.navigationHandler);

        this.popstateHandler = () => this.handleSpaNavigation();
        window.addEventListener('popstate', this.popstateHandler);
    }

    destroy(): void {
        if (typeof window !== 'undefined') {
            if (this.boundLoadHandler) window.removeEventListener('load', this.boundLoadHandler);
            if (this.boundPageHide) window.removeEventListener('pagehide', this.boundPageHide);
            if (this.navigationHandler) window.removeEventListener('clianta:navigation', this.navigationHandler);
            if (this.popstateHandler) window.removeEventListener('popstate', this.popstateHandler);
        }
        if (typeof document !== 'undefined' && this.boundVisibilityHandler) {
            document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
        }
        for (const observer of this.observers) {
            try { observer.disconnect(); } catch { /* already disconnected */ }
        }
        this.observers = [];
        super.destroy();
    }

    // ════════════════════════════════════════════════
    // SPA navigation handling
    // ════════════════════════════════════════════════

    private handleSpaNavigation(): void {
        // Flush vitals for the route the user is leaving
        this.reportFinalVitals();

        // Reset per-page state so the new route gets its own LCP/CLS
        this.pageStartTime = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
        this.lcpValue = 0;
        this.lcpReported = false;
        this.clsValue = 0;
        this.clsReported = false;
        this.fidReported = false;

        // Re-arm observers (the previous ones were disconnected in reportFinalVitals)
        this.armWebVitalObservers();

        // Emit a synthetic perf event for the new route so SPA pages aren't invisible.
        // We don't have Navigation Timing for SPA route changes, so we report a
        // best-effort "soft navigation" snapshot using performance.now().
        const ts = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
        this.track('performance', 'SPA Navigation', {
            isSpaNavigation: true,
            tsSinceLoad: Math.round(ts),
        });
    }

    // ════════════════════════════════════════════════
    // Initial Navigation Timing
    // ════════════════════════════════════════════════

    private trackInitialPerformance(): void {
        if (this.initialPerfReported) return;
        this.initialPerfReported = true;

        if (typeof performance === 'undefined') return;

        const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];

        if (entries.length > 0) {
            const navTiming = entries[0];

            this.track('performance', 'Page Performance', {
                loadTime: Math.round(navTiming.loadEventEnd - navTiming.startTime),
                domReady: Math.round(navTiming.domContentLoadedEventEnd - navTiming.startTime),
                ttfb: Math.round(navTiming.responseStart - navTiming.requestStart),
                domInteractive: Math.round(navTiming.domInteractive - navTiming.startTime),
                dns: Math.round(navTiming.domainLookupEnd - navTiming.domainLookupStart),
                connection: Math.round(navTiming.connectEnd - navTiming.connectStart),
                transferSize: navTiming.transferSize,
            });
            return;
        }

        // Legacy fallback for older browsers
        const timing = (performance as any).timing;
        if (!timing) return;

        this.track('performance', 'Page Performance', {
            loadTime: timing.loadEventEnd - timing.navigationStart,
            domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
            ttfb: timing.responseStart - timing.navigationStart,
            domInteractive: timing.domInteractive - timing.navigationStart,
        });
    }

    // ════════════════════════════════════════════════
    // Web Vitals
    // ════════════════════════════════════════════════

    private armWebVitalObservers(): void {
        // Disconnect any previous-route observers that survived
        for (const observer of this.observers) {
            try { observer.disconnect(); } catch { /* already disconnected */ }
        }
        this.observers = [];

        if (!('PerformanceObserver' in window)) return;

        // ─── LCP ─────────────────────────────────────
        try {
            const lcpObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
                if (lastEntry) {
                    // Track the highest LCP we've seen but DON'T emit yet — we report
                    // the final value when the page is hidden or unloaded (best practice).
                    this.lcpValue = Math.round(lastEntry.startTime);
                }
            });
            lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
            this.observers.push(lcpObserver);
        } catch { /* LCP not supported */ }

        // ─── FID ─────────────────────────────────────
        try {
            const fidObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                const firstEntry = entries[0] as PerformanceEntry & { processingStart: number; startTime: number };
                if (firstEntry && !this.fidReported) {
                    this.fidReported = true;
                    this.track('performance', 'Web Vital - FID', {
                        metric: 'FID',
                        value: Math.round(firstEntry.processingStart - firstEntry.startTime),
                    });
                }
            });
            fidObserver.observe({ type: 'first-input', buffered: true });
            this.observers.push(fidObserver);
        } catch { /* FID not supported */ }

        // ─── CLS ─────────────────────────────────────
        try {
            const clsObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                entries.forEach((entry: PerformanceEntry & { hadRecentInput?: boolean; value?: number }) => {
                    if (!entry.hadRecentInput) {
                        this.clsValue += entry.value || 0;
                    }
                });
            });
            clsObserver.observe({ type: 'layout-shift', buffered: true });
            this.observers.push(clsObserver);
        } catch { /* CLS not supported */ }
    }

    /**
     * Report final LCP / CLS values for the current page.
     * Idempotent — safe to call multiple times during the unload sequence.
     */
    private reportFinalVitals(): void {
        if (!this.lcpReported && this.lcpValue > 0) {
            this.lcpReported = true;
            this.track('performance', 'Web Vital - LCP', {
                metric: 'LCP',
                value: this.lcpValue,
            });
        }

        if (!this.clsReported && this.clsValue > 0) {
            this.clsReported = true;
            this.track('performance', 'Web Vital - CLS', {
                metric: 'CLS',
                value: Math.round(this.clsValue * 1000) / 1000,
            });
        }
    }
}
