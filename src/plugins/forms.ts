/**
 * MorrisB Tracking SDK - Form Tracking Plugin
 * @version 3.0.0
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

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof document === 'undefined') return;

        // Track existing forms
        this.trackAllForms();

        // Watch for dynamically added forms
        if (typeof MutationObserver !== 'undefined') {
            this.observer = new MutationObserver(() => this.trackAllForms());
            this.observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    destroy(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        super.destroy();
    }

    private trackAllForms(): void {
        document.querySelectorAll('form').forEach((form) => {
            this.setupFormTracking(form as HTMLFormElement);
        });
    }

    private setupFormTracking(form: HTMLFormElement): void {
        if (this.trackedForms.has(form)) return;
        this.trackedForms.add(form);

        const formId = form.id || form.name || `form-${Math.random().toString(36).substr(2, 9)}`;

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
                    field.addEventListener(eventType, () => {
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
                    });
                });
            }
        });

        // Track form submission
        form.addEventListener('submit', () => {
            this.track('form_submit', 'Form Submitted', {
                formId,
                action: form.action,
                method: form.method,
            });

            // Auto-identify if email field found
            this.autoIdentify(form);
        });
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
