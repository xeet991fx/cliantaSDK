/**
 * Clianta SDK - Downloads Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';
import { isDownloadUrl, getFilenameFromUrl, getFileExtension, getElementText } from '../utils';

/**
 * Downloads Plugin - Tracks file downloads
 */
export class DownloadsPlugin extends BasePlugin {
    name: PluginName = 'downloads';
    private trackedDownloads: Set<string> = new Set();
    private boundHandler: ((e: MouseEvent) => void) | null = null;
    /** SPA navigation support */
    private originalPushState: typeof history.pushState | null = null;
    private originalReplaceState: typeof history.replaceState | null = null;
    private popstateHandler: (() => void) | null = null;

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof document !== 'undefined') {
            this.boundHandler = this.handleClick.bind(this);
            document.addEventListener('click', this.boundHandler, true);

            // Setup SPA navigation reset
            this.setupNavigationReset();
        }
    }

    destroy(): void {
        if (this.boundHandler && typeof document !== 'undefined') {
            document.removeEventListener('click', this.boundHandler, true);
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
     * Reset download tracking for SPA navigation
     */
    private resetForNavigation(): void {
        this.trackedDownloads.clear();
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

    private handleClick(e: MouseEvent): void {
        const link = (e.target as Element).closest('a');
        if (!link || !link.href) return;

        const url = link.href;

        // Check if it's a download link
        if (!isDownloadUrl(url)) return;

        // Avoid tracking the same download multiple times
        if (this.trackedDownloads.has(url)) return;
        this.trackedDownloads.add(url);

        this.track('download', 'File Download', {
            url,
            filename: getFilenameFromUrl(url),
            fileType: getFileExtension(url),
            linkText: getElementText(link, 100),
        });
    }
}
