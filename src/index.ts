/**
 * Clianta SDK
 * Professional CRM and tracking SDK for lead generation
 * @version 1.0.0
 */

import { Tracker } from './core/tracker';
import { CRMClient } from './core/crm';
import type { MorrisBConfig, TrackerCore } from './types';

// Export types
export type {
    MorrisBConfig,
    TrackerCore,
    TrackingEvent,
    EventType,
    UserTraits,
    ConsentState,
    ConsentConfig,
    Plugin,
    PluginName,
    Contact,
    Opportunity,
    ApiResponse,
    PaginatedResponse,
} from './types';

// Export SDK version
export { SDK_VERSION } from './core/config';

// Export Tracker and CRM classes for direct use
export { Tracker, CRMClient };

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
 */
export function clianta(workspaceId: string, config?: MorrisBConfig): TrackerCore {
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

// Attach to window for <script> usage
if (typeof window !== 'undefined') {
    (window as unknown as { clianta: typeof clianta }).clianta = clianta;
    (window as unknown as { Clianta: { clianta: typeof clianta; Tracker: typeof Tracker; CRMClient: typeof CRMClient } }).Clianta = {
        clianta,
        Tracker,
        CRMClient,
    };
}

// Default export
export default clianta;
