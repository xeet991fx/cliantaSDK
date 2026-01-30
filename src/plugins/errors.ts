/**
 * Clianta SDK - Error Tracking Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

/**
 * Error Tracking Plugin - Tracks JavaScript errors
 */
export class ErrorsPlugin extends BasePlugin {
    name: PluginName = 'errors';
    private boundErrorHandler: ((e: ErrorEvent) => void) | null = null;
    private boundRejectionHandler: ((e: PromiseRejectionEvent) => void) | null = null;

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
        this.track('error', 'JavaScript Error', {
            message: e.message,
            filename: e.filename,
            line: e.lineno,
            column: e.colno,
            stack: e.error?.stack?.substring(0, 500),
        });
    }

    private handleRejection(e: PromiseRejectionEvent): void {
        this.track('error', 'Unhandled Promise Rejection', {
            reason: String(e.reason).substring(0, 200),
        });
    }
}
