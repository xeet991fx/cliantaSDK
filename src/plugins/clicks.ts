/**
 * Eutexa SDK - Click Tracking Plugin
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';
import { getElementText, getElementInfo, isTrackableClickElement } from '../utils';

/**
 * Click Tracking Plugin - Tracks button and CTA clicks
 */
export class ClicksPlugin extends BasePlugin {
    name: PluginName = 'clicks';
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
        // Walk up the DOM to find the nearest trackable ancestor.
        // Without this, clicks on <span> or <img> inside a <button> are silently dropped.
        let target: Element | null = e.target as Element;
        while (target && !isTrackableClickElement(target)) {
            target = target.parentElement;
        }
        if (!target) return;

        const buttonText = getElementText(target, 100);
        const elementInfo = getElementInfo(target);

        this.track('button_click', 'Button Clicked', {
            buttonText,
            elementType: target.tagName.toLowerCase(),
            elementId: elementInfo.id,
            elementClass: elementInfo.className,
            href: (target as HTMLAnchorElement).href || undefined,
            x: Math.round((e.clientX / window.innerWidth) * 100),
            y: Math.round((e.clientY / window.innerHeight) * 100),
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        });
    }
}
