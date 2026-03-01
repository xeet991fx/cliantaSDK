/**
 * Clianta SDK
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
import type { CliantaConfig, TrackerCore } from './types';

// Export types
export type {
    CliantaConfig,
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

// Export Tracker and Consent classes for direct use
export { Tracker, ConsentManager };

// Global instance cache
let globalInstance: Tracker | null = null;

/**
 * Initialize or get the Clianta tracker instance
 * 
 * @example
 * // Simple initialization
 * const tracker = clianta('your-workspace-id');
 * 
 * @example
 * // With configuration
 * const tracker = clianta('your-workspace-id', {
 *   debug: true,
 *   plugins: ['pageView', 'forms', 'scroll'],
 * });
 * 
 * @example
 * // With consent configuration
 * const tracker = clianta('your-workspace-id', {
 *   consent: {
 *     waitForConsent: true,
 *     anonymousMode: true,
 *   },
 *   cookielessMode: true, // GDPR-friendly mode
 * });
 */
export function clianta(workspaceId: string, config?: CliantaConfig): TrackerCore {
    // Return existing instance if same workspace
    if (globalInstance && globalInstance.getWorkspaceId() === workspaceId) {
        return globalInstance;
    }

    // Destroy existing instance if workspace changed
    if (globalInstance) {
        globalInstance.destroy();
    }

    // Create new instance
    globalInstance = new Tracker(workspaceId, config);
    return globalInstance;
}

// Attach to window for <script> tag usage + AUTO-INIT
if (typeof window !== 'undefined') {
    (window as unknown as { clianta: typeof clianta }).clianta = clianta;
    (window as unknown as { Clianta: { clianta: typeof clianta; Tracker: typeof Tracker; ConsentManager: typeof ConsentManager } }).Clianta = {
        clianta,
        Tracker,
        ConsentManager,
    };

    // ============================================
    // AUTO-INIT FROM SCRIPT TAG
    // ============================================
    // Enables true plug-and-play:
    //   <script src="clianta.min.js" data-project-id="YOUR_ID"></script>
    // That's it — everything auto-tracks.

    const autoInit = () => {
        const scripts = document.querySelectorAll('script[data-project-id]');
        const script = scripts[scripts.length - 1]; // last matching script
        if (!script) return;

        const projectId = script.getAttribute('data-project-id');
        if (!projectId) return;

        const debug = script.hasAttribute('data-debug');

        const instance = clianta(projectId, { debug });

        // Expose the auto-initialized instance globally
        (window as any).__clianta = instance;
    };

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
}

// Default export
export default clianta;
