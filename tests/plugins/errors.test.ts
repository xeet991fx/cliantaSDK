/**
 * Errors Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorsPlugin } from '../../src/plugins/errors';
import type { TrackerCore } from '../../src/types';

describe('ErrorsPlugin', () => {
    let plugin: ErrorsPlugin;
    let mockTracker: TrackerCore;

    beforeEach(() => {
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

        // Spy on window event listeners
        vi.spyOn(window, 'addEventListener');
        vi.spyOn(window, 'removeEventListener');

        plugin = new ErrorsPlugin();
    });

    afterEach(() => {
        if (plugin) {
            plugin.destroy();
        }
        vi.restoreAllMocks();
    });

    describe('init()', () => {
        it('should register error listener', () => {
            plugin.init(mockTracker);
            expect(window.addEventListener).toHaveBeenCalledWith(
                'error',
                expect.any(Function)
            );
        });

        it('should register unhandledrejection listener', () => {
            plugin.init(mockTracker);
            expect(window.addEventListener).toHaveBeenCalledWith(
                'unhandledrejection',
                expect.any(Function)
            );
        });
    });

    describe('error tracking', () => {
        beforeEach(() => {
            plugin.init(mockTracker);
        });

        it('should track JavaScript errors', () => {
            const errorHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'error')?.[1];

            if (errorHandler) {
                const errorEvent = {
                    message: 'Test error message',
                    filename: 'https://example.com/app.js',
                    lineno: 42,
                    colno: 10,
                    error: {
                        stack: 'Error: Test error\n    at foo (app.js:42:10)',
                    },
                } as ErrorEvent;

                errorHandler(errorEvent);

                expect(mockTracker.track).toHaveBeenCalledWith(
                    'error',
                    'JavaScript Error',
                    expect.objectContaining({
                        message: 'Test error message',
                        filename: 'https://example.com/app.js',
                        line: 42,
                        column: 10,
                        stack: expect.any(String),
                    })
                );
            }
        });

        it('should handle errors without stack trace', () => {
            const errorHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'error')?.[1];

            if (errorHandler) {
                const errorEvent = {
                    message: 'Simple error',
                    filename: 'script.js',
                    lineno: 1,
                    colno: 1,
                    error: null,
                } as unknown as ErrorEvent;

                errorHandler(errorEvent);

                expect(mockTracker.track).toHaveBeenCalledWith(
                    'error',
                    'JavaScript Error',
                    expect.objectContaining({
                        message: 'Simple error',
                        stack: undefined,
                    })
                );
            }
        });

        it('should track unhandled promise rejections', () => {
            const rejectionHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'unhandledrejection')?.[1];

            if (rejectionHandler) {
                const rejectionEvent = {
                    reason: 'Promise rejected with reason',
                } as PromiseRejectionEvent;

                rejectionHandler(rejectionEvent);

                expect(mockTracker.track).toHaveBeenCalledWith(
                    'error',
                    'Unhandled Promise Rejection',
                    expect.objectContaining({
                        reason: 'Promise rejected with reason',
                    })
                );
            }
        });

        it('should truncate long rejection reasons', () => {
            const rejectionHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'unhandledrejection')?.[1];

            if (rejectionHandler) {
                const longReason = 'A'.repeat(500);
                const rejectionEvent = {
                    reason: longReason,
                } as PromiseRejectionEvent;

                rejectionHandler(rejectionEvent);

                const trackCall = (mockTracker.track as ReturnType<typeof vi.fn>).mock.calls[0];
                expect(trackCall[2].reason.length).toBeLessThanOrEqual(200);
            }
        });
    });

    describe('destroy()', () => {
        it('should remove error listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();

            expect(window.removeEventListener).toHaveBeenCalledWith(
                'error',
                expect.any(Function)
            );
        });

        it('should remove unhandledrejection listener', () => {
            plugin.init(mockTracker);
            plugin.destroy();

            expect(window.removeEventListener).toHaveBeenCalledWith(
                'unhandledrejection',
                expect.any(Function)
            );
        });
    });
});
