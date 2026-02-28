/**
 * Clianta SDK - Engagement Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

/**
 * Engagement Plugin - Tracks user engagement and time on page
 */
export class EngagementPlugin extends BasePlugin {
    name: PluginName = 'engagement';
    private pageLoadTime = 0;
    private engagementStartTime = 0;
    private isEngaged = false;
    private engagementTimeout: ReturnType<typeof setTimeout> | null = null;
    private boundMarkEngaged: (() => void) | null = null;
    private boundTrackTimeOnPage: (() => void) | null = null;
    private boundVisibilityHandler: (() => void) | null = null;
    /** SPA navigation — listen for PageViewPlugin's custom event instead of patching history */
    private navigationHandler: (() => void) | null = null;
    private popstateHandler: (() => void) | null = null;

    init(tracker: TrackerCore): void {
        super.init(tracker);
        this.pageLoadTime = Date.now();
        this.engagementStartTime = Date.now();

        if (typeof document === 'undefined' || typeof window === 'undefined') return;

        // Setup engagement detection
        this.boundMarkEngaged = this.markEngaged.bind(this);
        this.boundTrackTimeOnPage = this.trackTimeOnPage.bind(this);
        this.boundVisibilityHandler = () => {
            if (document.visibilityState === 'hidden') {
                this.trackTimeOnPage();
            } else {
                // Reset engagement timer when page becomes visible again
                this.engagementStartTime = Date.now();
            }
        };

        ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((event) => {
            document.addEventListener(event, this.boundMarkEngaged!, { passive: true });
        });

        // Track time on page before unload
        window.addEventListener('beforeunload', this.boundTrackTimeOnPage);
        document.addEventListener('visibilitychange', this.boundVisibilityHandler);

        // Listen for navigation events dispatched by PageViewPlugin
        // instead of independently monkey-patching history.pushState
        this.navigationHandler = () => this.resetForNavigation();
        window.addEventListener('clianta:navigation', this.navigationHandler);

        // Handle back/forward navigation
        this.popstateHandler = () => this.resetForNavigation();
        window.addEventListener('popstate', this.popstateHandler);
    }

    destroy(): void {
        if (this.boundMarkEngaged && typeof document !== 'undefined') {
            ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((event) => {
                document.removeEventListener(event, this.boundMarkEngaged!);
            });
        }
        if (this.boundTrackTimeOnPage && typeof window !== 'undefined') {
            window.removeEventListener('beforeunload', this.boundTrackTimeOnPage);
        }
        if (this.boundVisibilityHandler && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
        }
        if (this.navigationHandler && typeof window !== 'undefined') {
            window.removeEventListener('clianta:navigation', this.navigationHandler);
            this.navigationHandler = null;
        }
        if (this.popstateHandler && typeof window !== 'undefined') {
            window.removeEventListener('popstate', this.popstateHandler);
            this.popstateHandler = null;
        }
        if (this.engagementTimeout) {
            clearTimeout(this.engagementTimeout);
        }
        super.destroy();
    }

    private resetForNavigation(): void {
        this.pageLoadTime = Date.now();
        this.engagementStartTime = Date.now();
        this.isEngaged = false;
        if (this.engagementTimeout) {
            clearTimeout(this.engagementTimeout);
            this.engagementTimeout = null;
        }
    }

    private markEngaged(): void {
        if (!this.isEngaged) {
            this.isEngaged = true;
            this.track('engagement', 'User Engaged', {
                timeToEngage: Date.now() - this.pageLoadTime,
            });
        }

        // Reset engagement timeout
        if (this.engagementTimeout) {
            clearTimeout(this.engagementTimeout);
        }
        this.engagementTimeout = setTimeout(() => {
            this.isEngaged = false;
        }, 30000); // 30 seconds of inactivity
    }

    private trackTimeOnPage(): void {
        const timeSpent = Math.floor((Date.now() - this.engagementStartTime) / 1000);

        if (timeSpent > 0) {
            this.track('time_on_page', 'Time Spent', {
                seconds: timeSpent,
                engaged: this.isEngaged,
            });
        }
    }
}
