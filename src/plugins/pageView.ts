/**
 * Eutexa SDK - Page View Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

/** Sentinel flag to prevent double-wrapping history methods across multiple SDK instances */
const WRAPPED_FLAG = '__eutexa_pv_wrapped__';

/**
 * Page View Plugin - Tracks page views
 */
export class PageViewPlugin extends BasePlugin {
    name: PluginName = 'pageView';
    private originalPushState: typeof history.pushState | null = null;
    private originalReplaceState: typeof history.replaceState | null = null;
    private navHandler: (() => void) | null = null;
    private popstateHandler: (() => void) | null = null;

    init(tracker: TrackerCore): void {
        super.init(tracker);

        // Track initial page view
        this.trackPageView();

        if (typeof window === 'undefined') return;

        // Only wrap history methods once — guard against multiple SDK instances (e.g. microfrontends)
        // wrapping them repeatedly, which would cause duplicate navigation events and broken cleanup.
        if (!(history.pushState as any)[WRAPPED_FLAG]) {
            this.originalPushState = history.pushState;
            this.originalReplaceState = history.replaceState;

            const originalPush = this.originalPushState;
            const originalReplace = this.originalReplaceState;

            history.pushState = function (...args) {
                originalPush.apply(history, args);
                // Dispatch event so all listening instances track the navigation
                window.dispatchEvent(new Event('eutexa:navigation'));
            };
            (history.pushState as any)[WRAPPED_FLAG] = true;

            history.replaceState = function (...args) {
                originalReplace.apply(history, args);
                window.dispatchEvent(new Event('eutexa:navigation'));
            };
            (history.replaceState as any)[WRAPPED_FLAG] = true;
        }

        // Each instance listens to the shared navigation event rather than embedding
        // tracking directly in the pushState wrapper — decouples tracking from wrapping.
        this.navHandler = () => this.trackPageView();
        window.addEventListener('eutexa:navigation', this.navHandler);

        // Handle back/forward navigation
        this.popstateHandler = () => this.trackPageView();
        window.addEventListener('popstate', this.popstateHandler);
    }

    destroy(): void {
        if (typeof window !== 'undefined') {
            if (this.navHandler) {
                window.removeEventListener('eutexa:navigation', this.navHandler);
                this.navHandler = null;
            }
            if (this.popstateHandler) {
                window.removeEventListener('popstate', this.popstateHandler);
                this.popstateHandler = null;
            }
        }

        // Restore original history methods only if this instance was the one that wrapped them
        if (this.originalPushState) {
            history.pushState = this.originalPushState;
            delete (history.pushState as any)[WRAPPED_FLAG];
            this.originalPushState = null;
        }
        if (this.originalReplaceState) {
            history.replaceState = this.originalReplaceState;
            delete (history.replaceState as any)[WRAPPED_FLAG];
            this.originalReplaceState = null;
        }

        super.destroy();
    }

    private trackPageView(): void {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        // Use the page title (or pathname as fallback) as the event NAME so each
        // page shows up distinctly in analytics dashboards. The previous
        // hardcoded "Page Viewed" name caused every page to look identical.
        const eventName = document.title?.trim() || window.location.pathname || 'Page Viewed';

        this.track('page_view', eventName, {
            title: document.title,
            path: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
            // referrer is included on the top-level event by Tracker.track() — we
            // intentionally don't add a `properties.referrer` here so dashboards
            // have one canonical referrer field with one canonical default.
            viewport: `${window.innerWidth}x${window.innerHeight}`,
        });
    }
}
