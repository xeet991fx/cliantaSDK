/**
 * Clianta SDK - Consent Module
 * @see SDK_VERSION in core/config.ts
 */

export { ConsentManager } from './manager';
export type { ConsentChangeCallback, ConsentManagerConfig } from './manager';
export {
    saveConsent,
    loadConsent,
    clearConsent,
    hasStoredConsent,
    getConsentTimestamp,
} from './storage';
export type { StoredConsent } from './storage';
