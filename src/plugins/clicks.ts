/**
 * MorrisB Tracking SDK - Click Tracking Plugin
 * @version 3.0.0
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
        const target = e.target as Element;
        if (!target || !isTrackableClickElement(target)) return;

        const buttonText = getElementText(target, 100);
        const elementInfo = getElementInfo(target);

        this.track('button_click', 'Button Clicked', {
            buttonText,
            elementType: target.tagName.toLowerCase(),
            elementId: elementInfo.id,
            elementClass: elementInfo.className,
            href: (target as HTMLAnchorElement).href || undefined,
        });
    }
}
