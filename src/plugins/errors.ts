/**
 * Eutexa SDK - Error Tracking Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

/**
 * Error Tracking Plugin - Tracks JavaScript errors
 */
/** Max unique errors to track per page (prevents queue flooding from error loops) */
const MAX_UNIQUE_ERRORS = 20;

export class ErrorsPlugin extends BasePlugin {
    name: PluginName = 'errors';
    private boundErrorHandler: ((e: ErrorEvent) => void) | null = null;
    private boundRejectionHandler: ((e: PromiseRejectionEvent) => void) | null = null;
    /** Seen error fingerprints — deduplicates repeated identical errors */
    private seenErrors: Set<string> = new Set();

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof window !== 'undefined') {
            this.boundErrorHandler = this.handleError.bind(this);
            this.boundRejectionHandler = this.handleRejection.bind(this);

            window.addEventListener('error', this.boundErrorHandler);
            window.addEventListener('unhandledrejection', this.boundRejectionHandler);
        }
    }

    destroy(): void {
        if (typeof window !== 'undefined') {
            if (this.boundErrorHandler) {
                window.removeEventListener('error', this.boundErrorHandler);
            }
            if (this.boundRejectionHandler) {
                window.removeEventListener('unhandledrejection', this.boundRejectionHandler);
            }
        }
        super.destroy();
    }

    private handleError(e: ErrorEvent): void {
        const fingerprint = `${e.message}:${e.filename}:${e.lineno}`;
        if (!this.dedup(fingerprint)) return;

        this.track('error', 'JavaScript Error', {
            message: e.message,
            filename: e.filename,
            line: e.lineno,
            column: e.colno,
            stack: e.error?.stack?.substring(0, 500),
        });
    }

    private handleRejection(e: PromiseRejectionEvent): void {
        const reason = String(e.reason).substring(0, 200);
        if (!this.dedup(reason)) return;

        this.track('error', 'Unhandled Promise Rejection', { reason });
    }

    /**
     * Returns true if this error fingerprint is new (should be tracked).
     * Caps at MAX_UNIQUE_ERRORS to prevent queue flooding from error loops.
     */
    private dedup(fingerprint: string): boolean {
        if (this.seenErrors.has(fingerprint)) return false;
        if (this.seenErrors.size >= MAX_UNIQUE_ERRORS) return false;
        this.seenErrors.add(fingerprint);
        return true;
    }
}
