/**
 * Eutexa SDK - Engagement Plugin
 *
 * Tracks user engagement and time-on-page with one event of each type per
 * page lifecycle (a "page" being either a real navigation or an SPA route
 * change announced via the `eutexa:navigation` event).
 *
 *   • `engagement` / "User Engaged" — fires AT MOST ONCE per page when the
 *     visitor first interacts (mousemove / keydown / touchstart / scroll).
 *     No more 30s-idle bounce loops emitting duplicate events.
 *
 *   • `time_on_page` / "Time Spent" — fires AT MOST ONCE per page on
 *     beforeunload / pagehide / visibility:hidden. Reports the CUMULATIVE
 *     visible time across tab-switches, not just the last visible window.
 *
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

/**
 * Engagement Plugin - Tracks user engagement and time on page
 */
export class EngagementPlugin extends BasePlugin {
    name: PluginName = 'engagement';

    /** Plugin-init time (used for time-to-engage). */
    private pageLoadTime = 0;

    /** Total visible time accumulated across visibility transitions, in ms. */
    private accumulatedVisibleMs = 0;

    /** Timestamp the page last became visible (or page load). 0 when hidden. */
    private currentVisibleSince = 0;

    /** Whether the user has interacted at least once on the current page. */
    private hasEngaged = false;

    /** Whether we've already emitted the "User Engaged" event for the current page. */
    private engagementReported = false;

    /** Whether we've already emitted the "Time Spent" event for the current page. */
    private timeOnPageReported = false;

    private boundMarkEngaged: (() => void) | null = null;
    private boundUnloadHandler: (() => void) | null = null;
    private boundVisibilityHandler: (() => void) | null = null;
    private navigationHandler: (() => void) | null = null;
    private popstateHandler: (() => void) | null = null;

    init(tracker: TrackerCore): void {
        super.init(tracker);
        this.pageLoadTime = Date.now();
        this.currentVisibleSince = Date.now();

        if (typeof document === 'undefined' || typeof window === 'undefined') return;

        // Engagement detection — fires "User Engaged" once on first interaction
        this.boundMarkEngaged = this.markEngaged.bind(this);
        ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((event) => {
            document.addEventListener(event, this.boundMarkEngaged!, { passive: true });
        });

        // Visibility transitions — pause/resume the visible-time accumulator
        this.boundVisibilityHandler = () => {
            if (document.visibilityState === 'hidden') {
                this.pauseVisibleTimer();
            } else {
                this.resumeVisibleTimer();
            }
        };
        document.addEventListener('visibilitychange', this.boundVisibilityHandler);

        // Final flush on navigation away
        this.boundUnloadHandler = () => this.reportTimeOnPage();
        window.addEventListener('beforeunload', this.boundUnloadHandler);
        window.addEventListener('pagehide', this.boundUnloadHandler);

        // SPA navigation — flush the leaving route's metrics, then reset
        this.navigationHandler = () => this.handleSpaNavigation();
        window.addEventListener('eutexa:navigation', this.navigationHandler);

        this.popstateHandler = () => this.handleSpaNavigation();
        window.addEventListener('popstate', this.popstateHandler);
    }

    destroy(): void {
        if (this.boundMarkEngaged && typeof document !== 'undefined') {
            ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((event) => {
                document.removeEventListener(event, this.boundMarkEngaged!);
            });
        }
        if (typeof window !== 'undefined') {
            if (this.boundUnloadHandler) {
                window.removeEventListener('beforeunload', this.boundUnloadHandler);
                window.removeEventListener('pagehide', this.boundUnloadHandler);
            }
            if (this.navigationHandler) {
                window.removeEventListener('eutexa:navigation', this.navigationHandler);
                this.navigationHandler = null;
            }
            if (this.popstateHandler) {
                window.removeEventListener('popstate', this.popstateHandler);
                this.popstateHandler = null;
            }
        }
        if (this.boundVisibilityHandler && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
        }
        super.destroy();
    }

    // ════════════════════════════════════════════════
    // SPA navigation
    // ════════════════════════════════════════════════

    private handleSpaNavigation(): void {
        // Flush whatever we have for the leaving route
        this.reportTimeOnPage();

        // Reset state for the new route
        this.pageLoadTime = Date.now();
        this.currentVisibleSince = (typeof document !== 'undefined' && document.visibilityState === 'hidden')
            ? 0
            : Date.now();
        this.accumulatedVisibleMs = 0;
        this.hasEngaged = false;
        this.engagementReported = false;
        this.timeOnPageReported = false;
    }

    // ════════════════════════════════════════════════
    // Visibility timing
    // ════════════════════════════════════════════════

    private pauseVisibleTimer(): void {
        if (this.currentVisibleSince > 0) {
            this.accumulatedVisibleMs += Date.now() - this.currentVisibleSince;
            this.currentVisibleSince = 0;
        }
    }

    private resumeVisibleTimer(): void {
        if (this.currentVisibleSince === 0) {
            this.currentVisibleSince = Date.now();
        }
    }

    private getTotalVisibleMs(): number {
        const live = this.currentVisibleSince > 0 ? Date.now() - this.currentVisibleSince : 0;
        return this.accumulatedVisibleMs + live;
    }

    // ════════════════════════════════════════════════
    // Engagement
    // ════════════════════════════════════════════════

    private markEngaged(): void {
        if (this.hasEngaged) return;
        this.hasEngaged = true;

        if (this.engagementReported) return;
        this.engagementReported = true;

        this.track('engagement', 'User Engaged', {
            timeToEngage: Date.now() - this.pageLoadTime,
        });
    }

    // ════════════════════════════════════════════════
    // Time on page
    // ════════════════════════════════════════════════

    private reportTimeOnPage(): void {
        if (this.timeOnPageReported) return;
        this.timeOnPageReported = true;

        // Capture any in-progress visible interval
        this.pauseVisibleTimer();

        const totalSeconds = Math.floor(this.accumulatedVisibleMs / 1000);
        if (totalSeconds <= 0) return;

        this.track('time_on_page', 'Time Spent', {
            seconds: totalSeconds,
            engaged: this.hasEngaged,
        });
    }
}
