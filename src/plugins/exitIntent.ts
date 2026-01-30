/**
 * MorrisB Tracking SDK - Exit Intent Plugin
 * @version 3.0.0
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

    init(tracker: TrackerCore): void {
        super.init(tracker);
        this.pageLoadTime = Date.now();

        // Skip on mobile (no mouse events)
        if (isMobile()) return;

        if (typeof document !== 'undefined') {
            this.boundHandler = this.handleMouseLeave.bind(this);
            document.addEventListener('mouseleave', this.boundHandler);
        }
    }

    destroy(): void {
        if (this.boundHandler && typeof document !== 'undefined') {
            document.removeEventListener('mouseleave', this.boundHandler);
        }
        super.destroy();
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
