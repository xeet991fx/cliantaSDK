/**
 * Eutexa SDK - Vue 3 Integration
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
import { eutexa } from './index';
import type { EutexaConfig, TrackerCore } from './types';

// Injection key for tracker
const EutexaKey: InjectionKey<Ref<TrackerCore | null>> = Symbol('eutexa');

export interface EutexaPluginOptions extends EutexaConfig {
    /** Project ID (required) */
    projectId: string;
}

/**
 * Vue plugin for Eutexa SDK
 *
 * @example
 * // In main.ts:
 * import { createApp } from 'vue';
 * import { EutexaPlugin } from '@eutexa/sdk/vue';
 * import App from './App.vue';
 *
 * const app = createApp(App);
 * app.use(EutexaPlugin, {
 *   projectId: 'your-project-id',
 * });
 * app.mount('#app');
 */
export const EutexaPlugin: Plugin<EutexaPluginOptions> = {
    install(app: App, options: EutexaPluginOptions) {
        if (!options?.projectId) {
            console.error('[Eutexa] Missing projectId in plugin options');
            return;
        }

        const { projectId, ...config } = options;
        const tracker = eutexa(projectId, config);

        // Provide tracker to all components
        app.provide(EutexaKey, ref(tracker));

        // Add global property for Options API access
        app.config.globalProperties.$eutexa = tracker;

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
 * useEutexa - Composable to access tracker
 *
 * @example
 * <script setup>
 * import { useEutexa } from '@eutexa/sdk/vue';
 *
 * const tracker = useEutexa();
 * tracker.value?.track('button_click', 'CTA Button');
 * </script>
 */
export function useEutexa(): Ref<TrackerCore | null> {
    const tracker = inject(EutexaKey);
    if (!tracker) {
        console.warn('[Eutexa] useEutexa must be used within a component where EutexaPlugin is installed');
        return ref(null) as Ref<TrackerCore | null>;
    }
    return tracker;
}

/**
 * useEutexaTrack - Composable for tracking events
 *
 * @example
 * <script setup>
 * import { useEutexaTrack } from '@eutexa/sdk/vue';
 *
 * const track = useEutexaTrack();
 * track('purchase', 'Order Completed', { orderId: '123' });
 * </script>
 */
export function useEutexaTrack() {
    const tracker = useEutexa();
    return (
        eventType: string,
        eventName: string,
        properties?: Record<string, unknown>
    ) => {
        tracker.value?.track(eventType, eventName, properties);
    };
}

/**
 * useEutexaIdentify - Composable for identifying users
 *
 * @example
 * <script setup>
 * import { useEutexaIdentify } from '@eutexa/sdk/vue';
 *
 * const identify = useEutexaIdentify();
 * identify('user@example.com', { name: 'John' });
 * </script>
 */
export function useEutexaIdentify() {
    const tracker = useEutexa();
    return (email: string, traits?: Record<string, unknown>) => {
        return tracker.value?.identify(email, traits);
    };
}

/**
 * useEutexaPageView - Composable for manual page view tracking
 *
 * @example
 * <script setup>
 * import { useEutexaPageView } from '@eutexa/sdk/vue';
 * import { watch } from 'vue';
 * import { useRoute } from 'vue-router';
 *
 * const route = useRoute();
 * const trackPageView = useEutexaPageView();
 *
 * watch(() => route.path, () => {
 *   trackPageView(route.name?.toString());
 * });
 * </script>
 */
export function useEutexaPageView() {
    const tracker = useEutexa();
    return (name?: string, properties?: Record<string, unknown>) => {
        tracker.value?.page(name, properties);
    };
}

/**
 * useEutexaConsent - Composable for managing consent
 *
 * @example
 * <script setup>
 * import { useEutexaConsent } from '@eutexa/sdk/vue';
 *
 * const { consent, getConsentState } = useEutexaConsent();
 * consent({ analytics: true, marketing: false });
 * </script>
 */
export function useEutexaConsent() {
    const tracker = useEutexa();
    return {
        consent: (state: { analytics?: boolean; marketing?: boolean; personalization?: boolean }) => {
            tracker.value?.consent(state);
        },
        getConsentState: () => tracker.value?.getConsentState(),
    };
}

// Re-export types for convenience
export type { EutexaConfig, TrackerCore };

// Augment Vue types for Options API
declare module 'vue' {
    interface ComponentCustomProperties {
        $eutexa: TrackerCore;
    }
}
