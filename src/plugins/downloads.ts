/**
 * MorrisB Tracking SDK - Downloads Plugin
 * @version 3.0.0
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

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof document !== 'undefined') {
            this.boundHandler = this.handleClick.bind(this);
            document.addEventListener('click', this.boundHandler, true);
        }
    }

    destroy(): void {
        if (this.boundHandler && typeof document !== 'undefined') {
            document.removeEventListener('click', this.boundHandler, true);
        }
        super.destroy();
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
