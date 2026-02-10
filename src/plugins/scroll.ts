/**
 * Clianta SDK - Scroll Depth Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';
import { SCROLL_MILESTONES } from '../core/config';

/**
 * Scroll Depth Plugin - Tracks scroll milestones
 */
export class ScrollPlugin extends BasePlugin {
    name: PluginName = 'scroll';
    private milestonesReached: Set<number> = new Set();
    private maxScrollDepth = 0;
    private pageLoadTime = 0;
    private scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    private boundHandler: (() => void) | null = null;
    /** SPA navigation support */
    private originalPushState: typeof history.pushState | null = null;
    private originalReplaceState: typeof history.replaceState | null = null;
    private popstateHandler: (() => void) | null = null;

    init(tracker: TrackerCore): void {
        super.init(tracker);
        this.pageLoadTime = Date.now();

        if (typeof window !== 'undefined') {
            this.boundHandler = this.handleScroll.bind(this);
            window.addEventListener('scroll', this.boundHandler, { passive: true });

            // Setup SPA navigation reset
            this.setupNavigationReset();
        }
    }

    destroy(): void {
        if (this.boundHandler && typeof window !== 'undefined') {
            window.removeEventListener('scroll', this.boundHandler);
        }
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
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

    /**
     * Reset scroll tracking for SPA navigation
     */
    private resetForNavigation(): void {
        this.milestonesReached.clear();
        this.maxScrollDepth = 0;
        this.pageLoadTime = Date.now();
    }

    /**
     * Setup History API interception for SPA navigation
     */
    private setupNavigationReset(): void {
        if (typeof window === 'undefined') return;

        // Store originals for cleanup
        this.originalPushState = history.pushState;
        this.originalReplaceState = history.replaceState;

        // Intercept pushState and replaceState
        const self = this;
        history.pushState = function (...args) {
            self.originalPushState!.apply(history, args);
            self.resetForNavigation();
        };

        history.replaceState = function (...args) {
            self.originalReplaceState!.apply(history, args);
            self.resetForNavigation();
        };

        // Handle back/forward navigation
        this.popstateHandler = () => this.resetForNavigation();
        window.addEventListener('popstate', this.popstateHandler);
    }

    private handleScroll(): void {
        // Debounce scroll tracking
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        this.scrollTimeout = setTimeout(() => this.trackScrollDepth(), 150);
    }

    private trackScrollDepth(): void {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollableHeight = documentHeight - windowHeight;

        // Guard against divide-by-zero on short pages
        if (scrollableHeight <= 0) return;

        const scrollPercent = Math.floor((scrollTop / scrollableHeight) * 100);

        // Clamp to valid range
        const clampedPercent = Math.max(0, Math.min(100, scrollPercent));

        // Update max scroll depth
        if (clampedPercent > this.maxScrollDepth) {
            this.maxScrollDepth = clampedPercent;
        }

        // Track milestones
        for (const milestone of SCROLL_MILESTONES) {
            if (clampedPercent >= milestone && !this.milestonesReached.has(milestone)) {
                this.milestonesReached.add(milestone);
                this.track('scroll_depth', `Scrolled ${milestone}%`, {
                    depth: milestone,
                    maxDepth: this.maxScrollDepth,
                    timeToReach: Date.now() - this.pageLoadTime,
                });
            }
        }
    }
}
