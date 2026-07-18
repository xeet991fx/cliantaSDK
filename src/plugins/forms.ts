/**
 * Eutexa SDK - Form Tracking Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore, UserTraits } from '../types';
import { BasePlugin } from './base';

/**
 * Form Tracking Plugin - Auto-tracks form views, interactions, and submissions
 */
export class FormsPlugin extends BasePlugin {
    name: PluginName = 'forms';
    private trackedForms: WeakSet<HTMLFormElement> = new WeakSet();
    private formInteractions: Set<string> = new Set();
    private observer: MutationObserver | null = null;
    private observerTimer: ReturnType<typeof setTimeout> | null = null;
    private listeners: { element: EventTarget; event: string; handler: EventListener }[] = [];

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof document === 'undefined') return;

        // Track existing forms
        this.trackAllForms();

        // Watch for dynamically added forms — debounced to avoid O(DOM) cost on every mutation
        if (typeof MutationObserver !== 'undefined') {
            this.observer = new MutationObserver(() => {
                if (this.observerTimer) clearTimeout(this.observerTimer);
                this.observerTimer = setTimeout(() => this.trackAllForms(), 100);
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    destroy(): void {
        if (this.observerTimer) {
            clearTimeout(this.observerTimer);
            this.observerTimer = null;
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        // Remove all tracked event listeners
        for (const { element, event, handler } of this.listeners) {
            element.removeEventListener(event, handler);
        }
        this.listeners = [];
        super.destroy();
    }

    /**
     * Track event listener for cleanup
     */
    private addListener(element: EventTarget, event: string, handler: EventListener): void {
        element.addEventListener(event, handler);
        this.listeners.push({ element, event, handler });
    }

    private trackAllForms(): void {
        document.querySelectorAll('form').forEach((form) => {
            this.setupFormTracking(form as HTMLFormElement);
        });
    }

    private setupFormTracking(form: HTMLFormElement): void {
        if (this.trackedForms.has(form)) return;
        this.trackedForms.add(form);

        const formId = form.id || form.name || `form-${Math.random().toString(36).substring(2, 11)}`;

        // Track form view
        this.track('form_view', 'Form Viewed', {
            formId,
            action: form.action,
            method: form.method,
            fieldCount: form.elements.length,
        });

        // Track field interactions
        Array.from(form.elements).forEach((field) => {
            if (field instanceof HTMLInputElement ||
                field instanceof HTMLSelectElement ||
                field instanceof HTMLTextAreaElement) {
                if (!field.name || field.type === 'submit' || field.type === 'button') return;

                ['focus', 'blur', 'change'].forEach((eventType) => {
                    const handler = () => {
                        const key = `${formId}-${field.name}-${eventType}`;
                        if (!this.formInteractions.has(key)) {
                            this.formInteractions.add(key);
                            this.track('form_interaction', 'Form Field Interaction', {
                                formId,
                                fieldName: field.name,
                                fieldType: field.type,
                                interactionType: eventType,
                            });
                        }
                    };
                    this.addListener(field, eventType, handler);
                });
            }
        });

        // Track form submission
        const submitHandler = () => {
            this.track('form_submit', 'Form Submitted', {
                formId,
                action: form.action,
                method: form.method,
            });

            // Auto-identify if email field found
            this.autoIdentify(form);
        };
        this.addListener(form, 'submit', submitHandler);
    }

    private autoIdentify(form: HTMLFormElement): void {
        const emailField = form.querySelector<HTMLInputElement>(
            'input[type="email"], input[name*="email"]'
        );

        if (!emailField?.value || !this.tracker) return;

        const email = emailField.value;
        const traits: UserTraits = {};

        // Capture common fields
        const firstNameField = form.querySelector<HTMLInputElement>('[name*="first"], [name*="fname"]');
        const lastNameField = form.querySelector<HTMLInputElement>('[name*="last"], [name*="lname"]');
        const companyField = form.querySelector<HTMLInputElement>('[name*="company"], [name*="organization"]');
        const phoneField = form.querySelector<HTMLInputElement>('[type="tel"], [name*="phone"]');

        if (firstNameField?.value) traits.firstName = firstNameField.value;
        if (lastNameField?.value) traits.lastName = lastNameField.value;
        if (companyField?.value) traits.company = companyField.value;
        if (phoneField?.value) traits.phone = phoneField.value;

        this.tracker.identify(email, traits);
    }
}
