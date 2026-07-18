/**
 * Eutexa SDK - Auto-Identify Plugin
 *
 * Detects logged-in users and calls `tracker.identify()` automatically so
 * the SDK consumer never has to instrument their login flow.
 *
 * MODES (configurable via `EutexaConfig.autoIdentifyMode`):
 *
 *   'auto'       — DEFAULT. Provider globals + JWT-only scan in cookies
 *                  and storage, gated by five safeguards (below) that
 *                  minimise the "wrong email" class of false positives.
 *                  This is the right default for the "drop in the SDK and
 *                  forget about it" promise.
 *
 *   'providers'  — Provider globals only. Zero false positives, lower
 *                  coverage. Recommended when you can guarantee a
 *                  recognised auth provider (Clerk / Firebase / NextAuth /
 *                  Auth0 / Supabase / Google GIS / MSAL / Cognito /
 *                  Keycloak) and you want belt-and-braces strictness.
 *
 *   'aggressive' — `'auto'` PLUS plain-JSON deep scan of cookies and
 *                  storage (the old < 1.8.0 default). Highest coverage,
 *                  more false-positive prone. Use only when your app
 *                  stores the user object as plain JSON without a JWT.
 *
 *   'off'        — Disables auto-identify entirely.
 *
 * Five safeguards built into 'auto' mode:
 *
 *   1. JWT freshness  — only use tokens whose `exp` is in the future and
 *                       `iat` is within the last 30 days.
 *   2. Third-party SDK blocklist — skip keys belonging to Intercom,
 *                       FullStory, HubSpot, Drift, Segment, Pendo,
 *                       Userpilot, Mixpanel, Amplitude, etc.
 *   3. Domain-match preference — prefer email whose domain matches the
 *                       page hostname over emails from third-party widgets.
 *   4. Sticky identification — cache the identified email in localStorage
 *                       so once we've found the right user we keep using
 *                       them across reloads.
 *   5. Auto-logout    — when an auth-shaped storage key gets removed or
 *                       set to a falsy value, fire `tracker.reset()` so
 *                       the next user on the same browser starts fresh.
 *
 * @see SDK_VERSION in core/config.ts
 */

import type { PluginName, TrackerCore } from '../types';
import { BasePlugin } from './base';

// ────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────

/** Max recursion depth for JSON scanning (aggressive mode only) */
const MAX_SCAN_DEPTH = 4;
/** Max object keys to inspect per recursion level */
const MAX_KEYS_PER_LEVEL = 20;
/** Max storage value size to parse (bytes) — skip large blobs */
const MAX_STORAGE_VALUE_SIZE = 50_000;

/** Proper email regex — must have user@domain.tld (2+ char TLD) */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** localStorage key the plugin uses to remember the identified email across reloads. */
const STICKY_EMAIL_KEY = 'eutexa_idm';
/** localStorage key the plugin uses to remember which storage entry produced that email. */
const STICKY_SOURCE_KEY = 'eutexa_idm_src';
/** localStorage key the plugin uses to remember the identified group across reloads. */
const STICKY_GROUP_ID_KEY = 'eutexa_grp_id';
/** localStorage key the plugin uses to remember the identified group name across reloads. */
const STICKY_GROUP_NAME_KEY = 'eutexa_grp_name';

/** JWT/user object fields containing email */
const EMAIL_CLAIMS = ['email', 'preferred_username', 'user_email', 'mail', 'emailAddress', 'e_mail'];
const NAME_CLAIMS = ['name', 'full_name', 'display_name', 'displayName'];
const FIRST_NAME_CLAIMS = ['given_name', 'first_name', 'firstName', 'fname'];
const LAST_NAME_CLAIMS = ['family_name', 'last_name', 'lastName', 'lname'];

/** Rich-trait claim keys we lift out of JWTs / provider objects */
const AVATAR_CLAIMS = ['picture', 'avatar', 'avatar_url', 'avatarUrl', 'image', 'imageUrl', 'image_url', 'profile_picture', 'profilePicture'];
const ROLE_CLAIMS = ['role', 'roles', 'user_role', 'userRole'];
const PLAN_CLAIMS = ['plan', 'tier', 'subscription', 'subscription_tier', 'subscriptionTier', 'subscription_plan', 'subscriptionPlan'];
const LOCALE_CLAIMS = ['locale', 'language', 'lang'];

/** Claims we explicitly know how to handle — not duplicated into customFields. */
const STANDARD_JWT_CLAIMS = new Set([
    // RFC 7519 registered claims
    'iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti', 'azp', 'scope', 'scopes',
    // What we already extract above
    ...EMAIL_CLAIMS, ...NAME_CLAIMS, ...FIRST_NAME_CLAIMS, ...LAST_NAME_CLAIMS,
    ...AVATAR_CLAIMS, ...ROLE_CLAIMS, ...PLAN_CLAIMS, ...LOCALE_CLAIMS,
    // Group claims (handled separately)
    'org', 'org_id', 'orgId', 'organization', 'organization_id', 'organizationId',
    'organization_name', 'organizationName',
    'tenant', 'tenant_id', 'tenantId', 'tenant_name', 'tenantName',
    'account', 'account_id', 'accountId', 'account_name', 'accountName',
    'workspace', 'workspace_id', 'workspaceId', 'workspace_name', 'workspaceName',
    'company', 'company_id', 'companyId', 'company_name', 'companyName',
    // Provider-specific noise
    'primaryEmailAddress', 'emailAddresses', 'organizationMemberships',
    'username', 'user_id', 'userId', 'id', '_id',
]);

/**
 * Group ID claim keys — order matters: more-specific names first so we
 * pick `organization_id` over plain `id` when both are present.
 */
const GROUP_ID_CLAIMS = [
    'organization_id', 'organizationId',
    'tenant_id', 'tenantId',
    'workspace_id', 'workspaceId',
    'account_id', 'accountId',
    'company_id', 'companyId',
    'org_id', 'orgId',
    'org', 'organization',
    'tenant', 'workspace', 'account', 'company',
];

/** Group name claim keys, parallel to the ID list above. */
const GROUP_NAME_CLAIMS = [
    'organization_name', 'organizationName',
    'tenant_name', 'tenantName',
    'workspace_name', 'workspaceName',
    'account_name', 'accountName',
    'company_name', 'companyName',
];

/**
 * Personal email-domain blocklist. We never auto-create a Company in the
 * CRM from a personal email domain — that would mean every Gmail user
 * shows up as their own company. The list is intentionally conservative;
 * unrecognised domains are treated as B2B by default.
 */
const PERSONAL_EMAIL_DOMAINS = new Set([
    'gmail.com', 'googlemail.com',
    'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.fr', 'yahoo.de',
    'ymail.com', 'rocketmail.com',
    'hotmail.com', 'hotmail.co.uk', 'hotmail.fr',
    'outlook.com', 'outlook.in', 'live.com', 'msn.com',
    'icloud.com', 'me.com', 'mac.com',
    'aol.com', 'gmx.com', 'gmx.de', 'gmx.net',
    'protonmail.com', 'proton.me', 'pm.me',
    'mail.com', 'zoho.com', 'fastmail.com', 'fastmail.fm',
    'yandex.com', 'yandex.ru',
    'qq.com', '163.com', '126.com', 'sina.com', 'sina.cn',
    'naver.com', 'daum.net',
    'rediffmail.com', 'tutanota.com', 'tuta.io', 'mailinator.com',
    'duck.com', 'duckduckgo.com',
]);

/** Known auth cookie name patterns */
const AUTH_COOKIE_PATTERNS = [
    '__session', '__clerk_db_jwt',
    'next-auth.session-token', '__Secure-next-auth.session-token',
    'sb-access-token',
    'auth0.is.authenticated',
    'KEYCLOAK_SESSION', 'KEYCLOAK_IDENTITY', 'KC_RESTART',
    'token', 'jwt', 'access_token', 'session_token', 'auth_token', 'id_token',
];

/** localStorage / sessionStorage key patterns that probably hold auth state */
const STORAGE_KEY_PATTERNS = [
    'sb-', 'supabase.auth.', 'firebase:authUser:', 'auth0spajs', '@@auth0spajs@@',
    'msal.', 'msal.account',
    'CognitoIdentityServiceProvider', 'amplify-signin-with-hostedUI',
    'kc-callback-',
    'persist:', '-storage',
    'token', 'jwt', 'auth', 'user', 'session', 'credential', 'account',
];

/**
 * Storage keys belonging to common third-party SDKs that often store the
 * current visitor's email or a support agent's email. We MUST skip these
 * even though they match `STORAGE_KEY_PATTERNS` — pre-1.8.0 the SDK was
 * picking these up and identifying real visitors as the wrong user.
 *
 * Substring match, case-insensitive.
 */
const THIRD_PARTY_SDK_BLOCKLIST = [
    // Customer support / messaging
    'intercom-', 'intercom_', 'crisp-client', 'tawk-', 'drift-',
    'helpcrunch', 'olark', 'zendesk', 'freshchat', 'livechat',
    'pylon-', 'frontapp-',
    // Analytics / session replay
    'fs-', 'fullstory', '_fs_', 'mixpanel', 'amplitude', 'mp_',
    'heap-', 'logrocket', 'hotjar', '_hjUser', 'pendo', 'pendo_meta',
    'userpilot', 'appcues', 'productfruits',
    // CRM widgets
    'hubspot', 'hubspotutk', '__hssc', '__hstc', '__hssrc', '_hsq',
    'salesforce', 'liveperson',
    // Tag managers / ad attribution
    '_ga', '_gid', '_gcl_', '_fbp', '_fbc', 'gtm-', 'klaviyo',
    'mautic', 'marketo',
    // Feature flags / experimentation
    'optimizely', 'split-', 'launchdarkly', 'statsig-',
];

/** Polling schedule (ms) — exponential backoff then a slower long-tail. */
const POLL_SCHEDULE = [
    2_000, 5_000, 10_000, 10_000, 30_000, 30_000, 30_000,
    60_000, 60_000, 60_000,
    300_000, 300_000, 300_000, 300_000, 300_000,
];

type IdentifiedUser = {
    email: string;
    firstName?: string;
    lastName?: string;
    /** Avatar / profile picture URL (lifted from JWT `picture`, `avatar`, etc.) */
    avatar?: string;
    /** User role / list of roles (string or comma-joined). */
    role?: string;
    /** Subscription plan / tier. */
    plan?: string;
    /** BCP47 / 2-letter locale. */
    locale?: string;
    /** Anything custom in the JWT that isn't a standard claim ends up here. */
    customFields?: Record<string, unknown>;
};

type ExtractedGroup = {
    id: string;
    name?: string;
    /** Extra group traits (plan, billing tier, slug, etc.). */
    traits?: Record<string, unknown>;
};

type Candidate = IdentifiedUser & {
    /** Higher score = more likely to be the real user. */
    score: number;
    /** Storage key (or `cookie:<name>`, or `provider:<name>`) where this came from. */
    source: string;
    /** Group/company association if we found one alongside this user. */
    group?: ExtractedGroup;
};

type AutoIdentifyMode = 'auto' | 'providers' | 'aggressive' | 'off';
type AutoGroupMode = 'auto' | 'jwt' | 'domain' | 'off';

export class AutoIdentifyPlugin extends BasePlugin {
    name: PluginName = 'autoIdentify';

    private mode: AutoIdentifyMode = 'auto';
    private groupMode: AutoGroupMode = 'auto';
    private pollTimeouts: ReturnType<typeof setTimeout>[] = [];
    private identifiedEmail: string | null = null;
    private identifiedGroupId: string | null = null;
    /** Source key of whatever produced the current identifiedEmail, used by auto-logout. */
    private identifiedSource: string | null = null;

    private storageHandler: ((event: StorageEvent) => void) | null = null;
    private identifyHookHandler: ((event: Event) => void) | null = null;
    private groupHookHandler: ((event: Event) => void) | null = null;
    private logoutHookHandler: (() => void) | null = null;
    private sessionProbed = false;

    init(tracker: TrackerCore): void {
        super.init(tracker);

        if (typeof window === 'undefined') return;

        const cfg: any = tracker.getConfig?.() || {};
        const requestedMode: AutoIdentifyMode = cfg.autoIdentifyMode ?? 'auto';
        this.mode = requestedMode;
        const requestedGroupMode: AutoGroupMode = cfg.autoGroupMode ?? 'auto';
        this.groupMode = requestedGroupMode;

        if (this.mode === 'off') return;

        // Manual hook — apps can dispatch CustomEvent('eutexa:identify', { detail: {...} })
        this.identifyHookHandler = (event: Event) => {
            const detail = (event as CustomEvent)?.detail;
            if (!detail || typeof detail !== 'object') return;
            const email = detail.email;
            if (typeof email !== 'string' || !this.isValidEmail(email)) return;

            const traits: IdentifiedUser = { email };
            if (typeof detail.firstName === 'string') traits.firstName = detail.firstName;
            if (typeof detail.lastName === 'string') traits.lastName = detail.lastName;
            if (typeof detail.avatar === 'string') traits.avatar = detail.avatar;
            if (typeof detail.role === 'string') traits.role = detail.role;
            if (typeof detail.plan === 'string') traits.plan = detail.plan;
            if (typeof detail.locale === 'string') traits.locale = detail.locale;
            if (detail.customFields && typeof detail.customFields === 'object') {
                traits.customFields = detail.customFields;
            }

            this.commit({
                ...traits,
                score: 1000, // manual hook always wins
                source: 'event:eutexa:identify',
                group: this.extractGroupFromManualDetail(detail) ?? undefined,
            });
        };
        window.addEventListener('eutexa:identify', this.identifyHookHandler);

        // Manual group hook — apps can dispatch CustomEvent('eutexa:group', { detail: { id, name, traits } })
        this.groupHookHandler = (event: Event) => {
            const detail = (event as CustomEvent)?.detail;
            const group = this.extractGroupFromManualDetail(detail);
            if (!group || !this.tracker || this.groupMode === 'off') return;

            this.commitGroup(group);
        };
        window.addEventListener('eutexa:group', this.groupHookHandler);

        // Manual logout hook
        this.logoutHookHandler = () => this.handleLogout('event:eutexa:logout');
        window.addEventListener('eutexa:logout', this.logoutHookHandler);

        // 0. Restore sticky identification — if we identified a user on a previous
        //    page load, prefer them immediately. This eliminates flapping between
        //    candidates when both Clerk and a JWT exist with different staleness.
        if (this.mode === 'auto' || this.mode === 'aggressive') {
            this.restoreSticky();
        }

        // Schedule poll checks
        this.schedulePollChecks();

        // Storage events — for cross-tab logins AND for logout detection.
        this.listenForStorageChanges();
    }

    destroy(): void {
        for (const t of this.pollTimeouts) clearTimeout(t);
        this.pollTimeouts = [];

        if (typeof window !== 'undefined') {
            if (this.storageHandler) {
                window.removeEventListener('storage', this.storageHandler);
                this.storageHandler = null;
            }
            if (this.identifyHookHandler) {
                window.removeEventListener('eutexa:identify', this.identifyHookHandler);
                this.identifyHookHandler = null;
            }
            if (this.groupHookHandler) {
                window.removeEventListener('eutexa:group', this.groupHookHandler);
                this.groupHookHandler = null;
            }
            if (this.logoutHookHandler) {
                window.removeEventListener('eutexa:logout', this.logoutHookHandler);
                this.logoutHookHandler = null;
            }
        }

        super.destroy();
    }

    // ════════════════════════════════════════════════
    // Sticky identification
    // ════════════════════════════════════════════════

    private restoreSticky(): void {
        try {
            if (typeof localStorage === 'undefined') return;
            const stickyEmail = localStorage.getItem(STICKY_EMAIL_KEY);
            const stickySource = localStorage.getItem(STICKY_SOURCE_KEY);
            const stickyGroupId = localStorage.getItem(STICKY_GROUP_ID_KEY);
            const stickyGroupName = localStorage.getItem(STICKY_GROUP_NAME_KEY);

            if (stickyEmail && this.isValidEmail(stickyEmail)) {
                this.identifiedEmail = stickyEmail;
                this.identifiedSource = stickySource;
                if (this.tracker) {
                    this.tracker.identify(stickyEmail, {});
                }
                // Cancel pending polls — we've got our user.
                for (const t of this.pollTimeouts) clearTimeout(t);
                this.pollTimeouts = [];
            }

            if (stickyGroupId && this.tracker && this.groupMode !== 'off') {
                this.identifiedGroupId = stickyGroupId;
                try {
                    this.tracker.group(stickyGroupId, stickyGroupName ? { name: stickyGroupName } : {});
                } catch { /* group error */ }
            }
        } catch { /* localStorage blocked */ }
    }

    private persistSticky(email: string, source: string): void {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(STICKY_EMAIL_KEY, email);
            localStorage.setItem(STICKY_SOURCE_KEY, source);
        } catch { /* localStorage blocked */ }
    }

    private persistStickyGroup(group: ExtractedGroup): void {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.setItem(STICKY_GROUP_ID_KEY, group.id);
            if (group.name) localStorage.setItem(STICKY_GROUP_NAME_KEY, group.name);
            else localStorage.removeItem(STICKY_GROUP_NAME_KEY);
        } catch { /* localStorage blocked */ }
    }

    private clearSticky(): void {
        try {
            if (typeof localStorage === 'undefined') return;
            localStorage.removeItem(STICKY_EMAIL_KEY);
            localStorage.removeItem(STICKY_SOURCE_KEY);
            localStorage.removeItem(STICKY_GROUP_ID_KEY);
            localStorage.removeItem(STICKY_GROUP_NAME_KEY);
        } catch { /* localStorage blocked */ }
    }

    // ════════════════════════════════════════════════
    // Scheduling
    // ════════════════════════════════════════════════

    private schedulePollChecks(): void {
        for (const t of this.pollTimeouts) clearTimeout(t);
        this.pollTimeouts = [];

        let cumulativeDelay = 0;
        for (let i = 0; i < POLL_SCHEDULE.length; i++) {
            cumulativeDelay += POLL_SCHEDULE[i];
            const timeout = setTimeout(() => {
                if (this.identifiedEmail) return;
                try { this.runScan(); } catch { /* silently fail */ }

                // NextAuth probe (auto and aggressive only) on the 4th tick (~27s)
                if ((this.mode === 'auto' || this.mode === 'aggressive')
                    && i === 3 && !this.sessionProbed) {
                    this.sessionProbed = true;
                    this.guardedSessionProbe();
                }
            }, cumulativeDelay);
            this.pollTimeouts.push(timeout);
        }
    }

    /**
     * Listen for storage events. Used for two things at once:
     *   - cross-tab login detection (auth key appears / changes)
     *   - cross-tab AND same-tab logout detection (auth key removed / cleared)
     *
     * Note: same-tab `localStorage.setItem` does NOT fire storage events. For
     * same-tab logins we still need polling. For same-tab logouts most auth
     * libraries also call `localStorage.clear()` or `removeItem()` which DO
     * fire on listeners attached BEFORE the call — but only for changes from
     * OTHER tabs. So same-tab logout detection is best-effort.
     */
    private listenForStorageChanges(): void {
        this.storageHandler = (event: StorageEvent) => {
            if (!event.key) return;

            const keyLower = event.key.toLowerCase();
            const isAuthKey = STORAGE_KEY_PATTERNS.some(p => keyLower.includes(p.toLowerCase()));
            if (!isAuthKey) return;
            if (this.isThirdPartySdkKey(event.key)) return;

            // Logout detection — auth key was removed or cleared
            if ((event.newValue === null || event.newValue === '') && this.identifiedEmail) {
                // If THIS specific source is what we identified from, definitely a logout.
                // If it's a different auth key, still likely a logout (most auth systems
                // clear all their keys at once).
                if (!this.identifiedSource || this.identifiedSource === `storage:${event.key}`) {
                    this.handleLogout(`storage:${event.key}`);
                    return;
                }
                this.handleLogout(`storage:${event.key}`);
                return;
            }

            // Login detection — fresh value in an auth key
            if (event.newValue && !this.identifiedEmail) {
                try { this.runScan(); } catch { /* silently fail */ }
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', this.storageHandler);
        }
    }

    // ════════════════════════════════════════════════
    // Logout
    // ════════════════════════════════════════════════

    private handleLogout(reason: string): void {
        this.identifiedEmail = null;
        this.identifiedGroupId = null;
        this.identifiedSource = null;
        this.sessionProbed = false;
        this.clearSticky();

        if (this.tracker) {
            try { this.tracker.reset(); } catch { /* tracker.reset throws? swallow. */ }
        }

        // Re-arm polls so the next user on this browser gets identified.
        this.schedulePollChecks();

        // Surface the logout to the rest of the page in case other code wants it.
        if (typeof window !== 'undefined' && reason !== 'event:eutexa:logout') {
            try {
                window.dispatchEvent(new Event('eutexa:logout'));
            } catch { /* CustomEvent unsupported (very old browsers) */ }
        }
    }

    // ════════════════════════════════════════════════
    // Scan pipeline
    // ════════════════════════════════════════════════

    private runScan(): void {
        if (!this.tracker || this.identifiedEmail || this.mode === 'off') return;

        const candidates: Candidate[] = [];

        // 1. Provider globals — always run, regardless of mode.
        try {
            const providerCandidates = this.scanAuthProviders();
            candidates.push(...providerCandidates);
        } catch { /* provider scan failed */ }

        if (this.mode !== 'providers') {
            // 2. Cookies — JWT-only by default, plain decoded by aggressive.
            try {
                candidates.push(...this.scanCookies());
            } catch { /* cookie access blocked */ }

            // 3. Storage — JWT-only in 'auto', plain-JSON deep scan in 'aggressive'.
            try {
                if (typeof localStorage !== 'undefined') {
                    candidates.push(...this.scanStorage(localStorage, 'localStorage'));
                }
            } catch { /* localStorage access blocked */ }
            try {
                if (typeof sessionStorage !== 'undefined') {
                    candidates.push(...this.scanStorage(sessionStorage, 'sessionStorage'));
                }
            } catch { /* sessionStorage access blocked */ }
        }

        if (candidates.length === 0) return;

        // Pick the highest-scoring candidate, with stickiness as a tiebreaker
        // toward whoever we already identified before.
        const best = this.pickBestCandidate(candidates);
        if (best) this.commit(best);
    }

    private pickBestCandidate(candidates: Candidate[]): Candidate | null {
        if (candidates.length === 0) return null;
        // Stable sort by score desc; among equals prefer providers > cookies > storage.
        return candidates.slice().sort((a, b) => b.score - a.score)[0];
    }

    // ════════════════════════════════════════════════
    // Provider globals — always-on
    // ════════════════════════════════════════════════

    private scanAuthProviders(): Candidate[] {
        const win = window as any;
        const out: Candidate[] = [];

        // Clerk
        try {
            const clerkUser = win.Clerk?.user;
            if (clerkUser) {
                const email = clerkUser.primaryEmailAddress?.emailAddress
                    || clerkUser.emailAddresses?.[0]?.emailAddress;
                if (email && this.isValidEmail(email)) {
                    // Clerk org — first organization the user belongs to
                    const clerkOrg = clerkUser.organizationMemberships?.[0]?.organization
                        || (win.Clerk?.organization ?? null);
                    const group: ExtractedGroup | undefined = clerkOrg?.id ? {
                        id: String(clerkOrg.id),
                        name: clerkOrg.name ? String(clerkOrg.name) : undefined,
                        traits: clerkOrg.slug ? { slug: clerkOrg.slug } : undefined,
                    } : undefined;
                    out.push({
                        email,
                        firstName: clerkUser.firstName || undefined,
                        lastName: clerkUser.lastName || undefined,
                        avatar: typeof clerkUser.imageUrl === 'string' ? clerkUser.imageUrl
                            : typeof clerkUser.profileImageUrl === 'string' ? clerkUser.profileImageUrl
                            : undefined,
                        score: this.scoreCandidate(email, 'provider:clerk'),
                        source: 'provider:clerk',
                        group,
                    });
                }
            }
        } catch { /* Clerk not available */ }

        // Firebase
        try {
            const fbAuth = win.firebase?.auth?.();
            const fbUser = fbAuth?.currentUser;
            if (fbUser?.email && this.isValidEmail(fbUser.email)) {
                const parts = (fbUser.displayName || '').split(' ');
                out.push({
                    email: fbUser.email,
                    firstName: parts[0] || undefined,
                    lastName: parts.slice(1).join(' ') || undefined,
                    score: this.scoreCandidate(fbUser.email, 'provider:firebase'),
                    source: 'provider:firebase',
                });
            }
        } catch { /* Firebase not available */ }

        // Supabase
        try {
            const sbClient = win.__SUPABASE_CLIENT__ || win.supabase;
            if (sbClient?.auth) {
                const session = sbClient.auth.session?.() || sbClient.auth.getSession?.();
                const user = session?.data?.session?.user || session?.user;
                if (user?.email && this.isValidEmail(user.email)) {
                    const meta = user.user_metadata || {};
                    out.push({
                        email: user.email,
                        firstName: meta.first_name || meta.full_name?.split(' ')[0] || undefined,
                        lastName: meta.last_name || meta.full_name?.split(' ').slice(1).join(' ') || undefined,
                        score: this.scoreCandidate(user.email, 'provider:supabase'),
                        source: 'provider:supabase',
                    });
                }
            }
        } catch { /* Supabase not available */ }

        // Auth0 SPA
        try {
            const auth0 = win.__auth0Client || win.auth0Client;
            if (auth0?.isAuthenticated?.()) {
                const user = auth0.getUser?.();
                if (user?.email && this.isValidEmail(user.email)) {
                    const group = this.extractGroupFromClaims(user) ?? undefined;
                    out.push({
                        email: user.email,
                        firstName: user.given_name || user.name?.split(' ')[0] || undefined,
                        lastName: user.family_name || user.name?.split(' ').slice(1).join(' ') || undefined,
                        avatar: typeof user.picture === 'string' ? user.picture : undefined,
                        score: this.scoreCandidate(user.email, 'provider:auth0'),
                        source: 'provider:auth0',
                        group,
                    });
                }
            }
        } catch { /* Auth0 not available */ }

        // Google Identity Services / gapi
        try {
            const gisCredential = win.__google_credential_response?.credential;
            if (gisCredential && typeof gisCredential === 'string') {
                const u = this.extractUserFromToken(gisCredential, true);
                if (u) {
                    out.push({
                        ...u,
                        score: this.scoreCandidate(u.email, 'provider:google'),
                        source: 'provider:google',
                    });
                }
            }
            const gapiUser = win.gapi?.auth2?.getAuthInstance?.()?.currentUser?.get?.();
            const profile = gapiUser?.getBasicProfile?.();
            if (profile) {
                const email = profile.getEmail?.();
                if (email && this.isValidEmail(email)) {
                    out.push({
                        email,
                        firstName: profile.getGivenName?.() || undefined,
                        lastName: profile.getFamilyName?.() || undefined,
                        score: this.scoreCandidate(email, 'provider:gapi'),
                        source: 'provider:gapi',
                    });
                }
            }
        } catch { /* Google auth not available */ }

        // MSAL
        try {
            const msalInstance = win.msalInstance || win.__msalInstance;
            if (msalInstance) {
                const accounts = msalInstance.getAllAccounts?.() || [];
                const account = accounts[0];
                if (account?.username && this.isValidEmail(account.username)) {
                    const nameParts = (account.name || '').split(' ');
                    // MSAL puts the Azure AD tenant ID on `tenantId`
                    const tenantId = account.tenantId || account.idTokenClaims?.tid;
                    const group: ExtractedGroup | undefined = tenantId ? {
                        id: String(tenantId),
                        name: account.idTokenClaims?.tenant_name || undefined,
                    } : undefined;
                    out.push({
                        email: account.username,
                        firstName: nameParts[0] || undefined,
                        lastName: nameParts.slice(1).join(' ') || undefined,
                        score: this.scoreCandidate(account.username, 'provider:msal'),
                        source: 'provider:msal',
                        group,
                    });
                }
            }
        } catch { /* MSAL not available */ }

        // AWS Cognito / Amplify
        try {
            const amplifyUser = win.aws_amplify_currentUser || win.__amplify_user;
            if (amplifyUser?.signInDetails?.loginId && this.isValidEmail(amplifyUser.signInDetails.loginId)) {
                out.push({
                    email: amplifyUser.signInDetails.loginId,
                    firstName: amplifyUser.attributes?.given_name || undefined,
                    lastName: amplifyUser.attributes?.family_name || undefined,
                    score: this.scoreCandidate(amplifyUser.signInDetails.loginId, 'provider:cognito'),
                    source: 'provider:cognito',
                });
            }
            if (typeof localStorage !== 'undefined') {
                const cognitoUser = this.checkCognitoStorage();
                if (cognitoUser) {
                    out.push({
                        ...cognitoUser,
                        score: this.scoreCandidate(cognitoUser.email, 'provider:cognito-storage'),
                        source: 'provider:cognito-storage',
                    });
                }
            }
        } catch { /* Cognito/Amplify not available */ }

        // Keycloak
        try {
            const keycloak = win.keycloak || win.Keycloak;
            if (keycloak?.authenticated && keycloak.tokenParsed) {
                const claims = keycloak.tokenParsed;
                const email = claims.email || claims.preferred_username;
                if (email && this.isValidEmail(email)) {
                    const group = this.extractGroupFromClaims(claims) ?? undefined;
                    out.push({
                        email,
                        firstName: claims.given_name || undefined,
                        lastName: claims.family_name || undefined,
                        score: this.scoreCandidate(email, 'provider:keycloak'),
                        source: 'provider:keycloak',
                        group,
                    });
                }
            }
        } catch { /* Keycloak not available */ }

        // window.__eutexa_user — universal escape hatch
        try {
            const manualUser = win.__eutexa_user;
            if (manualUser?.email && typeof manualUser.email === 'string' && this.isValidEmail(manualUser.email)) {
                const traits: IdentifiedUser = this.extractUserFromClaims(manualUser) ?? { email: manualUser.email };
                const group = this.extractGroupFromManualDetail(manualUser) ?? this.extractGroupFromClaims(manualUser) ?? undefined;
                out.push({
                    ...traits,
                    email: manualUser.email,
                    firstName: typeof manualUser.firstName === 'string' ? manualUser.firstName : traits.firstName,
                    lastName: typeof manualUser.lastName === 'string' ? manualUser.lastName : traits.lastName,
                    score: 1000, // manual override always wins
                    source: 'global:__eutexa_user',
                    group,
                });
            }
        } catch { /* manual user not set */ }

        // window.__eutexa_group — explicit group escape hatch (fires alongside whatever
        // user is detected). We push a "userless" candidate scored 0, so it doesn't
        // win identify but DOES surface the group in pickBestCandidate's chosen entry
        // when that entry has no group of its own. We handle this in pickBestCandidate.
        // (The runScan loop later merges any standalone group into the winning user.)
        return out;
    }

    /**
     * Pull a standalone group from `window.__eutexa_group` — used when the
     * customer can give us the group but the user is detected separately.
     */
    private scanStandaloneGroup(): ExtractedGroup | null {
        if (typeof window === 'undefined') return null;
        try {
            const g = (window as any).__eutexa_group;
            if (g) {
                const fromGlobal = this.extractGroupFromManualDetail(g);
                if (fromGlobal) return fromGlobal;
            }
        } catch { /* global not set */ }
        return null;
    }

    // ════════════════════════════════════════════════
    // Cookie scan
    // ════════════════════════════════════════════════

    private scanCookies(): Candidate[] {
        if (typeof document === 'undefined') return [];
        const out: Candidate[] = [];
        try {
            const cookies = document.cookie.split(';').map(c => c.trim());
            for (const cookie of cookies) {
                const [name, ...valueParts] = cookie.split('=');
                const value = valueParts.join('=');
                const cookieName = name.trim().toLowerCase();
                if (!value) continue;

                if (this.isThirdPartySdkKey(name)) continue;

                const isAuthCookie = AUTH_COOKIE_PATTERNS.some(p => cookieName.includes(p.toLowerCase()));
                if (!isAuthCookie) continue;

                const decoded = (() => {
                    try { return decodeURIComponent(value); } catch { return value; }
                })();

                // 'auto' and 'aggressive' both do JWT decode here
                const u = this.extractUserFromToken(decoded, true);
                if (u) {
                    out.push({
                        ...u,
                        score: this.scoreCandidate(u.email, `cookie:${name}`),
                        source: `cookie:${name}`,
                    });
                }
            }
        } catch { /* cookie access blocked */ }
        return out;
    }

    // ════════════════════════════════════════════════
    // Storage scan
    // ════════════════════════════════════════════════

    private scanStorage(storage: Storage, label: string): Candidate[] {
        const out: Candidate[] = [];
        try {
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (!key) continue;
                if (this.isThirdPartySdkKey(key)) continue;

                const keyLower = key.toLowerCase();
                const isAuthKey = STORAGE_KEY_PATTERNS.some(p => keyLower.includes(p.toLowerCase()));
                if (!isAuthKey) continue;

                const value = storage.getItem(key);
                if (!value || value.length > MAX_STORAGE_VALUE_SIZE) continue;

                // 'auto' and 'aggressive' both try JWT decode first
                const tokenUser = this.extractUserFromToken(value, true);
                if (tokenUser) {
                    out.push({
                        ...tokenUser,
                        score: this.scoreCandidate(tokenUser.email, `${label}:${key}`),
                        source: `${label}:${key}`,
                    });
                    continue;
                }

                // Plain JSON deep scan — aggressive mode only
                if (this.mode === 'aggressive') {
                    try {
                        const json = JSON.parse(value);
                        const jsonUser = this.deepScanForUser(json, 0, true);
                        if (jsonUser) {
                            out.push({
                                ...jsonUser,
                                score: this.scoreCandidate(jsonUser.email, `${label}:${key}`),
                                source: `${label}:${key}`,
                            });
                        }
                    } catch { /* not JSON, skip */ }
                }
            }
        } catch { /* storage access blocked */ }
        return out;
    }

    // ════════════════════════════════════════════════
    // Deep recursive scanning (aggressive mode)
    // ════════════════════════════════════════════════

    private deepScanForUser(data: unknown, depth: number, validateJwt: boolean): (IdentifiedUser & { group?: ExtractedGroup }) | null {
        if (depth > MAX_SCAN_DEPTH || !data || typeof data !== 'object' || Array.isArray(data)) {
            return null;
        }
        const obj = data as Record<string, any>;
        const keys = Object.keys(obj);

        const direct = this.extractUserFromClaims(obj);
        if (direct) {
            const group = this.extractGroupFromClaims(obj);
            return group ? { ...direct, group } : direct;
        }

        const keysToScan = keys.slice(0, MAX_KEYS_PER_LEVEL);

        // JWT strings at this level
        for (const key of keysToScan) {
            const val = obj[key];
            if (typeof val === 'string' && val.length > 30 && val.length < 4000) {
                const dotCount = (val.match(/\./g) || []).length;
                if (dotCount === 2) {
                    const tokenUser = this.extractUserFromToken(val, validateJwt);
                    if (tokenUser) return tokenUser;
                }
            }
        }

        for (const key of keysToScan) {
            const val = obj[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                const nested = this.deepScanForUser(val, depth + 1, validateJwt);
                if (nested) return nested;
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════
    // Token & claims extraction
    // ════════════════════════════════════════════════

    private extractUserFromToken(token: string, validateFreshness: boolean): (IdentifiedUser & { group?: ExtractedGroup }) | null {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        try {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

            if (validateFreshness && !this.isJwtFresh(payload)) return null;

            const user = this.extractUserFromClaims(payload);
            if (!user) return null;

            const group = this.extractGroupFromClaims(payload);
            if (group) return { ...user, group };
            return user;
        } catch {
            return null;
        }
    }

    /**
     * SAFEGUARD #1: Token freshness.
     * - exp must be in the future (token not expired)
     * - iat must be within the last 30 days (no stale leftover token)
     */
    private isJwtFresh(payload: any): boolean {
        const nowSec = Math.floor(Date.now() / 1000);
        const thirtyDaysSec = 30 * 24 * 60 * 60;

        if (typeof payload.exp === 'number' && payload.exp <= nowSec) return false;
        if (typeof payload.iat === 'number' && nowSec - payload.iat > thirtyDaysSec) return false;
        return true;
    }

    private extractUserFromClaims(claims: Record<string, any>): IdentifiedUser | null {
        if (!claims || typeof claims !== 'object') return null;

        let email: string | null = null;
        for (const claim of EMAIL_CLAIMS) {
            const value = claims[claim];
            if (value && typeof value === 'string' && this.isValidEmail(value)) {
                email = value;
                break;
            }
        }
        if (!email) {
            const nestedEmail = claims.primaryEmailAddress?.emailAddress
                || claims.emailAddresses?.[0]?.emailAddress;
            if (nestedEmail && typeof nestedEmail === 'string' && this.isValidEmail(nestedEmail)) {
                email = nestedEmail;
            }
        }
        if (!email) return null;

        let firstName: string | undefined;
        let lastName: string | undefined;
        for (const claim of FIRST_NAME_CLAIMS) {
            if (claims[claim] && typeof claims[claim] === 'string') { firstName = claims[claim]; break; }
        }
        for (const claim of LAST_NAME_CLAIMS) {
            if (claims[claim] && typeof claims[claim] === 'string') { lastName = claims[claim]; break; }
        }
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

        // Rich traits — picked up so they propagate to CRM customFields
        const avatar = this.firstString(claims, AVATAR_CLAIMS);
        const role = this.firstStringOrArray(claims, ROLE_CLAIMS);
        const plan = this.firstString(claims, PLAN_CLAIMS);
        const locale = this.firstString(claims, LOCALE_CLAIMS);

        // Anything we didn't explicitly map gets preserved as customFields,
        // so e.g. `is_admin`, `team_id`, `signup_date` flow through to the CRM.
        const customFields: Record<string, unknown> = {};
        for (const key of Object.keys(claims)) {
            if (STANDARD_JWT_CLAIMS.has(key)) continue;
            const v = claims[key];
            // Preserve only primitives + simple arrays of primitives — no nested objects
            // (those would be auth-provider state we don't want polluting CRM custom fields).
            if (v === null) continue;
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                customFields[key] = v;
            } else if (Array.isArray(v) && v.every(x => ['string', 'number', 'boolean'].includes(typeof x))) {
                customFields[key] = v;
            }
        }

        const out: IdentifiedUser = { email, firstName, lastName };
        if (avatar) out.avatar = avatar;
        if (role) out.role = role;
        if (plan) out.plan = plan;
        if (locale) out.locale = locale;
        if (Object.keys(customFields).length > 0) out.customFields = customFields;
        return out;
    }

    /**
     * Pull a group association out of a JWT claims object. We look for the
     * usual organization / tenant / workspace / account / company id+name
     * pairs, and as a special case Clerk's nested `organizationMemberships`.
     */
    private extractGroupFromClaims(claims: Record<string, any>): ExtractedGroup | null {
        if (!claims || typeof claims !== 'object') return null;
        if (this.groupMode === 'off' || this.groupMode === 'domain') return null;

        // Clerk JWT shape (also used by some custom Clerk integrations)
        const clerkOrg = claims.organizationMemberships?.[0]?.organization;
        if (clerkOrg?.id) {
            return {
                id: String(clerkOrg.id),
                name: clerkOrg.name ? String(clerkOrg.name) : undefined,
                traits: clerkOrg.slug ? { slug: clerkOrg.slug } : undefined,
            };
        }

        // Direct claim pairs
        let groupId: string | null = null;
        for (const k of GROUP_ID_CLAIMS) {
            const v = claims[k];
            if (v == null) continue;
            if (typeof v === 'string' && v.length > 0) { groupId = v; break; }
            if (typeof v === 'number') { groupId = String(v); break; }
        }
        if (!groupId) return null;

        let groupName: string | undefined;
        for (const k of GROUP_NAME_CLAIMS) {
            const v = claims[k];
            if (typeof v === 'string' && v.length > 0) { groupName = v; break; }
        }

        return { id: groupId, name: groupName };
    }

    /**
     * Derive a group from the email domain. Skips personal-email domains so
     * a Gmail user doesn't end up in their own one-person company.
     */
    private extractGroupFromEmailDomain(email: string): ExtractedGroup | null {
        if (this.groupMode === 'off' || this.groupMode === 'jwt') return null;
        const domain = email.split('@')[1]?.toLowerCase().trim();
        if (!domain) return null;
        if (PERSONAL_EMAIL_DOMAINS.has(domain)) return null;

        // Use the domain as both the stable id (so the same company is
        // reused across users) and the name (the backend can pretty-print
        // it later).
        return { id: domain, name: domain, traits: { source: 'email-domain' } };
    }

    private extractGroupFromManualDetail(detail: any): ExtractedGroup | null {
        if (!detail || typeof detail !== 'object') return null;
        // Two shapes: either { id, name?, traits? } directly, or nested under a `group` key.
        const g = detail.group ?? detail;
        if (!g || typeof g !== 'object') return null;
        const id = g.id ?? g.groupId ?? g.organizationId ?? g.tenantId ?? g.accountId ?? g.workspaceId ?? g.companyId;
        if (id == null || (typeof id !== 'string' && typeof id !== 'number')) return null;
        const out: ExtractedGroup = { id: String(id) };
        if (typeof g.name === 'string') out.name = g.name;
        if (g.traits && typeof g.traits === 'object' && !Array.isArray(g.traits)) out.traits = g.traits;
        return out;
    }

    private firstString(claims: Record<string, any>, keys: string[]): string | undefined {
        for (const k of keys) {
            const v = claims[k];
            if (typeof v === 'string' && v.length > 0) return v;
        }
        return undefined;
    }

    private firstStringOrArray(claims: Record<string, any>, keys: string[]): string | undefined {
        for (const k of keys) {
            const v = claims[k];
            if (typeof v === 'string' && v.length > 0) return v;
            if (Array.isArray(v) && v.length > 0) return v.filter(x => typeof x === 'string').join(',');
        }
        return undefined;
    }

    // ════════════════════════════════════════════════
    // Candidate scoring
    // ════════════════════════════════════════════════

    /**
     * SAFEGUARD #3: Domain match preference.
     * SAFEGUARD #4 hook: stickiness wins over fresh scans.
     *
     * Higher = more likely to be the real user.
     * Base scores by source type:
     *   provider:* / global:__eutexa_user / event:eutexa:identify  → 100
     *   provider:cognito-storage                                      → 90
     *   cookie:*                                                      → 70
     *   localStorage:* / sessionStorage:*                             → 50
     * Bonuses:
     *   +15  email domain matches page hostname
     *   +25  email matches the sticky-cached email (we trust history)
     */
    private scoreCandidate(email: string, source: string): number {
        let base = 50;
        if (source.startsWith('provider:')) base = 100;
        else if (source.startsWith('global:')) base = 100;
        else if (source.startsWith('event:')) base = 100;
        else if (source.startsWith('cookie:')) base = 70;

        if (this.matchesPageDomain(email)) base += 15;

        try {
            const sticky = (typeof localStorage !== 'undefined')
                ? localStorage.getItem(STICKY_EMAIL_KEY)
                : null;
            if (sticky && sticky.toLowerCase() === email.toLowerCase()) base += 25;
        } catch { /* localStorage blocked */ }

        return base;
    }

    private matchesPageDomain(email: string): boolean {
        try {
            if (typeof location === 'undefined') return false;
            const emailDomain = email.split('@')[1]?.toLowerCase();
            if (!emailDomain) return false;
            const hostname = location.hostname.toLowerCase().replace(/^www\./, '');
            return emailDomain === hostname || hostname.endsWith('.' + emailDomain) || emailDomain.endsWith('.' + hostname);
        } catch {
            return false;
        }
    }

    // ════════════════════════════════════════════════
    // SAFEGUARD #2: Third-party SDK blocklist
    // ════════════════════════════════════════════════

    private isThirdPartySdkKey(key: string): boolean {
        const k = key.toLowerCase();
        for (const pattern of THIRD_PARTY_SDK_BLOCKLIST) {
            if (k.includes(pattern.toLowerCase())) return true;
        }
        return false;
    }

    // ════════════════════════════════════════════════
    // Commit a winning candidate
    // ════════════════════════════════════════════════

    private commit(c: Candidate): void {
        if (!this.tracker) return;
        // No-op if same email already identified
        if (this.identifiedEmail && this.identifiedEmail.toLowerCase() === c.email.toLowerCase()) {
            // We may still need to commit the group if it appeared after the user did.
            this.maybeCommitGroupForEmail(c);
            return;
        }

        this.identifiedEmail = c.email;
        this.identifiedSource = c.source;
        this.persistSticky(c.email, c.source);

        // Build the trait payload, including the rich claims and any customFields.
        const traits: Record<string, unknown> = {};
        if (c.firstName) traits.firstName = c.firstName;
        if (c.lastName) traits.lastName = c.lastName;
        if (c.avatar) traits.avatar = c.avatar;
        if (c.role) traits.role = c.role;
        if (c.plan) traits.plan = c.plan;
        if (c.locale) traits.locale = c.locale;
        if (c.customFields && Object.keys(c.customFields).length > 0) {
            traits.customFields = c.customFields;
        }

        try {
            this.tracker.identify(c.email, traits);
        } catch { /* identify error */ }

        // Auto-group: prefer the explicit group on this candidate; fall back
        // to a standalone __eutexa_group global; fall back to the email
        // domain (skipping personal domains).
        this.maybeCommitGroupForEmail(c);

        // Cancel any pending polls
        for (const t of this.pollTimeouts) clearTimeout(t);
        this.pollTimeouts = [];
    }

    /**
     * Decide whether to call tracker.group() for the user we just identified.
     * Order of preference:
     *   1. The candidate's own `group` field (came from JWT/provider).
     *   2. `window.__eutexa_group` global.
     *   3. The user's email domain (only when groupMode is 'auto' or 'domain').
     */
    private maybeCommitGroupForEmail(c: Candidate): void {
        if (this.groupMode === 'off') return;
        if (!this.tracker) return;

        const standalone = this.scanStandaloneGroup();
        const group: ExtractedGroup | null =
            c.group
            || standalone
            || this.extractGroupFromEmailDomain(c.email)
            || null;

        if (!group) return;
        this.commitGroup(group);
    }

    private commitGroup(group: ExtractedGroup): void {
        if (!this.tracker || !group?.id) return;
        if (this.identifiedGroupId === group.id) return; // already grouped

        this.identifiedGroupId = group.id;
        this.persistStickyGroup(group);

        const traits: Record<string, unknown> = {};
        if (group.name) traits.name = group.name;
        if (group.traits) Object.assign(traits, group.traits);

        try {
            this.tracker.group(group.id, traits);
        } catch { /* group error */ }
    }

    // ════════════════════════════════════════════════
    // NextAuth probe — auto and aggressive only
    // ════════════════════════════════════════════════

    private async guardedSessionProbe(): Promise<void> {
        if (this.identifiedEmail) return;

        const hasNextAuthCookie = typeof document !== 'undefined' &&
            (document.cookie.includes('next-auth.session-token') ||
                document.cookie.includes('__Secure-next-auth.session-token'));
        const hasNextAuthGlobal = typeof window !== 'undefined' &&
            ((window as any).__NEXTAUTH != null || (window as any).__NEXT_DATA__ != null);

        if (!hasNextAuthCookie && !hasNextAuthGlobal) return;

        try {
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' },
            });
            if (response.ok) {
                const body = await response.json();
                if (body && typeof body === 'object' && Object.keys(body).length > 0) {
                    const u = this.deepScanForUser(body, 0, false);
                    if (u) {
                        this.commit({
                            ...u,
                            score: this.scoreCandidate(u.email, 'provider:nextauth-probe'),
                            source: 'provider:nextauth-probe',
                        });
                    }
                }
            }
        } catch { /* endpoint failed */ }
    }

    // ════════════════════════════════════════════════
    // Cognito storage scan
    // ════════════════════════════════════════════════

    private checkCognitoStorage(): (IdentifiedUser & { group?: ExtractedGroup }) | null {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;

                if (key.startsWith('CognitoIdentityServiceProvider.') && key.endsWith('.idToken')) {
                    const value = localStorage.getItem(key);
                    if (value && value.length < MAX_STORAGE_VALUE_SIZE) {
                        const u = this.extractUserFromToken(value, true);
                        if (u) return u;
                    }
                }
                if (key.startsWith('CognitoIdentityServiceProvider.') && key.endsWith('.userData')) {
                    const value = localStorage.getItem(key);
                    if (value && value.length < MAX_STORAGE_VALUE_SIZE) {
                        try {
                            const data = JSON.parse(value);
                            const attrs = data.UserAttributes || data.attributes || [];
                            const emailAttr = attrs.find?.((a: any) => a.Name === 'email' || a.name === 'email');
                            if (emailAttr?.Value && this.isValidEmail(emailAttr.Value)) {
                                const nameAttr = attrs.find?.((a: any) => a.Name === 'name' || a.name === 'name');
                                const givenNameAttr = attrs.find?.((a: any) => a.Name === 'given_name' || a.name === 'given_name');
                                const familyNameAttr = attrs.find?.((a: any) => a.Name === 'family_name' || a.name === 'family_name');
                                // Cognito custom attributes (e.g. `custom:organization_id`,
                                // `custom:tenant_id`, `custom:company_id`) are how multi-tenant
                                // Cognito apps tag a user with their org. Pick the first match.
                                const orgIdAttr = attrs.find?.((a: any) =>
                                    /^custom:(organization_id|org_id|tenant_id|account_id|workspace_id|company_id)$/i.test(a?.Name ?? a?.name ?? '')
                                );
                                const orgNameAttr = attrs.find?.((a: any) =>
                                    /^custom:(organization_name|org_name|tenant_name|account_name|workspace_name|company_name)$/i.test(a?.Name ?? a?.name ?? '')
                                );

                                let firstName = givenNameAttr?.Value;
                                let lastName = familyNameAttr?.Value;
                                if (!firstName && nameAttr?.Value) {
                                    const parts = nameAttr.Value.split(' ');
                                    firstName = parts[0];
                                    lastName = lastName || parts.slice(1).join(' ') || undefined;
                                }

                                const group: ExtractedGroup | undefined = orgIdAttr?.Value ? {
                                    id: String(orgIdAttr.Value),
                                    name: orgNameAttr?.Value ? String(orgNameAttr.Value) : undefined,
                                } : undefined;

                                // We hand back a Candidate-shaped object so callers can spread it.
                                return {
                                    email: emailAttr.Value,
                                    firstName: firstName || undefined,
                                    lastName: lastName || undefined,
                                    ...(group ? { group } : {}),
                                } as IdentifiedUser & { group?: ExtractedGroup };
                            }
                        } catch { /* invalid JSON */ }
                    }
                }
            }
        } catch { /* storage access failed */ }
        return null;
    }

    // ════════════════════════════════════════════════
    // Utilities
    // ════════════════════════════════════════════════

    private isValidEmail(value: string): boolean {
        return EMAIL_REGEX.test(value);
    }
}
