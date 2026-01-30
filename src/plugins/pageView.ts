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

    init(tracker: TrackerCore): void {
        super.init(tracker);

        // Track initial page view
        this.trackPageView();

        // Track SPA navigation (History API)
        if (typeof window !== 'undefined') {
            // Intercept pushState and replaceState
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;

            history.pushState = (...args) => {
                originalPushState.apply(history, args);
                this.trackPageView();
            };

            history.replaceState = (...args) => {
                originalReplaceState.apply(history, args);
                this.trackPageView();
            };

            // Handle back/forward navigation
            window.addEventListener('popstate', () => {
                this.trackPageView();
            });
        }
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
