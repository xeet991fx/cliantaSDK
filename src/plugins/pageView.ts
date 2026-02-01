/**
 * Clianta SDK - Page View Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

/**
 * Page View Plugin - Tracks page views
 */
export class PageViewPlugin extends BasePlugin {
    name: PluginName = 'pageView';
    private originalPushState: typeof history.pushState | null = null;
    private originalReplaceState: typeof history.replaceState | null = null;
    private popstateHandler: (() => void) | null = null;

    init(tracker: TrackerCore): void {
        super.init(tracker);

        // Track initial page view
        this.trackPageView();

        // Track SPA navigation (History API)
        if (typeof window !== 'undefined') {
            // Store originals for cleanup
            this.originalPushState = history.pushState;
            this.originalReplaceState = history.replaceState;

            // Intercept pushState and replaceState
            const self = this;
            history.pushState = function(...args) {
                self.originalPushState!.apply(history, args);
                self.trackPageView();
            };

            history.replaceState = function(...args) {
                self.originalReplaceState!.apply(history, args);
                self.trackPageView();
            };

            // Handle back/forward navigation
            this.popstateHandler = () => this.trackPageView();
            window.addEventListener('popstate', this.popstateHandler);
        }
    }

    destroy(): void {
        // Restore original history methods
        if (this.originalPushState) {
            history.pushState = this.originalPushState;
            this.originalPushState = null;
        }
        if (this.originalReplaceState) {
            history.replaceState = this.originalReplaceState;
            this.originalReplaceState = null;
        }
        // Remove popstate listener
        if (this.popstateHandler && typeof window !== 'undefined') {
            window.removeEventListener('popstate', this.popstateHandler);
            this.popstateHandler = null;
        }
        super.destroy();
    }

    private trackPageView(): void {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        this.track('page_view', 'Page Viewed', {
            title: document.title,
            path: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
            referrer: document.referrer || 'direct',
            viewport: `${window.innerWidth}x${window.innerHeight}`,
        });
    }
}
