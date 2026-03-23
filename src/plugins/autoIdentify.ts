/**
 * Clianta SDK - Auto-Identify Plugin (Production)
 *
 * Automatically detects logged-in users across ANY auth system:
 *   - Window globals: Clerk, Firebase, Auth0, Supabase, __clianta_user
 *   - JWT tokens in cookies (decoded client-side)
 *   - JSON/JWT in localStorage & sessionStorage (guarded recursive deep-scan)
 *   - Real-time storage change detection via `storage` event
 *   - NextAuth session probing (only when NextAuth signals detected)
 *
 * Production safeguards:
 *   - No monkey-patching of window.fetch or XMLHttpRequest
 *   - Size-limited storage scanning (skips values > 50KB)
 *   - Depth & key-count limited recursion (max 4 levels, 20 keys/level)
 *   - Proper email regex validation
 *   - Exponential backoff polling (2s → 5s → 10s → 30s)
 *   - Zero console errors from probing
 *
 * Works universally: Next.js, Vite, CRA, Nuxt, SvelteKit, Remix,
 * Astro, plain HTML, Zustand, Redux, Pinia, MobX, or any custom auth.
 *
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

// ────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────

/** Max recursion depth for JSON scanning */
const MAX_SCAN_DEPTH = 4;
/** Max object keys to inspect per recursion level */
const MAX_KEYS_PER_LEVEL = 20;
/** Max storage value size to parse (bytes) — skip large blobs */
const MAX_STORAGE_VALUE_SIZE = 50_000;

/** Proper email regex — must have user@domain.tld (2+ char TLD) */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Known auth cookie name patterns */
const AUTH_COOKIE_PATTERNS = [
    // Provider-specific
    '__session', '__clerk_db_jwt',
    'next-auth.session-token', '__Secure-next-auth.session-token',
    'sb-access-token',
    'auth0.is.authenticated',
    // Keycloak
    'KEYCLOAK_SESSION', 'KEYCLOAK_IDENTITY', 'KC_RESTART',
    // Generic
    'token', 'jwt', 'access_token', 'session_token', 'auth_token', 'id_token',
];

/** localStorage/sessionStorage key patterns */
const STORAGE_KEY_PATTERNS = [
    // Provider-specific
    'sb-', 'supabase.auth.', 'firebase:authUser:', 'auth0spajs', '@@auth0spajs@@',
    // Microsoft MSAL
    'msal.', 'msal.account',
    // AWS Cognito / Amplify
    'CognitoIdentityServiceProvider', 'amplify-signin-with-hostedUI',
    // Keycloak
    'kc-callback-',
    // State managers
    'persist:', '-storage',
    // Generic
    'token', 'jwt', 'auth', 'user', 'session', 'credential', 'account',
];

/** JWT/user object fields containing email */
const EMAIL_CLAIMS = ['email', 'preferred_username', 'user_email', 'mail', 'emailAddress', 'e_mail'];
/** Full name fields */
const NAME_CLAIMS = ['name', 'full_name', 'display_name', 'displayName'];
/** First name fields */
const FIRST_NAME_CLAIMS = ['given_name', 'first_name', 'firstName', 'fname'];
/** Last name fields */
const LAST_NAME_CLAIMS = ['family_name', 'last_name', 'lastName', 'lname'];

/** Polling schedule: exponential backoff (ms) */
const POLL_SCHEDULE = [
    2_000,   // 2s — first check (auth providers need time to init)
    5_000,   // 5s — second check
    10_000,  // 10s
    10_000,  // 10s
    30_000,  // 30s — slower from here
    30_000,  // 30s
    30_000,  // 30s
    60_000,  // 1m
    60_000,  // 1m
    60_000,  // 1m — stop after ~4 min total
];

type IdentifiedUser = { email: string; firstName?: string; lastName?: string };

export class AutoIdentifyPlugin extends BasePlugin {
    name: PluginName = 'autoIdentify';
    private pollTimeouts: ReturnType<typeof setTimeout>[] = [];
    private identifiedEmail: string | null = null;
    private storageHandler: ((event: StorageEvent) => void) | null = null;
    private sessionProbed = false;

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof window === 'undefined') return;

        // Schedule poll checks with exponential backoff
        this.schedulePollChecks();

        // Listen for storage changes (real-time detection of login/logout)
        this.listenForStorageChanges();
    }

    destroy(): void {
        // Clear all scheduled polls
        for (const t of this.pollTimeouts) clearTimeout(t);
        this.pollTimeouts = [];

        // Remove storage listener
        if (this.storageHandler && typeof window !== 'undefined') {
            window.removeEventListener('storage', this.storageHandler);
            this.storageHandler = null;
        }

        super.destroy();
    }

    // ════════════════════════════════════════════════
    // SCHEDULING
    // ════════════════════════════════════════════════

    /**
     * Schedule poll checks with exponential backoff.
     * Much lighter than setInterval — each check is self-contained.
     */
    private schedulePollChecks(): void {
        let cumulativeDelay = 0;
        for (let i = 0; i < POLL_SCHEDULE.length; i++) {
            cumulativeDelay += POLL_SCHEDULE[i];
            const timeout = setTimeout(() => {
                if (this.identifiedEmail) return; // Already identified, skip
                try { this.checkForAuthUser(); } catch { /* silently fail */ }

                // On the 4th check (~27s), probe NextAuth if signals detected
                if (i === 3 && !this.sessionProbed) {
                    this.sessionProbed = true;
                    this.guardedSessionProbe();
                }
            }, cumulativeDelay);
            this.pollTimeouts.push(timeout);
        }
    }

    /**
     * Listen for `storage` events — fired when another tab or the app
     * modifies localStorage. Enables real-time detection after login.
     */
    private listenForStorageChanges(): void {
        this.storageHandler = (event: StorageEvent) => {
            if (this.identifiedEmail) return; // Already identified
            if (!event.key || !event.newValue) return;

            const keyLower = event.key.toLowerCase();
            const isAuthKey = STORAGE_KEY_PATTERNS.some(p =>
                keyLower.includes(p.toLowerCase())
            );
            if (!isAuthKey) return;

            // Auth-related storage changed — run a check
            try { this.checkForAuthUser(); } catch { /* silently fail */ }
        };
        window.addEventListener('storage', this.storageHandler);
    }

    // ════════════════════════════════════════════════
    // MAIN CHECK — scan all sources (priority order)
    // ════════════════════════════════════════════════

    private checkForAuthUser(): void {
        if (!this.tracker || this.identifiedEmail) return;

        // 0. Check well-known auth provider globals (most reliable, zero overhead)
        try {
            const providerUser = this.checkAuthProviders();
            if (providerUser) { this.identifyUser(providerUser); return; }
        } catch { /* provider check failed */ }

        // 1. Check cookies for JWTs
        try {
            const cookieUser = this.checkCookies();
            if (cookieUser) { this.identifyUser(cookieUser); return; }
        } catch { /* cookie access blocked */ }

        // 2. Check localStorage (guarded deep scan)
        try {
            if (typeof localStorage !== 'undefined') {
                const localUser = this.checkStorage(localStorage);
                if (localUser) { this.identifyUser(localUser); return; }
            }
        } catch { /* localStorage access blocked */ }

        // 3. Check sessionStorage (guarded deep scan)
        try {
            if (typeof sessionStorage !== 'undefined') {
                const sessionUser = this.checkStorage(sessionStorage);
                if (sessionUser) { this.identifyUser(sessionUser); return; }
            }
        } catch { /* sessionStorage access blocked */ }
    }

    // ════════════════════════════════════════════════
    // AUTH PROVIDER GLOBALS
    // ════════════════════════════════════════════════

    private checkAuthProviders(): IdentifiedUser | null {
        const win = window as any;

        // ─── Clerk ───
        try {
            const clerkUser = win.Clerk?.user;
            if (clerkUser) {
                const email = clerkUser.primaryEmailAddress?.emailAddress
                    || clerkUser.emailAddresses?.[0]?.emailAddress;
                if (email && this.isValidEmail(email)) {
                    return {
                        email,
                        firstName: clerkUser.firstName || undefined,
                        lastName: clerkUser.lastName || undefined,
                    };
                }
            }
        } catch { /* Clerk not available */ }

        // ─── Firebase Auth ───
        try {
            const fbAuth = win.firebase?.auth?.();
            const fbUser = fbAuth?.currentUser;
            if (fbUser?.email && this.isValidEmail(fbUser.email)) {
                const parts = (fbUser.displayName || '').split(' ');
                return {
                    email: fbUser.email,
                    firstName: parts[0] || undefined,
                    lastName: parts.slice(1).join(' ') || undefined,
                };
            }
        } catch { /* Firebase not available */ }

        // ─── Supabase ───
        try {
            const sbClient = win.__SUPABASE_CLIENT__ || win.supabase;
            if (sbClient?.auth) {
                const session = sbClient.auth.session?.() || sbClient.auth.getSession?.();
                const user = session?.data?.session?.user || session?.user;
                if (user?.email && this.isValidEmail(user.email)) {
                    const meta = user.user_metadata || {};
                    return {
                        email: user.email,
                        firstName: meta.first_name || meta.full_name?.split(' ')[0] || undefined,
                        lastName: meta.last_name || meta.full_name?.split(' ').slice(1).join(' ') || undefined,
                    };
                }
            }
        } catch { /* Supabase not available */ }

        // ─── Auth0 SPA ───
        try {
            const auth0 = win.__auth0Client || win.auth0Client;
            if (auth0?.isAuthenticated?.()) {
                const user = auth0.getUser?.();
                if (user?.email && this.isValidEmail(user.email)) {
                    return {
                        email: user.email,
                        firstName: user.given_name || user.name?.split(' ')[0] || undefined,
                        lastName: user.family_name || user.name?.split(' ').slice(1).join(' ') || undefined,
                    };
                }
            }
        } catch { /* Auth0 not available */ }

        // ─── Google Identity Services (Google OAuth / Sign In With Google) ───
        // GIS stores the credential JWT from the callback; also check gapi
        try {
            const gisCredential = win.__google_credential_response?.credential;
            if (gisCredential && typeof gisCredential === 'string') {
                const user = this.extractUserFromToken(gisCredential);
                if (user) return user;
            }
            // Legacy gapi.auth2
            const gapiUser = win.gapi?.auth2?.getAuthInstance?.()?.currentUser?.get?.();
            const profile = gapiUser?.getBasicProfile?.();
            if (profile) {
                const email = profile.getEmail?.();
                if (email && this.isValidEmail(email)) {
                    return {
                        email,
                        firstName: profile.getGivenName?.() || undefined,
                        lastName: profile.getFamilyName?.() || undefined,
                    };
                }
            }
        } catch { /* Google auth not available */ }

        // ─── Microsoft MSAL (Microsoft OAuth / Azure AD) ───
        // MSAL stores account info in window.msalInstance or PublicClientApplication
        try {
            const msalInstance = win.msalInstance || win.__msalInstance;
            if (msalInstance) {
                const accounts = msalInstance.getAllAccounts?.() || [];
                const account = accounts[0];
                if (account?.username && this.isValidEmail(account.username)) {
                    const nameParts = (account.name || '').split(' ');
                    return {
                        email: account.username,
                        firstName: nameParts[0] || undefined,
                        lastName: nameParts.slice(1).join(' ') || undefined,
                    };
                }
            }
        } catch { /* MSAL not available */ }

        // ─── AWS Cognito / Amplify ───
        try {
            // Amplify v6+
            const amplifyUser = win.aws_amplify_currentUser || win.__amplify_user;
            if (amplifyUser?.signInDetails?.loginId && this.isValidEmail(amplifyUser.signInDetails.loginId)) {
                return {
                    email: amplifyUser.signInDetails.loginId,
                    firstName: amplifyUser.attributes?.given_name || undefined,
                    lastName: amplifyUser.attributes?.family_name || undefined,
                };
            }
            // Check Cognito localStorage keys directly
            if (typeof localStorage !== 'undefined') {
                const cognitoUser = this.checkCognitoStorage();
                if (cognitoUser) return cognitoUser;
            }
        } catch { /* Cognito/Amplify not available */ }

        // ─── Keycloak ───
        try {
            const keycloak = win.keycloak || win.Keycloak;
            if (keycloak?.authenticated && keycloak.tokenParsed) {
                const claims = keycloak.tokenParsed;
                const email = claims.email || claims.preferred_username;
                if (email && this.isValidEmail(email)) {
                    return {
                        email,
                        firstName: claims.given_name || undefined,
                        lastName: claims.family_name || undefined,
                    };
                }
            }
        } catch { /* Keycloak not available */ }

        // ─── Global clianta identify hook ───
        // Any auth system can set: window.__clianta_user = { email, firstName, lastName }
        try {
            const manualUser = win.__clianta_user;
            if (manualUser?.email && typeof manualUser.email === 'string' && this.isValidEmail(manualUser.email)) {
                return {
                    email: manualUser.email,
                    firstName: manualUser.firstName || undefined,
                    lastName: manualUser.lastName || undefined,
                };
            }
        } catch { /* manual user not set */ }

        return null;
    }

    // ════════════════════════════════════════════════
    // IDENTIFY USER
    // ════════════════════════════════════════════════

    private identifyUser(user: IdentifiedUser): void {
        if (!this.tracker || this.identifiedEmail === user.email) return;

        this.identifiedEmail = user.email;
        this.tracker.identify(user.email, {
            firstName: user.firstName,
            lastName: user.lastName,
        });

        // Cancel all remaining polls — we found the user
        for (const t of this.pollTimeouts) clearTimeout(t);
        this.pollTimeouts = [];
    }

    // ════════════════════════════════════════════════
    // COOKIE SCANNING
    // ════════════════════════════════════════════════

    private checkCookies(): IdentifiedUser | null {
        if (typeof document === 'undefined') return null;

        try {
            const cookies = document.cookie.split(';').map(c => c.trim());

            for (const cookie of cookies) {
                const [name, ...valueParts] = cookie.split('=');
                const value = valueParts.join('=');
                const cookieName = name.trim().toLowerCase();

                const isAuthCookie = AUTH_COOKIE_PATTERNS.some(pattern =>
                    cookieName.includes(pattern.toLowerCase())
                );

                if (isAuthCookie && value) {
                    const user = this.extractUserFromToken(decodeURIComponent(value));
                    if (user) return user;
                }
            }
        } catch {
            // Cookie access may fail (cross-origin iframe, etc.)
        }

        return null;
    }

    // ════════════════════════════════════════════════
    // STORAGE SCANNING (GUARDED DEEP RECURSIVE)
    // ════════════════════════════════════════════════

    private checkStorage(storage: Storage): IdentifiedUser | null {
        try {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (!key) continue;

                const keyLower = key.toLowerCase();
                const isAuthKey = STORAGE_KEY_PATTERNS.some(pattern =>
                    keyLower.includes(pattern.toLowerCase())
                );

                if (isAuthKey) {
                    const value = storage.getItem(key);
                    if (!value) continue;

                    // Size guard — skip values larger than 50KB
                    if (value.length > MAX_STORAGE_VALUE_SIZE) continue;

                    // Try as direct JWT
                    const user = this.extractUserFromToken(value);
                    if (user) return user;

                    // Try as JSON — guarded deep recursive scan
                    try {
                        const json = JSON.parse(value);
                        const jsonUser = this.deepScanForUser(json, 0);
                        if (jsonUser) return jsonUser;
                    } catch {
                        // Not JSON, skip
                    }
                }
            }
        } catch {
            // Storage access may fail (iframe, security restrictions)
        }

        return null;
    }

    // ════════════════════════════════════════════════
    // DEEP RECURSIVE SCANNING (guarded)
    // ════════════════════════════════════════════════

    /**
     * Recursively scan a JSON object for user data.
     * Guards: max depth (4), max keys per level (20), no array traversal.
     *
     * Handles ANY nesting pattern:
     *   - Zustand persist: { state: { user: { email } } }
     *   - Redux persist:   { auth: { user: { email } } }
     *   - Pinia:           { auth: { userData: { email } } }
     *   - NextAuth:        { user: { email }, expires: ... }
     *   - Direct:          { email, name }
     */
    private deepScanForUser(data: unknown, depth: number): IdentifiedUser | null {
        if (depth > MAX_SCAN_DEPTH || !data || typeof data !== 'object' || Array.isArray(data)) {
            return null;
        }

        const obj = data as Record<string, any>;
        const keys = Object.keys(obj);

        // 1. Try direct extraction at this level
        const user = this.extractUserFromClaims(obj);
        if (user) return user;

        // Guard: limit keys scanned per level
        const keysToScan = keys.slice(0, MAX_KEYS_PER_LEVEL);

        // 2. Check for JWT strings at this level
        for (const key of keysToScan) {
            const val = obj[key];
            if (typeof val === 'string' && val.length > 30 && val.length < 4000) {
                // Only check strings that could plausibly be JWTs (30-4000 chars)
                const dotCount = (val.match(/\./g) || []).length;
                if (dotCount === 2) {
                    const tokenUser = this.extractUserFromToken(val);
                    if (tokenUser) return tokenUser;
                }
            }
        }

        // 3. Recurse into nested objects
        for (const key of keysToScan) {
            const val = obj[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                const nestedUser = this.deepScanForUser(val, depth + 1);
                if (nestedUser) return nestedUser;
            }
        }

        return null;
    }

    // ════════════════════════════════════════════════
    // TOKEN & CLAIMS EXTRACTION
    // ════════════════════════════════════════════════

    /**
     * Try to extract user info from a JWT token string (header.payload.signature)
     */
    private extractUserFromToken(token: string): IdentifiedUser | null {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        try {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            return this.extractUserFromClaims(payload);
        } catch {
            return null;
        }
    }

    /**
     * Extract user from JWT claims or user-like object.
     * Uses proper email regex validation.
     */
    private extractUserFromClaims(claims: Record<string, any>): IdentifiedUser | null {
        if (!claims || typeof claims !== 'object') return null;

        // Find email — check standard claim fields
        let email: string | null = null;
        for (const claim of EMAIL_CLAIMS) {
            const value = claims[claim];
            if (value && typeof value === 'string' && this.isValidEmail(value)) {
                email = value;
                break;
            }
        }

        // Check nested email objects (Clerk pattern)
        if (!email) {
            const nestedEmail = claims.primaryEmailAddress?.emailAddress
                || claims.emailAddresses?.[0]?.emailAddress;
            if (nestedEmail && typeof nestedEmail === 'string' && this.isValidEmail(nestedEmail)) {
                email = nestedEmail;
            }
        }

        if (!email) return null;

        // Find name
        let firstName: string | undefined;
        let lastName: string | undefined;

        for (const claim of FIRST_NAME_CLAIMS) {
            if (claims[claim] && typeof claims[claim] === 'string') {
                firstName = claims[claim];
                break;
            }
        }

        for (const claim of LAST_NAME_CLAIMS) {
            if (claims[claim] && typeof claims[claim] === 'string') {
                lastName = claims[claim];
                break;
            }
        }

        // Try full name if no first/last found
        if (!firstName) {
            for (const claim of NAME_CLAIMS) {
                if (claims[claim] && typeof claims[claim] === 'string') {
                    const parts = claims[claim].split(' ');
                    firstName = parts[0];
                    lastName = lastName || parts.slice(1).join(' ') || undefined;
                    break;
                }
            }
        }

        return { email, firstName, lastName };
    }

    // ════════════════════════════════════════════════
    // GUARDED SESSION PROBING (NextAuth only)
    // ════════════════════════════════════════════════

    /**
     * Probe NextAuth session endpoint ONLY if NextAuth signals are present.
     * Signals: `next-auth.session-token` cookie, `__NEXTAUTH` or `__NEXT_DATA__` globals.
     * This prevents unnecessary 404 errors on non-NextAuth sites.
     */
    private async guardedSessionProbe(): Promise<void> {
        if (this.identifiedEmail) return;

        // Check for NextAuth signals before probing
        const hasNextAuthCookie = typeof document !== 'undefined' &&
            (document.cookie.includes('next-auth.session-token') ||
                document.cookie.includes('__Secure-next-auth.session-token'));

        const hasNextAuthGlobal = typeof window !== 'undefined' &&
            ((window as any).__NEXTAUTH != null || (window as any).__NEXT_DATA__ != null);

        if (!hasNextAuthCookie && !hasNextAuthGlobal) return;

        // NextAuth detected — safe to probe /api/auth/session
        try {
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' },
            });

            if (response.ok) {
                const body = await response.json();
                // NextAuth returns { user: { name, email, image }, expires }
                if (body && typeof body === 'object' && Object.keys(body).length > 0) {
                    const user = this.deepScanForUser(body, 0);
                    if (user) {
                        this.identifyUser(user);
                    }
                }
            }
        } catch {
            // Endpoint failed — silently ignore
        }
    }

    // ════════════════════════════════════════════════
    // AWS COGNITO STORAGE SCANNING
    // ════════════════════════════════════════════════

    /**
     * Scan localStorage for AWS Cognito / Amplify user data.
     * Cognito stores tokens under keys like:
     *   CognitoIdentityServiceProvider.<clientId>.<username>.idToken
     *   CognitoIdentityServiceProvider.<clientId>.<username>.userData
     */
    private checkCognitoStorage(): IdentifiedUser | null {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;

                // Look for Cognito ID tokens (contain email in JWT claims)
                if (key.startsWith('CognitoIdentityServiceProvider.') && key.endsWith('.idToken')) {
                    const value = localStorage.getItem(key);
                    if (value && value.length < MAX_STORAGE_VALUE_SIZE) {
                        const user = this.extractUserFromToken(value);
                        if (user) return user;
                    }
                }

                // Look for Cognito userData (JSON with email attribute)
                if (key.startsWith('CognitoIdentityServiceProvider.') && key.endsWith('.userData')) {
                    const value = localStorage.getItem(key);
                    if (value && value.length < MAX_STORAGE_VALUE_SIZE) {
                        try {
                            const data = JSON.parse(value);
                            // Cognito userData format: { UserAttributes: [{ Name: 'email', Value: '...' }] }
                            const attrs = data.UserAttributes || data.attributes || [];
                            const emailAttr = attrs.find?.((a: any) =>
                                a.Name === 'email' || a.name === 'email'
                            );
                            if (emailAttr?.Value && this.isValidEmail(emailAttr.Value)) {
                                const nameAttr = attrs.find?.((a: any) =>
                                    a.Name === 'name' || a.name === 'name'
                                );
                                const givenNameAttr = attrs.find?.((a: any) =>
                                    a.Name === 'given_name' || a.name === 'given_name'
                                );
                                const familyNameAttr = attrs.find?.((a: any) =>
                                    a.Name === 'family_name' || a.name === 'family_name'
                                );

                                let firstName = givenNameAttr?.Value;
                                let lastName = familyNameAttr?.Value;

                                if (!firstName && nameAttr?.Value) {
                                    const parts = nameAttr.Value.split(' ');
                                    firstName = parts[0];
                                    lastName = lastName || parts.slice(1).join(' ') || undefined;
                                }

                                return {
                                    email: emailAttr.Value,
                                    firstName: firstName || undefined,
                                    lastName: lastName || undefined,
                                };
                            }
                        } catch { /* invalid JSON */ }
                    }
                }
            }
        } catch { /* storage access failed */ }

        return null;
    }

    // ════════════════════════════════════════════════
    // UTILITIES
    // ════════════════════════════════════════════════

    /**
     * Validate email with proper regex.
     * Rejects: user@v2.0, config@internal, tokens with @ signs.
     * Accepts: user@domain.com, user@sub.domain.co.uk
     */
    private isValidEmail(value: string): boolean {
        return EMAIL_REGEX.test(value);
    }
}
