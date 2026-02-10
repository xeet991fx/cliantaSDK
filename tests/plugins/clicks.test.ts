/**
 * Clicks Plugin Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClicksPlugin } from '../../src/plugins/clicks';
import type { TrackerCore } from '../../src/types';

describe('ClicksPlugin', () => {
    let plugin: ClicksPlugin;
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

        // Spy on document event listeners
        vi.spyOn(document, 'addEventListener');
        vi.spyOn(document, 'removeEventListener');

        plugin = new ClicksPlugin();
    });

    afterEach(() => {
        if (plugin) {
            plugin.destroy();
        }
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
    });

    describe('click handling', () => {
        beforeEach(() => {
            plugin.init(mockTracker);
        });

        it('should track button clicks', () => {
            const button = document.createElement('button');
            button.id = 'test-btn';
            button.className = 'cta-button';
            button.textContent = 'Sign Up';
            document.body.appendChild(button);

            // Dispatch click event
            button.click();

            expect(mockTracker.track).toHaveBeenCalledWith(
                'button_click',
                'Button Clicked',
                expect.objectContaining({
                    buttonText: 'Sign Up',
                    elementType: 'button',
                    elementId: 'test-btn',
                })
            );

            document.body.removeChild(button);
        });

        it('should track anchor/link clicks', () => {
            const link = document.createElement('a');
            link.id = 'test-link';
            link.href = 'https://example.com';
            link.textContent = 'Learn More';
            document.body.appendChild(link);

            link.click();

            expect(mockTracker.track).toHaveBeenCalledWith(
                'button_click',
                'Button Clicked',
                expect.objectContaining({
                    buttonText: 'Learn More',
                    elementType: 'a',
                    elementId: 'test-link',
                    href: 'https://example.com/',
                })
            );

            document.body.removeChild(link);
        });

        it('should track input button clicks', () => {
            const input = document.createElement('input');
            input.type = 'submit';
            input.value = 'Submit Form';
            input.id = 'submit-btn';
            document.body.appendChild(input);

            input.click();

            expect(mockTracker.track).toHaveBeenCalledWith(
                'button_click',
                'Button Clicked',
                expect.objectContaining({
                    elementType: 'input',
                    elementId: 'submit-btn',
                })
            );

            document.body.removeChild(input);
        });

        it('should NOT track non-trackable elements', () => {
            const div = document.createElement('div');
            div.textContent = 'Just a div';
            document.body.appendChild(div);

            div.click();

            expect(mockTracker.track).not.toHaveBeenCalled();

            document.body.removeChild(div);
        });

        it('should track elements with data-track-click attribute', () => {
            const div = document.createElement('div');
            div.setAttribute('data-track-click', 'true');
            div.textContent = 'Trackable Div';
            document.body.appendChild(div);

            div.click();

            expect(mockTracker.track).toHaveBeenCalledWith(
                'button_click',
                'Button Clicked',
                expect.objectContaining({
                    buttonText: 'Trackable Div',
                    elementType: 'div',
                })
            );

            document.body.removeChild(div);
        });
    });

    describe('destroy()', () => {
        it('should remove click listener from document', () => {
            plugin.init(mockTracker);
            plugin.destroy();

            expect(document.removeEventListener).toHaveBeenCalledWith(
                'click',
                expect.any(Function),
                true
            );
        });
    });
});
