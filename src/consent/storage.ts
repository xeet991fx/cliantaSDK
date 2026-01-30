/**
 * Clianta SDK - Consent Storage
 * Handles persistence of consent state
 * @see SDK_VERSION in core/config.ts
 */

import type { ConsentState } from '../types';
import { STORAGE_KEYS } from '../core/config';

export interface StoredConsent {
    state: ConsentState;
    timestamp: number;
    version: number;
}

const CONSENT_VERSION = 1;

/**
 * Save consent state to storage
 */
export function saveConsent(state: ConsentState): boolean {
    try {
        if (typeof localStorage === 'undefined') return false;

        const stored: StoredConsent = {
            state,
            timestamp: Date.now(),
            version: CONSENT_VERSION,
        };

        localStorage.setItem(STORAGE_KEYS.CONSENT, JSON.stringify(stored));
        return true;
    } catch {
        return false;
    }
}

/**
 * Load consent state from storage
 */
export function loadConsent(): StoredConsent | null {
    try {
        if (typeof localStorage === 'undefined') return null;

        const stored = localStorage.getItem(STORAGE_KEYS.CONSENT);
        if (!stored) return null;

        const parsed = JSON.parse(stored) as StoredConsent;

        // Validate version
        if (parsed.version !== CONSENT_VERSION) {
            clearConsent();
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

/**
 * Clear consent state from storage
 */
export function clearConsent(): boolean {
    try {
        if (typeof localStorage === 'undefined') return false;
        localStorage.removeItem(STORAGE_KEYS.CONSENT);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if consent has been explicitly set
 */
export function hasStoredConsent(): boolean {
    return loadConsent() !== null;
}

/**
 * Get the timestamp when consent was given
 */
export function getConsentTimestamp(): number | null {
    const stored = loadConsent();
    return stored?.timestamp ?? null;
}
