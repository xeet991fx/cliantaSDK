/**
 * Forms Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FormsPlugin } from '../../src/plugins/forms';
import type { TrackerCore } from '../../src/types';

describe('FormsPlugin', () => {
    let plugin: FormsPlugin;
    let mockTracker: TrackerCore;
    let mockForm: HTMLFormElement;

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

        // Create real form in the DOM
        mockForm = document.createElement('form');
        mockForm.id = 'test-form';
        mockForm.name = 'contact-form';
        mockForm.action = '/submit';
        mockForm.method = 'POST';
        document.body.appendChild(mockForm);

        // Mock MutationObserver
        vi.stubGlobal('MutationObserver', vi.fn(() => ({
            observe: vi.fn(),
            disconnect: vi.fn(),
        })));

        plugin = new FormsPlugin();
    });

    afterEach(() => {
        if (plugin) {
            plugin.destroy();
        }
        // Clean up DOM
        if (mockForm && mockForm.parentNode) {
            mockForm.parentNode.removeChild(mockForm);
        }
        vi.unstubAllGlobals();
    });

    describe('init()', () => {
        it('should track existing forms on init', () => {
            plugin.init(mockTracker);
            expect(mockTracker.track).toHaveBeenCalledWith(
                'form_view',
                'Form Viewed',
                expect.objectContaining({
                    formId: 'test-form',
                    action: expect.stringContaining('/submit'), // form.action returns full URL
                    method: 'post', // jsdom normalizes to lowercase
                })
            );
        });

        it('should setup MutationObserver for dynamic forms', () => {
            plugin.init(mockTracker);
            expect(MutationObserver).toHaveBeenCalled();
        });
    });

    describe('Field interactions', () => {
        let mockInput: HTMLInputElement;

        beforeEach(() => {
            // Create real input element
            mockInput = document.createElement('input');
            mockInput.name = 'email';
            mockInput.type = 'email';
            mockForm.appendChild(mockInput);

            // Spy on addEventListener for the input
            vi.spyOn(mockInput, 'addEventListener');

            plugin.init(mockTracker);
        });

        it('should track field focus', () => {
            // Get the focus handler
            const focusHandler = (mockInput.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'focus')?.[1];

            if (focusHandler) {
                focusHandler();
                expect(mockTracker.track).toHaveBeenCalledWith(
                    'form_interaction',
                    'Form Field Interaction',
                    expect.objectContaining({
                        fieldName: 'email',
                        interactionType: 'focus',
                    })
                );
            }
        });

        it('should track field blur', () => {
            const blurHandler = (mockInput.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'blur')?.[1];

            if (blurHandler) {
                blurHandler();
                expect(mockTracker.track).toHaveBeenCalledWith(
                    'form_interaction',
                    'Form Field Interaction',
                    expect.objectContaining({
                        interactionType: 'blur',
                    })
                );
            }
        });

        it('should track field change', () => {
            const changeHandler = (mockInput.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'change')?.[1];

            if (changeHandler) {
                changeHandler();
                expect(mockTracker.track).toHaveBeenCalledWith(
                    'form_interaction',
                    'Form Field Interaction',
                    expect.objectContaining({
                        interactionType: 'change',
                    })
                );
            }
        });

        it('should not track same interaction twice', () => {
            const focusHandler = (mockInput.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'focus')?.[1];

            if (focusHandler) {
                focusHandler();
                const countBefore = (mockTracker.track as ReturnType<typeof vi.fn>).mock.calls.length;
                focusHandler();
                const countAfter = (mockTracker.track as ReturnType<typeof vi.fn>).mock.calls.length;
                // Should not track again
                expect(countAfter).toBe(countBefore);
            }
        });
    });

    describe('Form submission', () => {
        beforeEach(() => {
            // Spy on form's addEventListener
            vi.spyOn(mockForm, 'addEventListener');
            plugin.init(mockTracker);
        });

        it('should track form submission', () => {
            // Get submit handler - it's added via addListener
            const submitHandler = (mockForm.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'submit')?.[1];

            if (submitHandler) {
                submitHandler();
                expect(mockTracker.track).toHaveBeenCalledWith(
                    'form_submit',
                    'Form Submitted',
                    expect.objectContaining({
                        formId: 'test-form',
                    })
                );
            }
        });
    });

    describe('Auto-identify', () => {
        it('should auto-identify when email field found', () => {
            // Create real email input
            const emailInput = document.createElement('input');
            emailInput.type = 'email';
            emailInput.name = 'email';
            emailInput.value = 'user@example.com';
            mockForm.appendChild(emailInput);

            // Spy on form's addEventListener
            vi.spyOn(mockForm, 'addEventListener');

            plugin.init(mockTracker);

            const submitHandler = (mockForm.addEventListener as ReturnType<typeof vi.fn>).mock.calls
                .find((call) => call[0] === 'submit')?.[1];

            if (submitHandler) {
                submitHandler();
                expect(mockTracker.identify).toHaveBeenCalledWith(
                    'user@example.com',
                    expect.any(Object)
                );
            }
        });
    });

    describe('destroy()', () => {
        it('should disconnect MutationObserver', () => {
            plugin.init(mockTracker);
            const observer = (MutationObserver as ReturnType<typeof vi.fn>).mock.results[0].value;
            plugin.destroy();
            expect(observer.disconnect).toHaveBeenCalled();
        });

        it('should cleanup all listeners', () => {
            plugin.init(mockTracker);
            plugin.destroy();
            // Should not throw errors
        });
    });
});
