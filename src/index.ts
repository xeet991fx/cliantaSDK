/**
 * Clianta SDK
 * Professional CRM and tracking SDK for lead generation
 * @see SDK_VERSION in core/config.ts
 */

import { Tracker } from './core/tracker';
import { CRMClient } from './core/crm';
import { ConsentManager } from './consent';
import { EventTriggersManager } from './core/triggers';
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
    Contact,
    Company,
    Opportunity,
    Pipeline,
    PipelineStage,
    Task,
    Activity,
    ApiResponse,
    PaginatedResponse,
    EventTrigger,
    TriggerEventType,
    TriggerAction,
    TriggerCondition,
    EmailAction,
    WebhookAction,
    TaskAction,
    ContactUpdateAction,
    EmailTemplate,
    TriggerExecution,
    VisitorProfile,
    VisitorActivity,
    VisitorTimeline,
    EngagementMetrics,
    VisitorActivityOptions,
    ContactTimelineOptions,
} from './types';

// Export consent types
export type { ConsentChangeCallback, ConsentManagerConfig, StoredConsent } from './consent';

// Export SDK version
export { SDK_VERSION } from './core/config';

// Export Tracker, CRM, Triggers, and Consent classes for direct use
export { Tracker, CRMClient, ConsentManager, EventTriggersManager };

// Export inbound event types from CRMClient
export type { InboundEventType, InboundEventPayload, InboundEventResult } from './core/crm';

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

// Attach to window for <script> usage
if (typeof window !== 'undefined') {
    (window as unknown as { clianta: typeof clianta }).clianta = clianta;
    (window as unknown as { Clianta: { clianta: typeof clianta; Tracker: typeof Tracker; CRMClient: typeof CRMClient; ConsentManager: typeof ConsentManager; EventTriggersManager: typeof EventTriggersManager } }).Clianta = {
        clianta,
        Tracker,
        CRMClient,
        ConsentManager,
        EventTriggersManager,
    };
}

// Default export
export default clianta;

