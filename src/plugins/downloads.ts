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
    /** SPA navigation — listen for PageViewPlugin's custom event instead of patching history */
    private navigationHandler: (() => void) | null = null;
    private popstateHandler: (() => void) | null = null;

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof document !== 'undefined') {
            this.boundHandler = this.handleClick.bind(this);
            document.addEventListener('click', this.boundHandler, true);
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
            document.removeEventListener('click', this.boundHandler, true);
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

    /**
     * Reset download tracking for SPA navigation
     */
    private resetForNavigation(): void {
        this.trackedDownloads.clear();
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
