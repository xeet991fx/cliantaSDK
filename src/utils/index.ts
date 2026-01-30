/**
 * MorrisB Tracking SDK - Utility Functions
 * @version 3.0.0
 */

import { STORAGE_KEYS, DOWNLOAD_EXTENSIONS } from '../core/config';

// ============================================
// UUID GENERATION
// ============================================

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback to manual generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ============================================
// STORAGE UTILITIES
// ============================================

/**
 * Safely get from localStorage
 */
export function getLocalStorage(key: string): string | null {
    try {
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem(key);
        }
    } catch {
        // localStorage not available or blocked
    }
    return null;
}

/**
 * Safely set to localStorage
 */
export function setLocalStorage(key: string, value: string): boolean {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
            return true;
        }
    } catch {
        // localStorage not available or blocked
    }
    return false;
}

/**
 * Safely get from sessionStorage
 */
export function getSessionStorage(key: string): string | null {
    try {
        if (typeof sessionStorage !== 'undefined') {
            return sessionStorage.getItem(key);
        }
    } catch {
        // sessionStorage not available or blocked
    }
    return null;
}

/**
 * Safely set to sessionStorage
 */
export function setSessionStorage(key: string, value: string): boolean {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(key, value);
            return true;
        }
    } catch {
        // sessionStorage not available or blocked
    }
    return false;
}

/**
 * Get or set a cookie
 */
export function cookie(name: string, value?: string, days?: number): string | null {
    if (typeof document === 'undefined') return null;

    // Get cookie
    if (value === undefined) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    // Set cookie
    let expires = '';
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + value + expires + '; path=/; SameSite=Lax';
    return value;
}

// ============================================
// VISITOR & SESSION MANAGEMENT
// ============================================

/**
 * Get or create a persistent visitor ID
 */
export function getOrCreateVisitorId(useCookies = false): string {
    const key = STORAGE_KEYS.VISITOR_ID;

    // Try to get existing ID
    let visitorId: string | null = null;

    if (useCookies) {
        visitorId = cookie(key);
    } else {
        visitorId = getLocalStorage(key);
    }

    // Create new ID if not found
    if (!visitorId) {
        visitorId = generateUUID();

        if (useCookies) {
            cookie(key, visitorId, 365); // 1 year
        } else {
            setLocalStorage(key, visitorId);
        }
    }

    return visitorId;
}

/**
 * Get or create a session ID (expires after timeout)
 */
export function getOrCreateSessionId(timeout: number): string {
    const sidKey = STORAGE_KEYS.SESSION_ID;
    const tsKey = STORAGE_KEYS.SESSION_TIMESTAMP;

    let sessionId = getSessionStorage(sidKey);
    const lastActivity = parseInt(getSessionStorage(tsKey) || '0', 10);
    const now = Date.now();

    // Check if session expired
    if (!sessionId || now - lastActivity > timeout) {
        sessionId = generateUUID();
        setSessionStorage(sidKey, sessionId);
    }

    // Update last activity
    setSessionStorage(tsKey, now.toString());

    return sessionId;
}

/**
 * Reset visitor and session IDs
 */
export function resetIds(useCookies = false): void {
    const visitorKey = STORAGE_KEYS.VISITOR_ID;

    if (useCookies) {
        cookie(visitorKey, '', -1); // Delete cookie
    } else {
        try {
            localStorage.removeItem(visitorKey);
        } catch {
            // Ignore
        }
    }

    try {
        sessionStorage.removeItem(STORAGE_KEYS.SESSION_ID);
        sessionStorage.removeItem(STORAGE_KEYS.SESSION_TIMESTAMP);
    } catch {
        // Ignore
    }
}

// ============================================
// URL UTILITIES
// ============================================

/**
 * Extract UTM parameters from URL
 */
export function getUTMParams(): Record<string, string | undefined> {
    if (typeof window === 'undefined') return {};

    try {
        const params = new URLSearchParams(window.location.search);
        return {
            utmSource: params.get('utm_source') || undefined,
            utmMedium: params.get('utm_medium') || undefined,
            utmCampaign: params.get('utm_campaign') || undefined,
            utmTerm: params.get('utm_term') || undefined,
            utmContent: params.get('utm_content') || undefined,
        };
    } catch {
        return {};
    }
}

/**
 * Check if URL is a download link
 */
export function isDownloadUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return DOWNLOAD_EXTENSIONS.some((ext) => lowerUrl.includes(ext));
}

/**
 * Extract filename from URL
 */
export function getFilenameFromUrl(url: string): string {
    try {
        return url.split('/').pop()?.split('?')[0] || 'unknown';
    } catch {
        return 'unknown';
    }
}

/**
 * Extract file extension from URL
 */
export function getFileExtension(url: string): string {
    const filename = getFilenameFromUrl(url);
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop() || 'unknown' : 'unknown';
}

// ============================================
// DOM UTILITIES
// ============================================

/**
 * Get text content from element (truncated)
 */
export function getElementText(element: Element, maxLength = 100): string {
    const text = (element as HTMLElement).innerText ||
        element.textContent ||
        (element as HTMLInputElement).value ||
        '';
    return text.trim().substring(0, maxLength);
}

/**
 * Get element identification info
 */
export function getElementInfo(element: Element): Record<string, string> {
    return {
        tag: element.tagName?.toLowerCase() || 'unknown',
        id: element.id || '',
        className: element.className || '',
        text: getElementText(element, 50),
    };
}

/**
 * Check if element is a trackable click target
 */
export function isTrackableClickElement(element: Element): boolean {
    const trackableTags = ['BUTTON', 'A', 'INPUT'];
    return (
        trackableTags.includes(element.tagName) ||
        element.hasAttribute('data-track-click') ||
        element.classList.contains('track-click')
    );
}

/**
 * Check if device is mobile
 */
export function isMobile(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}

// ============================================
// DEVICE INFO
// ============================================

/**
 * Get current device information
 */
export function getDeviceInfo(): { userAgent: string; screen: string; language: string; timezone: string } {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return {
            userAgent: 'unknown',
            screen: 'unknown',
            language: 'unknown',
            timezone: 'unknown',
        };
    }

    return {
        userAgent: navigator.userAgent,
        screen: `${screen.width}x${screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    };
}
