/**
 * Eutexa SDK - Angular Integration
 *
 * Provides helpers for Angular 16+ integration.
 * Since Angular uses decorators and DI that require @angular/core as a dependency,
 * this module provides a factory pattern that Angular users wrap in their own service.
 *
 * @example
 * // In your Angular service:
 * import { Injectable, OnDestroy } from '@angular/core';
 * import { createEutexaTracker, type EutexaTrackerInstance } from '@eutexa/sdk/angular';
 *
 * @Injectable({ providedIn: 'root' })
 * export class EutexaService implements OnDestroy {
 *   private instance: EutexaTrackerInstance;
 *
 *   constructor() {
 *     this.instance = createEutexaTracker({
 *       projectId: environment.eutexaProjectId,
 *     });
 *   }
 *
 *   get tracker() { return this.instance.tracker; }
 *
 *   track(eventType: string, eventName: string, properties?: Record<string, unknown>) {
 *     this.instance.tracker?.track(eventType, eventName, properties);
 *   }
 *
 *   identify(email: string, traits?: Record<string, unknown>) {
 *     return this.instance.tracker?.identify(email, traits);
 *   }
 *
 *   ngOnDestroy() {
 *     this.instance.destroy();
 *   }
 * }
 */

import { eutexa } from './index';
import type { EutexaConfig, TrackerCore } from './types';

export interface EutexaTrackerInstance {
    /** The tracker instance (null if projectId was missing) */
    tracker: TrackerCore | null;
    /** Flush pending events and clean up */
    destroy: () => void;
}

export interface EutexaAngularConfig extends EutexaConfig {
    /** Project/workspace ID (required) */
    projectId: string;
}

/**
 * Create a Eutexa tracker instance for use in Angular services.
 *
 * @param config - Configuration including projectId
 * @returns Object with tracker instance and destroy method
 *
 * @example
 * const instance = createEutexaTracker({
 *   projectId: 'your-project-id',
 * });
 *
 * instance.tracker?.track('page_view', 'Home Page');
 * // On cleanup:
 * instance.destroy();
 */
export function createEutexaTracker(config: EutexaAngularConfig): EutexaTrackerInstance {
    if (!config.projectId) {
        console.error('[Eutexa] Missing projectId in Angular config');
        return { tracker: null, destroy: () => { } };
    }

    const { projectId, ...options } = config;
    const tracker = eutexa(projectId, options);

    return {
        tracker,
        destroy: async () => {
            await tracker.destroy();
        },
    };
}

/**
 * Create a track function bound to a tracker instance.
 * Useful as a shorthand in Angular components.
 *
 * @example
 * const track = createTrackFn(instance.tracker);
 * track('button_click', 'CTA Button', { location: 'header' });
 */
export function createTrackFn(tracker: TrackerCore | null) {
    return (eventType: string, eventName: string, properties?: Record<string, unknown>) => {
        tracker?.track(eventType, eventName, properties);
    };
}

/**
 * Create an identify function bound to a tracker instance.
 *
 * @example
 * const identify = createIdentifyFn(instance.tracker);
 * identify('user@example.com', { firstName: 'John' });
 */
export function createIdentifyFn(tracker: TrackerCore | null) {
    return (email: string, traits?: Record<string, unknown>) => {
        return tracker?.identify(email, traits);
    };
}

// Re-export types for convenience
export type { EutexaConfig, TrackerCore };
