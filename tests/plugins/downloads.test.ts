/**
 * Downloads Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DownloadsPlugin } from '../../src/plugins/downloads';
import type { TrackerCore } from '../../src/types';

describe('DownloadsPlugin', () => {
    let plugin: DownloadsPlugin;
    let mockTracker: TrackerCore;
    let originalPushState: typeof history.pushState;
    let originalReplaceState: typeof history.replaceState;

    beforeEach(() => {
        // Store originals from jsdom
        originalPushState = window.history?.pushState;
        originalReplaceState = window.history?.replaceState;

        mockTracker = {
            track: vi.fn(),
            page: vi.fn(),
            identify: vi.fn(),
            consent: vi.fn(),
            getConsentState: vi.fn(),
            getVisitorId: vi.fn(() => 'visitor-123'),
            getSessionId: vi.fn(() => 'session-123'),
            getWorkspaceId: vi.fn(() => 'workspace-123'),
            getConfig: vi.fn(() => ({ apiEndpoint: 'https://api.test.com' })),
            flush: vi.fn(),
            reset: vi.fn(),
            deleteData: vi.fn(),
            debug: vi.fn(),
        } as unknown as TrackerCore;

        // Spy on document/window event listeners
        vi.spyOn(document, 'addEventListener');
        vi.spyOn(document, 'removeEventListener');
        vi.spyOn(window, 'addEventListener');
        vi.spyOn(window, 'removeEventListener');

        plugin = new DownloadsPlugin();
    });

    afterEach(() => {
        if (plugin) {
            plugin.destroy();
        }
        // Restore originals
        if (originalPushState) window.history.pushState = originalPushState;
        if (originalReplaceState) window.history.replaceState = originalReplaceState;
        vi.restoreAllMocks();
    });

    describe('init()', () => {
        it('should register click listener on document', () => {
            plugin.init(mockTracker);
            expect(document.addEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function),
                true
            );
        });

        it('should setup SPA navigation reset', () => {
            plugin.init(mockTracker);
            // Plugin listens for clianta:navigation custom event
            expect(window.addEventListener).toHaveBeenCalledWith('clianta:navigation', expect.any(Function));
        });

        it('should register popstate handler', () => {
            plugin.init(mockTracker);
            expect(window.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
        });
    });

    describe('download tracking', () => {
        beforeEach(() => {
            plugin.init(mockTracker);
        });

        it('should track PDF download', () => {
            const link = document.createElement('a');
            link.href = 'https://example.com/document.pdf';
            link.textContent = 'Download PDF';
            document.body.appendChild(link);

            link.click();

            expect(mockTracker.track).toHaveBeenCalledWith(
                'download',
                'File Download',
                expect.objectContaining({
                    url: 'https://example.com/document.pdf',
                    filename: 'document.pdf',
                    fileType: 'pdf',
                    linkText: 'Download PDF',
                })
            );

            document.body.removeChild(link);
        });

        it('should track ZIP download', () => {
            const link = document.createElement('a');
            link.href = 'https://example.com/archive.zip';
            link.textContent = 'Download Archive';
            document.body.appendChild(link);

            link.click();

            expect(mockTracker.track).toHaveBeenCalledWith(
                'download',
                'File Download',
                expect.objectContaining({
                    filename: 'archive.zip',
                    fileType: 'zip',
                })
            );

            document.body.removeChild(link);
        });

        it('should track Excel downloads', () => {
            const link = document.createElement('a');
            link.href = 'https://example.com/data.xlsx';
            document.body.appendChild(link);

            link.click();

            expect(mockTracker.track).toHaveBeenCalledWith(
                'download',
                'File Download',
                expect.objectContaining({
                    fileType: 'xlsx',
                })
            );

            document.body.removeChild(link);
        });

        it('should NOT track non-download links', () => {
            const link = document.createElement('a');
            link.href = 'https://example.com/page';
            link.textContent = 'Regular Link';
            document.body.appendChild(link);

            link.click();

            expect(mockTracker.track).not.toHaveBeenCalled();

            document.body.removeChild(link);
        });

        it('should NOT track same download twice', () => {
            const link = document.createElement('a');
            link.href = 'https://example.com/report.pdf';
            document.body.appendChild(link);

            link.click();
            link.click();
            link.click();

            expect(mockTracker.track).toHaveBeenCalledTimes(1);

            document.body.removeChild(link);
        });
    });

    describe('SPA navigation reset', () => {
        beforeEach(() => {
            plugin.init(mockTracker);
        });

        it('should reset tracking on navigation event', () => {
            // Track a download
            const link = document.createElement('a');
            link.href = 'https://example.com/file.pdf';
            document.body.appendChild(link);
            link.click();
            expect(mockTracker.track).toHaveBeenCalledTimes(1);

            // Dispatch navigation event (resets tracking)
            window.dispatchEvent(new Event('clianta:navigation'));

            // Same download should be tracked again
            link.click();
            expect(mockTracker.track).toHaveBeenCalledTimes(2);

            document.body.removeChild(link);
        });
    });

    describe('destroy()', () => {
        it('should remove click listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();

            expect(document.removeEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function),
                true
            );
        });

        it('should restore History API', () => {
            plugin.init(mockTracker);
            plugin.destroy();

            expect(window.history.pushState).toBe(originalPushState);
            expect(window.history.replaceState).toBe(originalReplaceState);
        });

        it('should remove popstate listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();

            expect(window.removeEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
        });
    });
});
