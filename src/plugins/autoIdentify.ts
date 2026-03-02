/**
 * Clianta SDK - Auto-Identify Plugin
 * Automatically detects logged-in users by checking JWT tokens in
 * cookies, localStorage, and sessionStorage. Works with any auth provider:
 * Clerk, Firebase, Auth0, Supabase, NextAuth, Passport, custom JWT, etc.
 *
 * How it works:
 * 1. On init + periodically, scans for JWT tokens
 * 2. Decodes the JWT payload (base64, no secret needed)
 * 3. Extracts email/name from standard JWT claims
 * 4. Calls tracker.identify() automatically
 *
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

/** Known auth cookie patterns and their JWT locations */
const AUTH_COOKIE_PATTERNS = [
    // Clerk
    '__session',
    '__clerk_db_jwt',
    // NextAuth
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    // Supabase
    'sb-access-token',
    // Auth0
    'auth0.is.authenticated',
    // Firebase — uses localStorage, handled separately
    // Generic patterns
    'token',
    'jwt',
    'access_token',
    'session_token',
    'auth_token',
    'id_token',
];

/** localStorage/sessionStorage key patterns for auth tokens */
const STORAGE_KEY_PATTERNS = [
    // Supabase
    'sb-',
    'supabase.auth.',
    // Firebase
    'firebase:authUser:',
    // Auth0
    'auth0spajs',
    '@@auth0spajs@@',
    // Generic
    'token',
    'jwt',
    'auth',
    'user',
    'session',
];

/** Standard JWT claim fields for email */
const EMAIL_CLAIMS = ['email', 'sub', 'preferred_username', 'user_email', 'mail'];
const NAME_CLAIMS = ['name', 'full_name', 'display_name', 'given_name'];
const FIRST_NAME_CLAIMS = ['given_name', 'first_name', 'firstName'];
const LAST_NAME_CLAIMS = ['family_name', 'last_name', 'lastName'];

export class AutoIdentifyPlugin extends BasePlugin {
    name: PluginName = 'autoIdentify';
    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private identifiedEmail: string | null = null;
    private checkCount = 0;
    private readonly MAX_CHECKS = 30; // Stop checking after ~5 minutes
    private readonly CHECK_INTERVAL_MS = 10_000; // Check every 10 seconds

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof window === 'undefined') return;

        // First check after 2 seconds (give auth providers time to init)
        setTimeout(() => {
            try { this.checkForAuthUser(); } catch { /* silently fail */ }
        }, 2000);

        // Then check periodically
        this.checkInterval = setInterval(() => {
            this.checkCount++;
            if (this.checkCount >= this.MAX_CHECKS) {
                if (this.checkInterval) {
                    clearInterval(this.checkInterval);
                    this.checkInterval = null;
                }
                return;
            }
            try { this.checkForAuthUser(); } catch { /* silently fail */ }
        }, this.CHECK_INTERVAL_MS);
    }

    destroy(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        super.destroy();
    }

    /**
     * Main check — scan all sources for auth tokens
     */
    private checkForAuthUser(): void {
        if (!this.tracker || this.identifiedEmail) return;

        // 0. Check well-known auth provider globals (most reliable)
        try {
            const providerUser = this.checkAuthProviders();
            if (providerUser) {
                this.identifyUser(providerUser);
                return;
            }
        } catch { /* provider check failed */ }

        try {
            // 1. Check cookies for JWTs
            const cookieUser = this.checkCookies();
            if (cookieUser) {
                this.identifyUser(cookieUser);
                return;
            }
        } catch { /* cookie access blocked */ }

        try {
            // 2. Check localStorage
            if (typeof localStorage !== 'undefined') {
                const localUser = this.checkStorage(localStorage);
                if (localUser) {
                    this.identifyUser(localUser);
                    return;
                }
            }
        } catch { /* localStorage access blocked */ }

        try {
            // 3. Check sessionStorage
            if (typeof sessionStorage !== 'undefined') {
                const sessionUser = this.checkStorage(sessionStorage);
                if (sessionUser) {
                    this.identifyUser(sessionUser);
                    return;
                }
            }
        } catch { /* sessionStorage access blocked */ }
    }

    /**
     * Check well-known auth provider globals on window
     * These are the most reliable — they expose user data directly
     */
    private checkAuthProviders(): { email: string; firstName?: string; lastName?: string } | null {
        const win = window as any;

        // ─── Clerk ───
        // Clerk exposes window.Clerk after initialization
        try {
            const clerkUser = win.Clerk?.user;
            if (clerkUser) {
                const email = clerkUser.primaryEmailAddress?.emailAddress
                    || clerkUser.emailAddresses?.[0]?.emailAddress;
                if (email) {
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
            if (fbUser?.email) {
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
                // Supabase v2 stores session
                const session = sbClient.auth.session?.() || sbClient.auth.getSession?.();
                const user = session?.data?.session?.user || session?.user;
                if (user?.email) {
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
                if (user?.email) {
                    return {
                        email: user.email,
                        firstName: user.given_name || user.name?.split(' ')[0] || undefined,
                        lastName: user.family_name || user.name?.split(' ').slice(1).join(' ') || undefined,
                    };
                }
            }
        } catch { /* Auth0 not available */ }

        // ─── Global clianta identify hook ───
        // Any auth system can set: window.__clianta_user = { email, firstName, lastName }
        try {
            const manualUser = win.__clianta_user;
            if (manualUser?.email && typeof manualUser.email === 'string' && manualUser.email.includes('@')) {
                return {
                    email: manualUser.email,
                    firstName: manualUser.firstName || undefined,
                    lastName: manualUser.lastName || undefined,
                };
            }
        } catch { /* manual user not set */ }

        return null;
    }

    /**
     * Identify the user and stop checking
     */
    private identifyUser(user: { email: string; firstName?: string; lastName?: string }): void {
        if (!this.tracker || this.identifiedEmail === user.email) return;

        this.identifiedEmail = user.email;
        this.tracker.identify(user.email, {
            firstName: user.firstName,
            lastName: user.lastName,
        });

        // Stop interval — we found the user
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Scan cookies for JWT tokens
     */
    private checkCookies(): { email: string; firstName?: string; lastName?: string } | null {
        if (typeof document === 'undefined') return null;

        try {
            const cookies = document.cookie.split(';').map(c => c.trim());

            for (const cookie of cookies) {
                const [name, ...valueParts] = cookie.split('=');
                const value = valueParts.join('=');
                const cookieName = name.trim().toLowerCase();

                // Check if this cookie matches known auth patterns
                const isAuthCookie = AUTH_COOKIE_PATTERNS.some(pattern =>
                    cookieName.includes(pattern.toLowerCase())
                );

                if (isAuthCookie && value) {
                    const user = this.extractUserFromToken(decodeURIComponent(value));
                    if (user) return user;
                }
            }
        } catch {
            // Cookie access may fail in some environments
        }

        return null;
    }

    /**
     * Scan localStorage or sessionStorage for auth tokens
     */
    private checkStorage(storage: Storage): { email: string; firstName?: string; lastName?: string } | null {
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

                    // Try as direct JWT
                    const user = this.extractUserFromToken(value);
                    if (user) return user;

                    // Try as JSON containing a token
                    try {
                        const json = JSON.parse(value);
                        const user = this.extractUserFromJson(json);
                        if (user) return user;
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

    /**
     * Try to extract user info from a JWT token string
     */
    private extractUserFromToken(token: string): { email: string; firstName?: string; lastName?: string } | null {
        // JWT format: header.payload.signature
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
     * Extract user info from a JSON object (e.g., Firebase auth user stored in localStorage)
     */
    private extractUserFromJson(data: any): { email: string; firstName?: string; lastName?: string } | null {
        if (!data || typeof data !== 'object') return null;

        // Direct user object
        const user = this.extractUserFromClaims(data);
        if (user) return user;

        // Nested: { user: { email } } or { data: { user: { email } } }
        for (const key of ['user', 'data', 'session', 'currentUser', 'authUser', 'access_token', 'token']) {
            if (data[key]) {
                if (typeof data[key] === 'string') {
                    // Might be a JWT inside JSON
                    const tokenUser = this.extractUserFromToken(data[key]);
                    if (tokenUser) return tokenUser;
                } else if (typeof data[key] === 'object') {
                    const nestedUser = this.extractUserFromClaims(data[key]);
                    if (nestedUser) return nestedUser;
                }
            }
        }

        return null;
    }

    /**
     * Extract user from JWT claims or user object
     */
    private extractUserFromClaims(claims: Record<string, any>): { email: string; firstName?: string; lastName?: string } | null {
        if (!claims || typeof claims !== 'object') return null;

        // Find email
        let email: string | null = null;
        for (const claim of EMAIL_CLAIMS) {
            const value = claims[claim];
            if (value && typeof value === 'string' && value.includes('@') && value.includes('.')) {
                email = value;
                break;
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

        // If no first/last name, try full name
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
}
