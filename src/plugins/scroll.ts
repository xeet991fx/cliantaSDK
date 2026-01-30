/**
 * MorrisB Tracking SDK - Scroll Depth Plugin
 * @version 3.0.0
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

    init(tracker: TrackerCore): void {
        super.init(tracker);
        this.pageLoadTime = Date.now();

        if (typeof window !== 'undefined') {
            this.boundHandler = this.handleScroll.bind(this);
            window.addEventListener('scroll', this.boundHandler, { passive: true });
        }
    }

    destroy(): void {
        if (this.boundHandler && typeof window !== 'undefined') {
            window.removeEventListener('scroll', this.boundHandler);
        }
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        super.destroy();
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
        const scrollPercent = Math.floor((scrollTop / (documentHeight - windowHeight)) * 100);

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
