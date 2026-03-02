/**
 * Clianta SDK - Configuration
 * @see SDK_VERSION in core/config.ts
 */

import type { CliantaConfig, PluginName } from '../types';

/** SDK Version */
export const SDK_VERSION = '1.6.4';

/** Default API endpoint — reads from env or falls back to localhost */
export const getDefaultApiEndpoint = (): string => {
    // Next.js (process.env)
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CLIANTA_API_ENDPOINT) {
        return process.env.NEXT_PUBLIC_CLIANTA_API_ENDPOINT;
    }
    // Vite / Vue / Svelte / SvelteKit (import.meta.env)
    try {
        // @ts-ignore — import.meta.env is Vite-specific
        if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLIANTA_API_ENDPOINT) {
            // @ts-ignore
            return import.meta.env.VITE_CLIANTA_API_ENDPOINT;
        }
    } catch {
        // import.meta not available in this environment
    }
    // Create React App (process.env)
    if (typeof process !== 'undefined' && process.env?.REACT_APP_CLIANTA_API_ENDPOINT) {
        return process.env.REACT_APP_CLIANTA_API_ENDPOINT;
    }
    // Generic fallback
    if (typeof process !== 'undefined' && process.env?.CLIANTA_API_ENDPOINT) {
        return process.env.CLIANTA_API_ENDPOINT;
    }
    return 'http://localhost:5000';
};

/** All available plugins */
export const ALL_PLUGINS: PluginName[] = [
    'pageView',
    'forms',
    'scroll',
    'clicks',
    'engagement',
    'downloads',
    'exitIntent',
    'errors',
    'performance',
    'popupForms',
];

/** Core plugins enabled by default — all auto-track with zero config */
export const DEFAULT_PLUGINS: PluginName[] = [
    'pageView',
    'forms',
    'scroll',
    'clicks',
    'engagement',
    'downloads',
    'exitIntent',
    'errors',
    'performance',
];

/** Default configuration values */
export const DEFAULT_CONFIG: Required<CliantaConfig> = {
    projectId: '',
    apiEndpoint: getDefaultApiEndpoint(),
    debug: false,
    autoPageView: true,
    plugins: DEFAULT_PLUGINS,
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    batchSize: 10,
    flushInterval: 5000, // 5 seconds
    consent: {
        defaultConsent: { analytics: true, marketing: false, personalization: false },
        waitForConsent: false,
        storageKey: 'mb_consent',
        anonymousMode: false,
    },
    cookieDomain: '',
    useCookies: false,
    cookielessMode: false,
    persistMode: 'session',
};

/** Storage keys */
export const STORAGE_KEYS = {
    VISITOR_ID: 'mb_vid',
    SESSION_ID: 'mb_sid',
    SESSION_TIMESTAMP: 'mb_st',
    CONSENT: 'mb_consent',
    EVENT_QUEUE: 'mb_queue',
} as const;

/** Scroll depth milestones to track */
export const SCROLL_MILESTONES = [25, 50, 75, 100] as const;

/** File extensions to track as downloads */
export const DOWNLOAD_EXTENSIONS = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.tar', '.gz', '.7z',
    '.csv', '.txt', '.json', '.xml',
    '.mp3', '.mp4', '.wav', '.avi', '.mov',
] as const;

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: CliantaConfig = {}): Required<CliantaConfig> {
    return {
        ...DEFAULT_CONFIG,
        ...userConfig,
        consent: {
            ...DEFAULT_CONFIG.consent,
            ...userConfig.consent,
        },
    };
}
