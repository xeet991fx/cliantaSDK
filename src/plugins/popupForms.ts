/**
 * Clianta Tracking SDK - Popup Forms Plugin
 * @see SDK_VERSION in core/config.ts
 * 
 * Auto-loads and displays lead capture popups based on triggers
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

interface LeadFormField {
    name: string;
    label: string;
    type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox';
    placeholder?: string;
    required: boolean;
    options?: string[];
}

interface LeadFormStyle {
    position: string;
    theme: string;
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderRadius: number;
    showOverlay: boolean;
}

interface LeadFormTrigger {
    type: 'delay' | 'scroll' | 'exit_intent' | 'click';
    value?: number;
    selector?: string;
}

interface LeadForm {
    _id: string;
    name: string;
    type: 'popup' | 'inline' | 'slide_in' | 'banner';
    fields: LeadFormField[];
    style: LeadFormStyle;
    trigger: LeadFormTrigger;
    headline?: string;
    subheadline?: string;
    submitButtonText?: string;
    successMessage?: string;
    redirectUrl?: string;
    showFrequency: string;
}

/**
 * Popup Forms Plugin - Fetches and displays lead capture forms
 */
export class PopupFormsPlugin extends BasePlugin {
    name: PluginName = 'popupForms';
    private forms: LeadForm[] = [];
    private shownForms: Set<string> = new Set();
    private scrollHandler: (() => void) | null = null;
    private exitHandler: ((e: MouseEvent) => void) | null = null;

    async init(tracker: TrackerCore): Promise<void> {
        super.init(tracker);

        if (typeof window === 'undefined') return;

        // Load shown forms from storage
        this.loadShownForms();

        // Fetch active forms
        await this.fetchForms();

        // Setup triggers
        this.setupTriggers();
    }

    destroy(): void {
        this.removeTriggers();
        super.destroy();
    }

    private loadShownForms(): void {
        try {
            const stored = localStorage.getItem('clianta_shown_forms');
            if (stored) {
                const data = JSON.parse(stored);
                this.shownForms = new Set(data.forms || []);
            }
        } catch (e) {
            // Ignore storage errors
        }
    }

    private saveShownForms(): void {
        try {
            localStorage.setItem('clianta_shown_forms', JSON.stringify({
                forms: Array.from(this.shownForms),
                timestamp: Date.now(),
            }));
        } catch (e) {
            // Ignore storage errors
        }
    }

    private async fetchForms(): Promise<void> {
        if (!this.tracker) return;

        const config = this.tracker.getConfig();
        const workspaceId = this.tracker.getWorkspaceId();
        const apiEndpoint = config.apiEndpoint || 'https://api.clianta.online';

        try {
            const url = encodeURIComponent(window.location.href);
            const response = await fetch(
                `${apiEndpoint}/api/public/lead-forms/${workspaceId}?url=${url}`
            );

            if (!response.ok) return;

            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                this.forms = data.data.filter((form: LeadForm) =>
                    this.shouldShowForm(form)
                );
            }
        } catch (error) {
            console.error('[Clianta] Failed to fetch forms:', error);
        }
    }

    private shouldShowForm(form: LeadForm): boolean {
        // Check show frequency
        if (form.showFrequency === 'once_per_visitor') {
            if (this.shownForms.has(form._id)) return false;
        } else if (form.showFrequency === 'once_per_session') {
            const sessionKey = `clianta_form_${form._id}_shown`;
            if (sessionStorage.getItem(sessionKey)) return false;
        }
        return true;
    }

    private setupTriggers(): void {
        this.forms.forEach(form => {
            switch (form.trigger.type) {
                case 'delay':
                    setTimeout(() => this.showForm(form), (form.trigger.value || 5) * 1000);
                    break;
                case 'scroll':
                    this.setupScrollTrigger(form);
                    break;
                case 'exit_intent':
                    this.setupExitIntentTrigger(form);
                    break;
                case 'click':
                    this.setupClickTrigger(form);
                    break;
            }
        });
    }

    private setupScrollTrigger(form: LeadForm): void {
        const threshold = form.trigger.value || 50;

        this.scrollHandler = () => {
            const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            if (scrollPercent >= threshold) {
                this.showForm(form);
                if (this.scrollHandler) {
                    window.removeEventListener('scroll', this.scrollHandler);
                }
            }
        };

        window.addEventListener('scroll', this.scrollHandler, { passive: true });
    }

    private setupExitIntentTrigger(form: LeadForm): void {
        this.exitHandler = (e: MouseEvent) => {
            if (e.clientY <= 0) {
                this.showForm(form);
                if (this.exitHandler) {
                    document.removeEventListener('mouseout', this.exitHandler);
                }
            }
        };

        document.addEventListener('mouseout', this.exitHandler);
    }

    private setupClickTrigger(form: LeadForm): void {
        if (!form.trigger.selector) return;

        const elements = document.querySelectorAll(form.trigger.selector);
        elements.forEach(el => {
            el.addEventListener('click', () => this.showForm(form));
        });
    }

    private removeTriggers(): void {
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
        }
        if (this.exitHandler) {
            document.removeEventListener('mouseout', this.exitHandler);
        }
    }

    private async showForm(form: LeadForm): Promise<void> {
        // Check if already shown in this session
        if (!this.shouldShowForm(form)) return;

        // Mark as shown
        this.shownForms.add(form._id);
        this.saveShownForms();
        sessionStorage.setItem(`clianta_form_${form._id}_shown`, 'true');

        // Track view
        await this.trackFormView(form._id);

        // Render form
        this.renderForm(form);
    }

    private async trackFormView(formId: string): Promise<void> {
        if (!this.tracker) return;

        const config = this.tracker.getConfig();
        const apiEndpoint = config.apiEndpoint || 'https://api.clianta.online';

        try {
            await fetch(`${apiEndpoint}/api/public/lead-forms/${formId}/view`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (e) {
            // Ignore tracking errors
        }
    }

    private renderForm(form: LeadForm): void {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = `clianta-form-overlay-${form._id}`;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // Create form container
        const container = document.createElement('div');
        container.id = `clianta-form-${form._id}`;

        const style = form.style || {};
        container.style.cssText = `
            background: ${style.backgroundColor || '#FFFFFF'};
            border-radius: ${style.borderRadius || 12}px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            transform: translateY(20px);
            opacity: 0;
            transition: all 0.3s ease;
        `;

        // Build form using safe DOM APIs (no innerHTML for user content)
        this.buildFormDOM(form, container);

        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            container.style.transform = 'translateY(0)';
            container.style.opacity = '1';
        });

        // Setup event listeners
        this.setupFormEvents(form, overlay, container);
    }

    /**
     * Escape HTML to prevent XSS - used only for static structure
     */
    private escapeHTML(str: string): string {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Build form using safe DOM APIs (prevents XSS)
     */
    private buildFormDOM(form: LeadForm, container: HTMLElement): void {
        const style = form.style || {};
        const primaryColor = style.primaryColor || '#10B981';
        const textColor = style.textColor || '#18181B';

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.id = 'clianta-form-close';
        closeBtn.style.cssText = `
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #71717A;
            padding: 4px;
        `;
        closeBtn.textContent = '×';
        container.appendChild(closeBtn);

        // Headline
        const headline = document.createElement('h2');
        headline.style.cssText = `font-size: 20px; font-weight: 700; margin-bottom: 8px; color: ${this.escapeHTML(textColor)};`;
        headline.textContent = form.headline || 'Stay in touch';
        container.appendChild(headline);

        // Subheadline
        const subheadline = document.createElement('p');
        subheadline.style.cssText = 'font-size: 14px; color: #71717A; margin-bottom: 16px;';
        subheadline.textContent = form.subheadline || 'Get the latest updates';
        container.appendChild(subheadline);

        // Form element
        const formElement = document.createElement('form');
        formElement.id = 'clianta-form-element';

        // Build fields
        form.fields.forEach(field => {
            const fieldWrapper = document.createElement('div');
            fieldWrapper.style.marginBottom = '12px';

            if (field.type === 'checkbox') {
                // Checkbox layout
                const label = document.createElement('label');
                label.style.cssText = `display: flex; align-items: center; gap: 8px; font-size: 14px; color: ${this.escapeHTML(textColor)}; cursor: pointer;`;

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = field.name;
                if (field.required) input.required = true;
                input.style.cssText = 'width: 16px; height: 16px;';

                label.appendChild(input);

                const labelText = document.createTextNode(field.label + ' ');
                label.appendChild(labelText);

                if (field.required) {
                    const requiredMark = document.createElement('span');
                    requiredMark.style.color = '#EF4444';
                    requiredMark.textContent = '*';
                    label.appendChild(requiredMark);
                }

                fieldWrapper.appendChild(label);
            } else {
                // Label
                const label = document.createElement('label');
                label.style.cssText = `display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: ${this.escapeHTML(textColor)};`;
                label.textContent = field.label + ' ';

                if (field.required) {
                    const requiredMark = document.createElement('span');
                    requiredMark.style.color = '#EF4444';
                    requiredMark.textContent = '*';
                    label.appendChild(requiredMark);
                }

                fieldWrapper.appendChild(label);

                // Input/Textarea
                if (field.type === 'textarea') {
                    const textarea = document.createElement('textarea');
                    textarea.name = field.name;
                    if (field.placeholder) textarea.placeholder = field.placeholder;
                    if (field.required) textarea.required = true;
                    textarea.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #E4E4E7; border-radius: 6px; font-size: 14px; resize: vertical; min-height: 80px; box-sizing: border-box;';
                    fieldWrapper.appendChild(textarea);
                } else {
                    const input = document.createElement('input');
                    input.type = field.type;
                    input.name = field.name;
                    if (field.placeholder) input.placeholder = field.placeholder;
                    if (field.required) input.required = true;
                    input.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #E4E4E7; border-radius: 6px; font-size: 14px; box-sizing: border-box;';
                    fieldWrapper.appendChild(input);
                }
            }

            formElement.appendChild(fieldWrapper);
        });

        // Submit button
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.style.cssText = `
            width: 100%;
            padding: 10px 16px;
            background: ${this.escapeHTML(primaryColor)};
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            margin-top: 8px;
        `;
        submitBtn.textContent = form.submitButtonText || 'Subscribe';
        formElement.appendChild(submitBtn);

        container.appendChild(formElement);
    }

    private buildFormHTML(form: LeadForm): string {
        const style = form.style || {};
        const primaryColor = style.primaryColor || '#10B981';
        const textColor = style.textColor || '#18181B';

        let fieldsHTML = form.fields.map(field => {
            const requiredMark = field.required ? '<span style="color: #EF4444;">*</span>' : '';

            if (field.type === 'textarea') {
                return `
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: ${textColor};">
                            ${field.label} ${requiredMark}
                        </label>
                        <textarea
                            name="${field.name}"
                            placeholder="${field.placeholder || ''}"
                            ${field.required ? 'required' : ''}
                            style="width: 100%; padding: 8px 12px; border: 1px solid #E4E4E7; border-radius: 6px; font-size: 14px; resize: vertical; min-height: 80px;"
                        ></textarea>
                    </div>
                `;
            } else if (field.type === 'checkbox') {
                return `
                    <div style="margin-bottom: 12px;">
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: ${textColor}; cursor: pointer;">
                            <input
                                type="checkbox"
                                name="${field.name}"
                                ${field.required ? 'required' : ''}
                                style="width: 16px; height: 16px;"
                            />
                            ${field.label} ${requiredMark}
                        </label>
                    </div>
                `;
            } else {
                return `
                    <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: ${textColor};">
                            ${field.label} ${requiredMark}
                        </label>
                        <input
                            type="${field.type}"
                            name="${field.name}"
                            placeholder="${field.placeholder || ''}"
                            ${field.required ? 'required' : ''}
                            style="width: 100%; padding: 8px 12px; border: 1px solid #E4E4E7; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
                        />
                    </div>
                `;
            }
        }).join('');

        return `
            <button id="clianta-form-close" style="
                position: absolute;
                top: 12px;
                right: 12px;
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #71717A;
                padding: 4px;
            ">&times;</button>
            <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: ${textColor};">
                ${form.headline || 'Stay in touch'}
            </h2>
            <p style="font-size: 14px; color: #71717A; margin-bottom: 16px;">
                ${form.subheadline || 'Get the latest updates'}
            </p>
            <form id="clianta-form-element">
                ${fieldsHTML}
                <button type="submit" style="
                    width: 100%;
                    padding: 10px 16px;
                    background: ${primaryColor};
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    margin-top: 8px;
                ">
                    ${form.submitButtonText || 'Subscribe'}
                </button>
            </form>
        `;
    }

    private setupFormEvents(form: LeadForm, overlay: HTMLElement, container: HTMLElement): void {
        // Close button
        const closeBtn = container.querySelector('#clianta-form-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeForm(form._id, overlay, container));
        }

        // Overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeForm(form._id, overlay, container);
            }
        });

        // Form submit
        const formElement = container.querySelector('#clianta-form-element') as HTMLFormElement;
        if (formElement) {
            formElement.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSubmit(form, formElement, container);
            });
        }
    }

    private closeForm(formId: string, overlay: HTMLElement, container: HTMLElement): void {
        container.style.transform = 'translateY(20px)';
        container.style.opacity = '0';
        overlay.style.opacity = '0';

        setTimeout(() => {
            overlay.remove();
        }, 300);
    }

    private async handleSubmit(form: LeadForm, formElement: HTMLFormElement, container: HTMLElement): Promise<void> {
        if (!this.tracker) return;

        const config = this.tracker.getConfig();
        const apiEndpoint = config.apiEndpoint || 'https://api.clianta.online';
        const visitorId = this.tracker.getVisitorId();

        // Collect form data
        const formData = new FormData(formElement);
        const data: Record<string, any> = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        // Disable submit button
        const submitBtn = formElement.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Submitting...';
        }

        try {
            const response = await fetch(`${apiEndpoint}/api/public/lead-forms/${form._id}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitorId,
                    data,
                    url: window.location.href,
                }),
            });

            const result = await response.json();

            if (result.success) {
                // Show success message using safe DOM APIs
                container.innerHTML = '';
                
                const successWrapper = document.createElement('div');
                successWrapper.style.cssText = 'text-align: center; padding: 20px;';
                
                const iconWrapper = document.createElement('div');
                iconWrapper.style.cssText = 'width: 48px; height: 48px; background: #10B981; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;';
                
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '24');
                svg.setAttribute('height', '24');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'white');
                svg.setAttribute('stroke-width', '2');
                
                const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                polyline.setAttribute('points', '20 6 9 17 4 12');
                svg.appendChild(polyline);
                iconWrapper.appendChild(svg);
                
                const message = document.createElement('p');
                message.style.cssText = 'font-size: 16px; font-weight: 500; color: #18181B;';
                message.textContent = form.successMessage || 'Thank you!';
                
                successWrapper.appendChild(iconWrapper);
                successWrapper.appendChild(message);
                container.appendChild(successWrapper);

                // Track identify
                if (data.email) {
                    this.tracker?.identify(data.email, data);
                }

                // Redirect if configured
                if (form.redirectUrl) {
                    setTimeout(() => {
                        window.location.href = form.redirectUrl!;
                    }, 1500);
                }

                // Close after delay
                setTimeout(() => {
                    const overlay = document.getElementById(`clianta-form-overlay-${form._id}`);
                    if (overlay) {
                        this.closeForm(form._id, overlay, container);
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('[Clianta] Form submit error:', error);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = form.submitButtonText || 'Subscribe';
            }
        }
    }
}
