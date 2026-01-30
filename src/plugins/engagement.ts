/**
 * MorrisB Tracking SDK - Engagement Plugin
 * @version 3.0.0
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

    init(tracker: TrackerCore): void {
        super.init(tracker);
        this.pageLoadTime = Date.now();
        this.engagementStartTime = Date.now();

        if (typeof document === 'undefined' || typeof window === 'undefined') return;

        // Setup engagement detection
        this.boundMarkEngaged = this.markEngaged.bind(this);
        this.boundTrackTimeOnPage = this.trackTimeOnPage.bind(this);

        ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((event) => {
            document.addEventListener(event, this.boundMarkEngaged!, { passive: true });
        });

        // Track time on page before unload
        window.addEventListener('beforeunload', this.boundTrackTimeOnPage);
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.trackTimeOnPage();
            } else {
                // Reset engagement timer when page becomes visible again
                this.engagementStartTime = Date.now();
            }
        });
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
        if (this.engagementTimeout) {
            clearTimeout(this.engagementTimeout);
        }
        super.destroy();
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
