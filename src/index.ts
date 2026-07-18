/**
 * Eutexa SDK
 * Client-side tracking SDK for CRM — tracks visitors, identifies contacts,
 * captures forms, and writes CRM data from client websites.
 * 
 * This SDK is designed to run on CLIENT WEBSITES (React, Next.js, Vue, etc.)
 * It only SENDS data to your CRM — it never reads CRM data back.
 * 
 * @see SDK_VERSION in core/config.ts
 */

import { Tracker } from './core/tracker';
import { ConsentManager } from './consent';
import type { EutexaConfig, TrackerCore } from './types';

// Export types
export type {
    EutexaConfig,
    TrackerCore,
    TrackingEvent,
    EventType,
    UserTraits,
    ConsentState,
    ConsentConfig,
    Plugin,
    PluginName,
    GroupTraits,
    MiddlewareFn,
    PublicContactData,
    PublicContactUpdate,
    PublicActivityData,
    PublicOpportunityData,
    PublicFormSubmission,
    PublicCrmResult,
} from './types';

// Export consent types
export type { ConsentChangeCallback, ConsentManagerConfig, StoredConsent } from './consent';

// Export SDK version
export { SDK_VERSION } from './core/config';

// Export Tracker, Consent, and CRM classes for direct use
export { Tracker, ConsentManager };
export { CRMClient } from './core/crm';
export type { InboundEventPayload, InboundEventResult, InboundEventType } from './core/crm';

// Global instance cache
let globalInstance: Tracker | null = null;

/**
 * Initialize or get the Eutexa tracker instance
 * 
 * @example
 * // Simple initialization
 * const tracker = eutexa('your-workspace-id');
 * 
 * @example
 * // With configuration
 * const tracker = eutexa('your-workspace-id', {
 *   debug: true,
 *   plugins: ['pageView', 'forms', 'scroll'],
 * });
 * 
 * @example
 * // With consent configuration
 * const tracker = eutexa('your-workspace-id', {
 *   consent: {
 *     waitForConsent: true,
 *     anonymousMode: true,
 *   },
 *   cookielessMode: true, // GDPR-friendly mode
 * });
 */
export function eutexa(workspaceId: string, config?: EutexaConfig): TrackerCore {
    // Return existing instance if same workspace and no config change
    if (globalInstance && globalInstance.getWorkspaceId() === workspaceId) {
        if (config && Object.keys(config).length > 0) {
            // Config was passed to an already-initialized instance — warn the developer
            // because the new config is ignored. They must call destroy() first to reconfigure.
            if (typeof console !== 'undefined') {
                console.warn(
                    '[Eutexa] eutexa() called with config on an already-initialized instance ' +
                    'for workspace "' + workspaceId + '". The new config was ignored. ' +
                    'Call tracker.destroy() first if you need to reconfigure.'
                );
            }
        }
        return globalInstance;
    }

    // Destroy existing instance if workspace changed (fire-and-forget flush, then destroy)
    if (globalInstance) {
        // Kick off async flush+destroy without blocking the new instance creation.
        // Using void to make the intentional fire-and-forget explicit.
        void globalInstance.destroy();
    }

    // Create new instance
    globalInstance = new Tracker(workspaceId, config);
    return globalInstance;
}

// Attach to window for <script> tag usage + AUTO-INIT
if (typeof window !== 'undefined') {
    (window as unknown as { eutexa: typeof eutexa }).eutexa = eutexa;
    (window as unknown as { Eutexa: { eutexa: typeof eutexa; Tracker: typeof Tracker; ConsentManager: typeof ConsentManager } }).Eutexa = {
        eutexa,
        Tracker,
        ConsentManager,
    };

    // ============================================
    // AUTO-INIT FROM SCRIPT TAG
    // ============================================
    // Enables true plug-and-play:
    //   <script src="eutexa.min.js" data-project-id="YOUR_ID"></script>
    // That's it — everything auto-tracks.

    const autoInit = () => {
        const scripts = document.querySelectorAll('script[data-project-id]');
        const script = scripts[scripts.length - 1]; // last matching script
        if (!script) return;

        const projectId = script.getAttribute('data-project-id');
        if (!projectId) return;

        const initConfig: EutexaConfig = {
            debug: script.hasAttribute('data-debug'),
        };

        // Support additional config via script tag attributes:
        //   data-api-endpoint="https://api.yourhost.com"
        //   data-cookieless  (boolean flag)
        //   data-use-cookies (boolean flag)
        const apiEndpoint = script.getAttribute('data-api-endpoint');
        if (apiEndpoint) initConfig.apiEndpoint = apiEndpoint;

        if (script.hasAttribute('data-cookieless')) initConfig.cookielessMode = true;
        if (script.hasAttribute('data-use-cookies')) initConfig.useCookies = true;

        const instance = eutexa(projectId, initConfig);

        // Expose the auto-initialized instance globally
        (window as any).__eutexa = instance;
    };

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
}

// Default export
export default eutexa;
