/**
 * Exit Intent Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExitIntentPlugin } from '../../src/plugins/exitIntent';
import type { TrackerCore } from '../../src/types';

// Mock isMobile utility
vi.mock('../../src/utils', async () => {
    const actual = await vi.importActual('../../src/utils');
    return {
        ...actual,
        isMobile: vi.fn(() => false), // Default to desktop
    };
});

import { isMobile } from '../../src/utils';

describe('ExitIntentPlugin', () => {
    let plugin: ExitIntentPlugin;
    let mockTracker: TrackerCore;

    beforeEach(() => {
        // Reset mock
        vi.mocked(isMobile).mockReturnValue(false);

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

        // Spy on document event listeners
        vi.spyOn(document, 'addEventListener');
        vi.spyOn(document, 'removeEventListener');

        plugin = new ExitIntentPlugin();
    });

    afterEach(() => {
        if (plugin) {
            plugin.destroy();
        }
        vi.restoreAllMocks();
    });

    describe('init()', () => {
        it('should register mouseleave listener on desktop', () => {
            plugin.init(mockTracker);
            expect(document.addEventListener).toHaveBeenCalledWith(
                'mouseleave',
                expect.any(Function)
            );
        });

        it('should NOT register listener on mobile', () => {
            vi.mocked(isMobile).mockReturnValue(true);

            const mobilePlugin = new ExitIntentPlugin();
            mobilePlugin.init(mockTracker);

            expect(document.addEventListener).not.toHaveBeenCalledWith(
                'mouseleave',
                expect.any(Function)
            );

            mobilePlugin.destroy();
        });
    });

    describe('exit intent detection', () => {
        beforeEach(() => {
            plugin.init(mockTracker);
        });

        it('should track exit intent when mouse leaves from top', () => {
            const mouseleaveHandler = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'mouseleave')?.[1];

            if (mouseleaveHandler) {
                // Simulate mouse leaving from top (clientY <= 0)
                const event = { clientY: -10 } as MouseEvent;
                mouseleaveHandler(event);

                expect(mockTracker.track).toHaveBeenCalledWith(
                    'exit_intent',
                    'Exit Intent Detected',
                    expect.objectContaining({
                        timeOnPage: expect.any(Number),
                    })
                );
            }
        });

        it('should NOT track when mouse leaves from side or bottom', () => {
            const mouseleaveHandler = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'mouseleave')?.[1];

            if (mouseleaveHandler) {
                // Mouse leaves from side (clientY > 0)
                const event = { clientY: 100 } as MouseEvent;
                mouseleaveHandler(event);

                expect(mockTracker.track).not.toHaveBeenCalled();
            }
        });

        it('should only track exit intent once per session', () => {
            const mouseleaveHandler = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'mouseleave')?.[1];

            if (mouseleaveHandler) {
                const event = { clientY: -10 } as MouseEvent;

                // Trigger multiple times
                mouseleaveHandler(event);
                mouseleaveHandler(event);
                mouseleaveHandler(event);

                expect(mockTracker.track).toHaveBeenCalledTimes(1);
            }
        });
    });

    describe('destroy()', () => {
        it('should remove mouseleave listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();

            expect(document.removeEventListener).toHaveBeenCalledWith(
                'mouseleave',
                expect.any(Function)
            );
        });
    });
});
