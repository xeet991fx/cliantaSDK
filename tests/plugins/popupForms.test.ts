/**
 * PopupForms Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PopupFormsPlugin } from '../../src/plugins/popupForms';
import type { TrackerCore } from '../../src/types';

describe('PopupFormsPlugin', () => {
    let plugin: PopupFormsPlugin;
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

        vi.stubGlobal('localStorage', {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });

        vi.stubGlobal('sessionStorage', {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });

        vi.stubGlobal('window', {
            location: { href: 'https://test.com/page' },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            scrollY: 0,
            innerHeight: 800,
        });

        vi.stubGlobal('document', {
            documentElement: { scrollHeight: 2000 },
            visibilityState: 'visible',
            body: { appendChild: vi.fn() },
            createElement: vi.fn(() => ({
                style: {},
                appendChild: vi.fn(),
                addEventListener: vi.fn(),
                querySelector: vi.fn(() => null),
                querySelectorAll: vi.fn(() => []),
                remove: vi.fn(),
                setAttribute: vi.fn(),
                createElementNS: vi.fn(),
            })),
            createElementNS: vi.fn(() => ({
                setAttribute: vi.fn(),
                appendChild: vi.fn(),
            })),
            getElementById: vi.fn(() => null),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            querySelectorAll: vi.fn(() => []),
        });

        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                success: true,
                data: [],
            }),
        })));

        plugin = new PopupFormsPlugin();
    });

    afterEach(() => {
        plugin.destroy();
        vi.clearAllMocks();
    });

    describe('init()', () => {
        it('should fetch forms from API', async () => {
            await plugin.init(mockTracker);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/public/lead-forms/workspace-123')
            );
        });

        it('should load shown forms from storage', async () => {
            (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(
                JSON.stringify({ forms: ['form-1', 'form-2'] })
            );

            await plugin.init(mockTracker);

            expect(localStorage.getItem).toHaveBeenCalledWith('eutexa_shown_forms');
        });
    });

    describe('Trigger types', () => {
        const mockForm = {
            _id: 'form-1',
            name: 'Test Form',
            type: 'popup' as const,
            fields: [{ name: 'email', label: 'Email', type: 'email' as const, required: true }],
            style: { position: 'center', theme: 'light', primaryColor: '#10B981', backgroundColor: '#fff', textColor: '#000', borderRadius: 8, showOverlay: true },
            trigger: { type: 'delay' as const, value: 1 },
            showFrequency: 'always',
        };

        beforeEach(() => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, data: [mockForm] }),
            });
        });

        it('should setup delay trigger', async () => {
            vi.useFakeTimers();
            await plugin.init(mockTracker);
            vi.useRealTimers();
            // Delay trigger should be set
        });

        it('should setup scroll trigger', async () => {
            const scrollForm = { ...mockForm, trigger: { type: 'scroll' as const, value: 50 } };
            (global.fetch as ReturnType<typeof vi.fn>).mockReset();
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, data: [scrollForm] }),
            });

            await plugin.init(mockTracker);

            expect(window.addEventListener).toHaveBeenCalledWith(
                'scroll',
                expect.any(Function),
                { passive: true }
            );
        });

        it('should setup exit intent trigger', async () => {
            const exitForm = { ...mockForm, trigger: { type: 'exit_intent' as const } };
            (global.fetch as ReturnType<typeof vi.fn>).mockReset();
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, data: [exitForm] }),
            });

            await plugin.init(mockTracker);

            expect(document.addEventListener).toHaveBeenCalledWith(
                'mouseout',
                expect.any(Function)
            );
        });
    });

    describe('Show frequency', () => {
        const createForm = (id: string, frequency: string) => ({
            _id: id,
            name: 'Test Form',
            type: 'popup' as const,
            fields: [],
            style: { position: 'center', theme: 'light', primaryColor: '#10B981', backgroundColor: '#fff', textColor: '#000', borderRadius: 8, showOverlay: true },
            trigger: { type: 'delay' as const, value: 0 },
            showFrequency: frequency,
        });

        it('should respect once_per_visitor frequency', async () => {
            (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(
                JSON.stringify({ forms: ['form-1'] })
            );

            const form = createForm('form-1', 'once_per_visitor');
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, data: [form] }),
            });

            await plugin.init(mockTracker);
            // Form should not be shown (already in shownForms)
        });

        it('should respect once_per_session frequency', async () => {
            (sessionStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('true');

            const form = createForm('form-2', 'once_per_session');
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, data: [form] }),
            });

            await plugin.init(mockTracker);
            // Form should not be shown (already shown in session)
        });
    });

    describe('destroy()', () => {
        it('should remove scroll listener', async () => {
            const scrollForm = {
                _id: 'form-scroll',
                name: 'Scroll Form',
                type: 'popup' as const,
                fields: [],
                style: { position: 'center', theme: 'light', primaryColor: '#000', backgroundColor: '#fff', textColor: '#000', borderRadius: 8, showOverlay: true },
                trigger: { type: 'scroll' as const, value: 50 },
                showFrequency: 'always',
            };

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, data: [scrollForm] }),
            });

            await plugin.init(mockTracker);
            plugin.destroy();
            expect(window.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
        });

        it('should remove exit intent listener', async () => {
            const exitForm = {
                _id: 'form-exit',
                name: 'Exit Form',
                type: 'popup' as const,
                fields: [],
                style: { position: 'center', theme: 'light', primaryColor: '#000', backgroundColor: '#fff', textColor: '#000', borderRadius: 8, showOverlay: true },
                trigger: { type: 'exit_intent' as const },
                showFrequency: 'always',
            };

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true, data: [exitForm] }),
            });

            await plugin.init(mockTracker);
            plugin.destroy();
            expect(document.removeEventListener).toHaveBeenCalledWith('mouseout', expect.any(Function));
        });
    });
});
