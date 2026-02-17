import { Plugin, Ref } from 'vue';

/**
 * Clianta SDK - Type Definitions
 * @see SDK_VERSION in core/config.ts
 */
interface CliantaConfig {
    /** Project ID (required for config file pattern) */
    projectId?: string;
    /** Backend API endpoint URL */
    apiEndpoint?: string;
    /** Auth token for server-side API access */
    authToken?: string;
    /** Enable debug mode with verbose logging */
    debug?: boolean;
    /** Automatically track page views on load and navigation */
    autoPageView?: boolean;
    /** Plugins to enable (default: all core plugins) */
    plugins?: PluginName[];
    /** Session timeout in milliseconds (default: 30 minutes) */
    sessionTimeout?: number;
    /** Maximum events to batch before sending (default: 10) */
    batchSize?: number;
    /** Interval to flush events in milliseconds (default: 5000) */
    flushInterval?: number;
    /** Consent configuration */
    consent?: ConsentConfig;
    /** Cookie domain for cross-subdomain tracking */
    cookieDomain?: string;
    /** Use cookies instead of localStorage for visitor ID */
    useCookies?: boolean;
    /** Cookie-less mode: use sessionStorage only (no persistent storage) */
    cookielessMode?: boolean;
}
type PluginName = 'pageView' | 'forms' | 'scroll' | 'clicks' | 'engagement' | 'downloads' | 'exitIntent' | 'errors' | 'performance' | 'popupForms';
interface ConsentConfig {
    /** Default consent state before user action */
    defaultConsent?: ConsentState;
    /** Wait for consent before tracking anything */
    waitForConsent?: boolean;
    /** Storage key for consent state */
    storageKey?: string;
    /** Anonymous mode: track without visitor ID until explicit consent */
    anonymousMode?: boolean;
}
interface ConsentState {
    /** Consent for analytics/essential tracking */
    analytics?: boolean;
    /** Consent for marketing/advertising tracking */
    marketing?: boolean;
    /** Consent for personalization */
    personalization?: boolean;
}
type EventType = 'page_view' | 'button_click' | 'form_view' | 'form_submit' | 'form_interaction' | 'scroll_depth' | 'engagement' | 'download' | 'exit_intent' | 'error' | 'performance' | 'time_on_page' | 'custom';
interface UserTraits {
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
    title?: string;
    [key: string]: unknown;
}
interface TrackerCore {
    /** Track a custom event */
    track(eventType: EventType | string, eventName: string, properties?: Record<string, unknown>): void;
    /** Identify a visitor */
    identify(email: string, traits?: UserTraits): void;
    /** Track a page view */
    page(name?: string, properties?: Record<string, unknown>): void;
    /** Update consent state */
    consent(state: ConsentState): void;
    /** Toggle debug mode */
    debug(enabled: boolean): void;
    /** Get visitor ID */
    getVisitorId(): string;
    /** Get session ID */
    getSessionId(): string;
    /** Force flush event queue */
    flush(): Promise<void>;
    /** Reset visitor (for logout) */
    reset(): void;
    /** Get current configuration */
    getConfig(): CliantaConfig;
    /** Get workspace ID */
    getWorkspaceId(): string;
    /** Delete all stored user data (GDPR right-to-erasure) */
    deleteData(): void;
    /** Get current consent state */
    getConsentState(): ConsentState;
}

/**
 * Clianta SDK - Vue 3 Integration
 *
 * Provides plugin and composables for easy Vue 3 integration.
 */

interface CliantaPluginOptions extends CliantaConfig {
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
declare const CliantaPlugin: Plugin<CliantaPluginOptions>;
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
declare function useClianta(): Ref<TrackerCore | null>;
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
declare function useCliantaTrack(): (eventType: string, eventName: string, properties?: Record<string, unknown>) => void;
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
declare function useCliantaIdentify(): (email: string, traits?: Record<string, unknown>) => any;
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
declare function useCliantaPageView(): (name?: string, properties?: Record<string, unknown>) => void;
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
declare function useCliantaConsent(): {
    consent: (state: {
        analytics?: boolean;
        marketing?: boolean;
        personalization?: boolean;
    }) => void;
    getConsentState: () => any;
};

declare module 'vue' {
    interface ComponentCustomProperties {
        $clianta: TrackerCore;
    }
}

export { CliantaPlugin, useClianta, useCliantaConsent, useCliantaIdentify, useCliantaPageView, useCliantaTrack };
export type { CliantaConfig, CliantaPluginOptions, TrackerCore };
