/**
 * Clianta SDK - Angular Integration
 *
 * Provides helpers for Angular 16+ integration.
 * Since Angular uses decorators and DI that require @angular/core as a dependency,
 * this module provides a factory pattern that Angular users wrap in their own service.
 *
 * @example
 * // In your Angular service:
 * import { Injectable, OnDestroy } from '@angular/core';
 * import { createCliantaTracker, type CliantaTrackerInstance } from '@clianta/sdk/angular';
 *
 * @Injectable({ providedIn: 'root' })
 * export class CliantaService implements OnDestroy {
 *   private instance: CliantaTrackerInstance;
 *
 *   constructor() {
 *     this.instance = createCliantaTracker({
 *       projectId: environment.cliantaProjectId,
 *       apiEndpoint: environment.cliantaApiEndpoint,
 *       debug: !environment.production,
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

import { clianta } from './index';
import type { CliantaConfig, TrackerCore } from './types';

export interface CliantaTrackerInstance {
    /** The tracker instance (null if projectId was missing) */
    tracker: TrackerCore | null;
    /** Flush pending events and clean up */
    destroy: () => void;
}

export interface CliantaAngularConfig extends CliantaConfig {
    /** Project/workspace ID (required) */
    projectId: string;
}

/**
 * Create a Clianta tracker instance for use in Angular services.
 *
 * @param config - Configuration including projectId
 * @returns Object with tracker instance and destroy method
 *
 * @example
 * const instance = createCliantaTracker({
 *   projectId: 'your-project-id',
 *   apiEndpoint: environment.cliantaApiEndpoint || 'http://localhost:5000',
 * });
 *
 * instance.tracker?.track('page_view', 'Home Page');
 * // On cleanup:
 * instance.destroy();
 */
export function createCliantaTracker(config: CliantaAngularConfig): CliantaTrackerInstance {
    if (!config.projectId) {
        console.error('[Clianta] Missing projectId in Angular config');
        return { tracker: null, destroy: () => {} };
    }

    const { projectId, ...options } = config;
    const tracker = clianta(projectId, options);

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
export type { CliantaConfig, TrackerCore };
