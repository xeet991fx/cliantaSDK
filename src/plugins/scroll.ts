/**
 * Eutexa SDK - Scroll Depth Plugin
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
    private initialCheckTimeout: ReturnType<typeof setTimeout> | null = null;
    private boundHandler: (() => void) | null = null;
    /** SPA navigation — listen for PageViewPlugin's custom event instead of patching history */
    private navigationHandler: (() => void) | null = null;
    private popstateHandler: (() => void) | null = null;

    init(tracker: TrackerCore): void {
        super.init(tracker);
        this.pageLoadTime = Date.now();

        if (typeof window !== 'undefined') {
            this.boundHandler = this.handleScroll.bind(this);
            window.addEventListener('scroll', this.boundHandler, { passive: true });

            // Listen for navigation events dispatched by PageViewPlugin
            // instead of independently monkey-patching history.pushState
            this.navigationHandler = () => this.resetForNavigation();
            window.addEventListener('eutexa:navigation', this.navigationHandler);

            // Handle back/forward navigation
            this.popstateHandler = () => this.resetForNavigation();
            window.addEventListener('popstate', this.popstateHandler);

            // Browsers don't fire scroll events on pages where the document fits
            // in the viewport — but the visitor still saw 100% of the content.
            // Run trackScrollDepth() once shortly after mount so short pages
            // produce 25/50/75/100% milestones too.
            this.initialCheckTimeout = setTimeout(() => this.trackScrollDepth(), 500);
        }
    }

    destroy(): void {
        if (this.boundHandler && typeof window !== 'undefined') {
            window.removeEventListener('scroll', this.boundHandler);
        }
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        if (this.initialCheckTimeout) {
            clearTimeout(this.initialCheckTimeout);
            this.initialCheckTimeout = null;
        }
        if (this.navigationHandler && typeof window !== 'undefined') {
            window.removeEventListener('eutexa:navigation', this.navigationHandler);
            this.navigationHandler = null;
        }
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
        // Re-run the short-page check for the new route
        if (this.initialCheckTimeout) clearTimeout(this.initialCheckTimeout);
        this.initialCheckTimeout = setTimeout(() => this.trackScrollDepth(), 500);
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

        // Short pages where the entire content fits in the viewport never produce
        // a scroll event in the browser — but the visitor still saw 100% of the
        // content. Emit all milestones as "reached" once so the analytics dashboard
        // doesn't make every short page look like a 0%-scroll bounce.
        if (scrollableHeight <= 0) {
            if (this.maxScrollDepth < 100) {
                this.maxScrollDepth = 100;
                for (const milestone of SCROLL_MILESTONES) {
                    if (!this.milestonesReached.has(milestone)) {
                        this.milestonesReached.add(milestone);
                        this.track('scroll_depth', `Scrolled ${milestone}%`, {
                            depth: milestone,
                            maxDepth: 100,
                            timeToReach: Date.now() - this.pageLoadTime,
                            shortPage: true,
                        });
                    }
                }
            }
            return;
        }

        // Use Math.round so fractional pixels / browser zoom don't cause us to
        // miss the 100% milestone (Math.floor would clip 99.6 → 99).
        const scrollPercent = Math.round((scrollTop / scrollableHeight) * 100);

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
