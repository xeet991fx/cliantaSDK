/**
 * Clianta SDK - Plugin Base
 * @see SDK_VERSION in core/config.ts
 */

import type { Plugin, PluginName, TrackerCore } from '../types';

/**
 * Base class for plugins
 */
export abstract class BasePlugin implements Plugin {
    abstract name: PluginName;
    protected tracker: TrackerCore | null = null;

    init(tracker: TrackerCore): void {
        this.tracker = tracker;
    }

    destroy(): void {
        this.tracker = null;
    }

    protected track(
        eventType: string,
        eventName: string,
        properties?: Record<string, unknown>
    ): void {
        if (this.tracker) {
            this.tracker.track(eventType, eventName, properties);
        }
    }
}
