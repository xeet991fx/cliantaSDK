/**
 * Clianta SDK - Configuration
 * @see SDK_VERSION in core/config.ts
 */

import type { CliantaConfig, PluginName } from '../types';

/** SDK Version */
export const SDK_VERSION = '1.2.0';

/** Default API endpoint based on environment */
export const getDefaultApiEndpoint = (): string => {
    if (typeof window === 'undefined') return 'https://api.clianta.online';

    const hostname = window.location.hostname;
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return 'http://localhost:5000';
    }
    return 'https://api.clianta.online';
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

/** Core plugins enabled by default */
export const DEFAULT_PLUGINS: PluginName[] = [
    'pageView',
    'forms',
    'scroll',
    'clicks',
    'engagement',
    'downloads',
    'exitIntent',
    'popupForms',
];

/** Default configuration values */
export const DEFAULT_CONFIG: Required<CliantaConfig> = {
    projectId: '',
    apiEndpoint: getDefaultApiEndpoint(),
    authToken: '',
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
