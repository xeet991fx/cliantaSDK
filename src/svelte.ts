/**
 * Clianta SDK - Svelte Integration
 *
 * Provides helpers for Svelte 4+ and Svelte 5 (SvelteKit) integration.
 * Uses a store-based pattern that works with Svelte's reactivity system.
 *
 * @example
 * // In +layout.svelte or root component:
 * <script>
 *   import { initClianta } from '@clianta/sdk/svelte';
 *   import { setContext } from 'svelte';
 *
 *   const cliantaStore = initClianta({
 *     projectId: 'your-project-id',
 *   });
 *
 *   setContext('clianta', cliantaStore);
 * </script>
 *
 * // In child components:
 * <script>
 *   import { getContext } from 'svelte';
 *   const clianta = getContext('clianta');
 *
 *   function handleClick() {
 *     clianta.track('button_click', 'CTA', { page: 'home' });
 *   }
 * </script>
 */

import { clianta } from './index';
import type { CliantaConfig, TrackerCore, UserTraits, ConsentState } from './types';

export interface CliantaSvelteConfig extends CliantaConfig {
    /** Project/workspace ID (required) */
    projectId: string;
}

export interface CliantaStore {
    /** The underlying tracker instance */
    readonly tracker: TrackerCore | null;

    /** Track a custom event */
    track(eventType: string, eventName: string, properties?: Record<string, unknown>): void;

    /** Identify a visitor by email */
    identify(email: string, traits?: UserTraits): Promise<string | null>;

    /** Track a page view */
    page(name?: string, properties?: Record<string, unknown>): void;

    /** Update consent state */
    consent(state: ConsentState): void;

    /** Get visitor ID */
    getVisitorId(): string | undefined;

    /** Get session ID */
    getSessionId(): string | undefined;

    /** Force flush events */
    flush(): Promise<void>;

    /** Reset visitor data (for logout) */
    reset(): void;

    /** Clean up tracker */
    destroy(): void;
}

/**
 * Initialize Clianta tracker and return a store-like object.
 *
 * Use with Svelte's context API:
 * ```svelte
 * <script>
 *   import { initClianta } from '@clianta/sdk/svelte';
 *   import { setContext } from 'svelte';
 *
 *   const clianta = initClianta({ projectId: 'xxx' });
 *   setContext('clianta', clianta);
 * </script>
 * ```
 *
 * @param config - Configuration including projectId
 * @returns CliantaStore with tracker methods
 */
export function initClianta(config: CliantaSvelteConfig): CliantaStore {
    if (!config.projectId) {
        console.error('[Clianta] Missing projectId in Svelte config');
        return createNullStore();
    }

    const { projectId, ...options } = config;
    const tracker = clianta(projectId, options);

    return {
        get tracker() { return tracker; },

        track(eventType: string, eventName: string, properties?: Record<string, unknown>) {
            tracker.track(eventType, eventName, properties);
        },

        identify(email: string, traits?: UserTraits) {
            return tracker.identify(email, traits);
        },

        page(name?: string, properties?: Record<string, unknown>) {
            tracker.page(name, properties);
        },

        consent(state: ConsentState) {
            tracker.consent(state);
        },

        getVisitorId() {
            return tracker.getVisitorId();
        },

        getSessionId() {
            return tracker.getSessionId();
        },

        async flush() {
            await tracker.flush();
        },

        reset() {
            tracker.reset();
        },

        async destroy() {
            await tracker.destroy();
        },
    };
}

/**
 * Create a null store for when initialization fails
 */
function createNullStore(): CliantaStore {
    return {
        get tracker() { return null; },
        track() { },
        identify() { return Promise.resolve(null); },
        page() { },
        consent() { },
        getVisitorId() { return undefined; },
        getSessionId() { return undefined; },
        flush() { return Promise.resolve(); },
        reset() { },
        destroy() { },
    };
}

/**
 * Svelte action for tracking element clicks.
 *
 * @example
 * <button use:trackClick={{ eventName: 'CTA Clicked', properties: { page: 'home' } }}>
 *   Click Me
 * </button>
 *
 * @param node - The DOM element
 * @param params - Track parameters including tracker store, event name, and optional properties
 */
export function trackClick(
    node: HTMLElement,
    params: {
        store: CliantaStore;
        eventName: string;
        properties?: Record<string, unknown>;
    }
) {
    function handleClick() {
        params.store.track('button_click', params.eventName, params.properties);
    }

    node.addEventListener('click', handleClick);

    return {
        update(newParams: typeof params) {
            params = newParams;
        },
        destroy() {
            node.removeEventListener('click', handleClick);
        },
    };
}

// Re-export types for convenience
export type { CliantaConfig, TrackerCore };
