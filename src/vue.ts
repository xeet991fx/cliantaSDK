/**
 * Clianta SDK - Vue 3 Integration
 *
 * Provides plugin and composables for easy Vue 3 integration.
 */

import {
    inject,
    provide,
    ref,
    onMounted,
    onUnmounted,
    type InjectionKey,
    type Plugin,
    type App,
    type Ref,
} from 'vue';
import { clianta } from './index';
import type { CliantaConfig, TrackerCore } from './types';

// Injection key for tracker
const CliantaKey: InjectionKey<Ref<TrackerCore | null>> = Symbol('clianta');

export interface CliantaPluginOptions extends CliantaConfig {
    /** Project ID (required) */
    projectId: string;
}

/**
 * Vue plugin for Clianta SDK
 *
 * @example
 * // In main.ts:
 * import { createApp } from 'vue';
 * import { CliantaPlugin } from '@clianta/sdk/vue';
 * import App from './App.vue';
 *
 * const app = createApp(App);
 * app.use(CliantaPlugin, {
 *   projectId: 'your-project-id',
 *   apiEndpoint: 'https://api.clianta.online',
 *   debug: import.meta.env.DEV,
 * });
 * app.mount('#app');
 */
export const CliantaPlugin: Plugin<CliantaPluginOptions> = {
    install(app: App, options: CliantaPluginOptions) {
        if (!options?.projectId) {
            console.error('[Clianta] Missing projectId in plugin options');
            return;
        }

        const { projectId, ...config } = options;
        const tracker = clianta(projectId, config);

        // Provide tracker to all components
        app.provide(CliantaKey, ref(tracker));

        // Add global property for Options API access
        app.config.globalProperties.$clianta = tracker;

        // Flush on app unmount
        app.mixin({
            beforeUnmount() {
                // Only flush on root component unmount
                if (this.$.parent === null) {
                    tracker.flush();
                }
            },
        });
    },
};

/**
 * useClianta - Composable to access tracker
 *
 * @example
 * <script setup>
 * import { useClianta } from '@clianta/sdk/vue';
 *
 * const tracker = useClianta();
 * tracker.value?.track('button_click', 'CTA Button');
 * </script>
 */
export function useClianta(): Ref<TrackerCore | null> {
    const tracker = inject(CliantaKey);
    if (!tracker) {
        console.warn('[Clianta] useClianta must be used within a component where CliantaPlugin is installed');
        return ref(null) as Ref<TrackerCore | null>;
    }
    return tracker;
}

/**
 * useCliantaTrack - Composable for tracking events
 *
 * @example
 * <script setup>
 * import { useCliantaTrack } from '@clianta/sdk/vue';
 *
 * const track = useCliantaTrack();
 * track('purchase', 'Order Completed', { orderId: '123' });
 * </script>
 */
export function useCliantaTrack() {
    const tracker = useClianta();
    return (
        eventType: string,
        eventName: string,
        properties?: Record<string, unknown>
    ) => {
        tracker.value?.track(eventType, eventName, properties);
    };
}

/**
 * useCliantaIdentify - Composable for identifying users
 *
 * @example
 * <script setup>
 * import { useCliantaIdentify } from '@clianta/sdk/vue';
 *
 * const identify = useCliantaIdentify();
 * identify('user@example.com', { name: 'John' });
 * </script>
 */
export function useCliantaIdentify() {
    const tracker = useClianta();
    return (email: string, traits?: Record<string, unknown>) => {
        return tracker.value?.identify(email, traits);
    };
}

/**
 * useCliantaPageView - Composable for manual page view tracking
 *
 * @example
 * <script setup>
 * import { useCliantaPageView } from '@clianta/sdk/vue';
 * import { watch } from 'vue';
 * import { useRoute } from 'vue-router';
 *
 * const route = useRoute();
 * const trackPageView = useCliantaPageView();
 *
 * watch(() => route.path, () => {
 *   trackPageView(route.name?.toString());
 * });
 * </script>
 */
export function useCliantaPageView() {
    const tracker = useClianta();
    return (name?: string, properties?: Record<string, unknown>) => {
        tracker.value?.page(name, properties);
    };
}

/**
 * useCliantaConsent - Composable for managing consent
 *
 * @example
 * <script setup>
 * import { useCliantaConsent } from '@clianta/sdk/vue';
 *
 * const { consent, getConsentState } = useCliantaConsent();
 * consent({ analytics: true, marketing: false });
 * </script>
 */
export function useCliantaConsent() {
    const tracker = useClianta();
    return {
        consent: (state: { analytics?: boolean; marketing?: boolean; personalization?: boolean }) => {
            tracker.value?.consent(state);
        },
        getConsentState: () => tracker.value?.getConsentState(),
    };
}

// Re-export types for convenience
export type { CliantaConfig, TrackerCore };

// Augment Vue types for Options API
declare module 'vue' {
    interface ComponentCustomProperties {
        $clianta: TrackerCore;
    }
}
