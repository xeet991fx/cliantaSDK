/**
 * Clianta SDK - Exit Intent Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';
import { isMobile } from '../utils';

/**
 * Exit Intent Plugin - Detects when user intends to leave the page
 */
export class ExitIntentPlugin extends BasePlugin {
    name: PluginName = 'exitIntent';
    private exitIntentShown = false;
    private pageLoadTime = 0;
    private boundHandler: ((e: MouseEvent) => void) | null = null;
    /** SPA navigation — listen for PageViewPlugin's custom event instead of patching history */
    private navigationHandler: (() => void) | null = null;
    private popstateHandler: (() => void) | null = null;

    init(tracker: TrackerCore): void {
        super.init(tracker);
        this.pageLoadTime = Date.now();

        // Skip on mobile (no mouse events)
        if (isMobile()) return;

        if (typeof document !== 'undefined') {
            this.boundHandler = this.handleMouseLeave.bind(this);
            document.addEventListener('mouseleave', this.boundHandler);
        }

        if (typeof window !== 'undefined') {
            // Listen for navigation events dispatched by PageViewPlugin
            // instead of independently monkey-patching history.pushState
            this.navigationHandler = () => this.resetForNavigation();
            window.addEventListener('clianta:navigation', this.navigationHandler);

            // Handle back/forward navigation
            this.popstateHandler = () => this.resetForNavigation();
            window.addEventListener('popstate', this.popstateHandler);
        }
    }

    destroy(): void {
        if (this.boundHandler && typeof document !== 'undefined') {
            document.removeEventListener('mouseleave', this.boundHandler);
        }
        if (this.navigationHandler && typeof window !== 'undefined') {
            window.removeEventListener('clianta:navigation', this.navigationHandler);
            this.navigationHandler = null;
        }
        if (this.popstateHandler && typeof window !== 'undefined') {
            window.removeEventListener('popstate', this.popstateHandler);
            this.popstateHandler = null;
        }
        super.destroy();
    }

    private resetForNavigation(): void {
        this.exitIntentShown = false;
        this.pageLoadTime = Date.now();
    }

    private handleMouseLeave(e: MouseEvent): void {
        // Only trigger when mouse leaves from the top of the page
        if (e.clientY > 0 || this.exitIntentShown) return;

        this.exitIntentShown = true;

        this.track('exit_intent', 'Exit Intent Detected', {
            timeOnPage: Date.now() - this.pageLoadTime,
        });
    }
}
