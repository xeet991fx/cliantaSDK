/**
 * AutoIdentify Plugin Tests (Production-Hardened)
 *
 * Tests the production-grade auto-detection from JWT cookies, localStorage,
 * window globals, storage events, guarded NextAuth probing, and safety guards.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// ─── Storage mocks ───
interface StorageMock {
    store: Record<string, string>;
    length: number;
    getItem: Mock<[string], string | null>;
    setItem: Mock<[string, string], void>;
    removeItem: Mock<[string], void>;
    clear: Mock<[], void>;
    key: Mock<[number], string | null>;
}

function createStorageMock(): StorageMock {
    const mockStore: Record<string, string> = {};
    return {
        store: mockStore,
        get length() { return Object.keys(this.store).length; },
        getItem: vi.fn((key: string): string | null => mockStore[key] ?? null),
        setItem: vi.fn((key: string, value: string): void => { mockStore[key] = value; }),
        removeItem: vi.fn((key: string): void => { delete mockStore[key]; }),
        clear: vi.fn((): void => { for (const k in mockStore) delete mockStore[k]; }),
        key: vi.fn((index: number): string | null => Object.keys(mockStore)[index] ?? null),
    };
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', sessionStorageMock);
vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => '12345678-1234-1234-1234-123456789abc'),
});

Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), writable: true });

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, contactId: 'contact-123' }),
})));

import { AutoIdentifyPlugin } from '../../src/plugins/autoIdentify';
import type { TrackerCore, UserTraits } from '../../src/types';

// ─── Helpers ───

function createJWT(claims: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify(claims));
    return `${header}.${payload}.fake-signature`;
}

function createMockTracker(config: Record<string, any> = {}): TrackerCore & { identifyCalls: Array<{ email: string; traits: UserTraits }> } {
    const identifyCalls: Array<{ email: string; traits: UserTraits }> = [];
    return {
        identifyCalls,
        track: vi.fn(),
        identify: vi.fn(async (email: string, traits: UserTraits = {}) => {
            identifyCalls.push({ email, traits });
            return 'contact-123';
        }),
        page: vi.fn(),
        consent: vi.fn(),
        debug: vi.fn(),
        getVisitorId: vi.fn(() => 'visitor-123'),
        getSessionId: vi.fn(() => 'session-123'),
        flush: vi.fn(async () => { }),
        reset: vi.fn(),
        getConfig: vi.fn(() => config as any),
        getWorkspaceId: vi.fn(() => 'workspace-123'),
        deleteData: vi.fn(),
        getConsentState: vi.fn(() => ({ analytics: true })),
        group: vi.fn(),
        alias: vi.fn(async () => true),
        screen: vi.fn(),
        use: vi.fn(),
        onReady: vi.fn(),
        isReady: vi.fn(() => true),
        registerEventSchema: vi.fn(),
        createContact: vi.fn(async () => ({ success: true })),
        updateContact: vi.fn(async () => ({ success: true })),
        submitForm: vi.fn(async () => ({ success: true })),
        logActivity: vi.fn(async () => ({ success: true })),
        createOpportunity: vi.fn(async () => ({ success: true })),
        destroy: vi.fn(async () => { }),
    };
}

describe('AutoIdentifyPlugin (Production)', () => {
    let plugin: AutoIdentifyPlugin;
    let tracker: ReturnType<typeof createMockTracker>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        // Manually clear store data — use Object.keys to snapshot first so the
        // for-loop deletion is reliable across all JS engines.
        Object.keys(localStorageMock.store).forEach(k => { delete localStorageMock.store[k]; });
        Object.keys(sessionStorageMock.store).forEach(k => { delete sessionStorageMock.store[k]; });
        // Re-wire mock implementations
        localStorageMock.getItem.mockImplementation((key: string) => localStorageMock.store[key] ?? null);
        localStorageMock.setItem.mockImplementation((key: string, value: string) => { localStorageMock.store[key] = value; });
        localStorageMock.key.mockImplementation((index: number) => Object.keys(localStorageMock.store)[index] ?? null);
        localStorageMock.removeItem.mockImplementation((key: string) => { delete localStorageMock.store[key]; });
        sessionStorageMock.getItem.mockImplementation((key: string) => sessionStorageMock.store[key] ?? null);
        sessionStorageMock.setItem.mockImplementation((key: string, value: string) => { sessionStorageMock.store[key] = value; });
        sessionStorageMock.key.mockImplementation((index: number) => Object.keys(sessionStorageMock.store)[index] ?? null);
        sessionStorageMock.removeItem.mockImplementation((key: string) => { delete sessionStorageMock.store[key]; });
        // Clean window globals
        delete (window as any).Clerk;
        delete (window as any).firebase;
        delete (window as any).__eutexa_user;
        delete (window as any).__eutexa_group;
        delete (window as any).__SUPABASE_CLIENT__;
        delete (window as any).supabase;
        delete (window as any).__auth0Client;
        delete (window as any).auth0Client;
        delete (window as any).__NEXTAUTH;
        delete (window as any).__NEXT_DATA__;
        delete (window as any).__google_credential_response;
        delete (window as any).gapi;
        delete (window as any).msalInstance;
        delete (window as any).__msalInstance;
        delete (window as any).aws_amplify_currentUser;
        delete (window as any).__amplify_user;
        delete (window as any).keycloak;
        delete (window as any).Keycloak;
        // Clear cookies
        document.cookie.split(';').forEach((c) => {
            const name = c.split('=')[0].trim();
            if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        });

        plugin = new AutoIdentifyPlugin();
        tracker = createMockTracker();
    });

    afterEach(() => {
        plugin.destroy();
        vi.useRealTimers();
    });

    // ─── Core Detection ───

    describe('window.__eutexa_user hook', () => {
        it('should identify user from __eutexa_user', () => {
            (window as any).__eutexa_user = {
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
            };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('test@example.com', {
                firstName: 'John',
                lastName: 'Doe',
            });
        });

        it('should ignore __eutexa_user without valid email', () => {
            (window as any).__eutexa_user = { email: 'not-an-email' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });
    });

    describe('JWT cookie detection (default \'auto\' mode)', () => {
        // 'auto' is the default — no explicit mode needed
        it('should identify user from JWT cookie with email claim', () => {
            const token = createJWT({ email: 'jwt@example.com', name: 'Jane Smith' });
            document.cookie = `token=${token}`;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('jwt@example.com', {
                firstName: 'Jane',
                lastName: 'Smith',
            });
        });

        it('should skip JWT cookie without email claim', () => {
            const token = createJWT({ id: '12345', sub: 'user-id-no-email' });
            document.cookie = `token=${token}`;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should NOT scan cookies in providers mode (opt-in)', () => {
            const providersTracker = createMockTracker({ autoIdentifyMode: 'providers' });
            const token = createJWT({ email: 'leaked@example.com' });
            document.cookie = `token=${token}`;

            plugin.init(providersTracker);
            vi.advanceTimersByTime(2500);

            expect(providersTracker.identify).not.toHaveBeenCalled();
        });

        it('should NOT scan cookies in off mode (opt-out)', () => {
            const offTracker = createMockTracker({ autoIdentifyMode: 'off' });
            const token = createJWT({ email: 'leaked@example.com' });
            document.cookie = `token=${token}`;

            plugin.init(offTracker);
            vi.advanceTimersByTime(2500);

            expect(offTracker.identify).not.toHaveBeenCalled();
        });
    });

    describe('localStorage scan (default \'auto\' mode)', () => {
        it('should identify user from JWT stored in localStorage', () => {
            const token = createJWT({ email: 'stored@example.com', given_name: 'Stored' });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('stored@example.com', {
                firstName: 'Stored',
                lastName: undefined,
            });
        });

        it('should NOT scan generic localStorage in providers mode (opt-in)', () => {
            const providersTracker = createMockTracker({ autoIdentifyMode: 'providers' });
            localStorageMock.store['user'] = JSON.stringify({ email: 'leaked@example.com' });

            plugin.init(providersTracker);
            vi.advanceTimersByTime(2500);

            expect(providersTracker.identify).not.toHaveBeenCalled();
        });
    });

    describe('plain JSON deep scan (aggressive mode only)', () => {
        // 'auto' mode does NOT do plain-JSON deep scans — it only decodes JWTs.
        // For Zustand-auth-storage style flows that don't carry a JWT in the
        // user object, you'd need to opt into aggressive mode.
        it('should identify user from direct JSON in localStorage (aggressive)', () => {
            const aggTracker = createMockTracker({ autoIdentifyMode: 'aggressive' });
            localStorageMock.store['user'] = JSON.stringify({
                email: 'direct@example.com',
                firstName: 'Direct',
                lastName: 'User',
            });

            plugin.init(aggTracker);
            vi.advanceTimersByTime(2500);

            expect(aggTracker.identify).toHaveBeenCalledWith('direct@example.com', expect.any(Object));
        });

        it('should NOT pick up plain-JSON emails in default \'auto\' mode', () => {
            // A third-party SDK leaving an email in plain JSON should not trigger
            // identification in the default mode — JWT only.
            localStorageMock.store['user'] = JSON.stringify({ email: 'plain@example.com' });

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should identify user from Zustand auth-storage in aggressive mode', () => {
            const aggTracker = createMockTracker({ autoIdentifyMode: 'aggressive' });
            const zustandShape = JSON.stringify({
                state: {
                    user: {
                        _id: '507f1f77bcf86cd799439011',
                        email: 'googleuser@gmail.com',
                        name: 'Google Test User',
                    },
                    token: createJWT({ id: '507f1f77bcf86cd799439011' }),
                    isAuthenticated: true,
                },
                version: 0,
            });
            localStorageMock.store['auth-storage'] = zustandShape;

            plugin.init(aggTracker);
            vi.advanceTimersByTime(2500);

            expect(aggTracker.identify).toHaveBeenCalledWith('googleuser@gmail.com', {
                firstName: 'Google',
                lastName: 'Test User',
            });
        });
    });

    describe('Safeguard #1 — JWT freshness', () => {
        it('should reject expired JWTs (exp in the past)', () => {
            const expiredToken = createJWT({
                email: 'expired@example.com',
                exp: Math.floor(Date.now() / 1000) - 60, // expired 60s ago
            });
            localStorageMock.store['token'] = expiredToken;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should reject JWTs with iat older than 30 days', () => {
            const staleToken = createJWT({
                email: 'stale@example.com',
                iat: Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60, // 31 days ago
            });
            localStorageMock.store['token'] = staleToken;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should accept JWTs with valid exp/iat', () => {
            const freshToken = createJWT({
                email: 'fresh@example.com',
                iat: Math.floor(Date.now() / 1000) - 60,
                exp: Math.floor(Date.now() / 1000) + 3600,
            });
            localStorageMock.store['token'] = freshToken;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('fresh@example.com', expect.any(Object));
        });
    });

    describe('Safeguard #2 — Third-party SDK blocklist', () => {
        it('should skip Intercom storage keys', () => {
            const token = createJWT({ email: 'support@intercom.io' });
            localStorageMock.store['intercom-state'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should skip FullStory storage keys', () => {
            const token = createJWT({ email: 'agent@fullstory.com' });
            localStorageMock.store['fs-uid'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should skip HubSpot storage keys', () => {
            const token = createJWT({ email: 'agent@hubspot.com' });
            localStorageMock.store['hubspotutk-token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should still pick up the real user when an Intercom email also exists', () => {
            // Real user JWT in a normal auth key
            const realToken = createJWT({ email: 'real@example.com' });
            localStorageMock.store['auth_token'] = realToken;
            // Intercom JWT in their own key — should be skipped
            const intercomToken = createJWT({ email: 'agent@intercom.io' });
            localStorageMock.store['intercom-session-data'] = intercomToken;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('real@example.com', expect.any(Object));
            expect(tracker.identify).not.toHaveBeenCalledWith('agent@intercom.io', expect.any(Object));
        });
    });

    describe('Safeguard #3 — Domain match preference', () => {
        it('should prefer email matching the page hostname', () => {
            // jsdom locks down `location.hostname`; stub the whole location object instead.
            vi.stubGlobal('location', { hostname: 'acme.com', protocol: 'https:', href: 'https://acme.com/' });

            const realToken = createJWT({ email: 'ada@acme.com' });
            const otherToken = createJWT({ email: 'someone@other.com' });
            localStorageMock.store['auth_token'] = realToken;
            localStorageMock.store['session_token'] = otherToken;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            // Both tokens are valid, but ada@acme.com gets the +15 domain bonus
            expect(tracker.identify).toHaveBeenCalledWith('ada@acme.com', expect.any(Object));
            expect(tracker.identify).not.toHaveBeenCalledWith('someone@other.com', expect.any(Object));
        });
    });

    describe('Safeguard #4 — Sticky identification', () => {
        it('should re-identify on init if a sticky email is cached', () => {
            localStorageMock.store['eutexa_idm'] = 'sticky@example.com';
            localStorageMock.store['eutexa_idm_src'] = 'localStorage:auth_token';

            plugin.init(tracker);

            // Sticky restore happens synchronously in init() — no need to advance timers
            expect(tracker.identify).toHaveBeenCalledWith('sticky@example.com', {});
        });

        it('should persist a fresh identification to the sticky cache', () => {
            const token = createJWT({ email: 'persisted@example.com' });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('persisted@example.com', expect.any(Object));
            expect(localStorageMock.store['eutexa_idm']).toBe('persisted@example.com');
            expect(localStorageMock.store['eutexa_idm_src']).toContain('token');
        });
    });

    describe('Safeguard #5 — Auto-logout detection', () => {
        it('should call tracker.reset() when an auth-shaped key is cleared', () => {
            // First identify
            const token = createJWT({ email: 'before-logout@example.com' });
            localStorageMock.store['auth_token'] = token;
            plugin.init(tracker);
            vi.advanceTimersByTime(2500);
            expect(tracker.identify).toHaveBeenCalledWith('before-logout@example.com', expect.any(Object));

            // Now simulate logout — auth_token gets cleared in another tab
            const event = new StorageEvent('storage', {
                key: 'auth_token',
                oldValue: token,
                newValue: null,
            });
            window.dispatchEvent(event);

            expect(tracker.reset).toHaveBeenCalled();
            expect(localStorageMock.store['eutexa_idm']).toBeUndefined();
            expect(localStorageMock.store['eutexa_grp_id']).toBeUndefined();
        });

        it('should ignore storage events on third-party SDK keys', () => {
            const token = createJWT({ email: 'before-logout@example.com' });
            localStorageMock.store['auth_token'] = token;
            plugin.init(tracker);
            vi.advanceTimersByTime(2500);
            (tracker.reset as any).mockClear();

            // Intercom clearing its own state should NOT trigger our logout
            const event = new StorageEvent('storage', {
                key: 'intercom-state',
                oldValue: 'whatever',
                newValue: null,
            });
            window.dispatchEvent(event);

            expect(tracker.reset).not.toHaveBeenCalled();
        });
    });

    // ─── Rich auto-traits ────────────────────────────────────────────────

    describe('Rich auto-traits from JWT', () => {
        it('should extract avatar / role / plan / locale into the identify payload', () => {
            const token = createJWT({
                email: 'rich@example.com',
                given_name: 'Rich',
                family_name: 'User',
                picture: 'https://cdn.example.com/u/123.png',
                role: 'admin',
                plan: 'enterprise',
                locale: 'en-US',
            });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('rich@example.com', expect.objectContaining({
                firstName: 'Rich',
                lastName: 'User',
                avatar: 'https://cdn.example.com/u/123.png',
                role: 'admin',
                plan: 'enterprise',
                locale: 'en-US',
            }));
        });

        it('should preserve unknown JWT claims as customFields', () => {
            const token = createJWT({
                email: 'fields@example.com',
                team_id: 'team-42',
                signup_source: 'google-oauth',
                is_admin: true,
                seat_count: 7,
            });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('fields@example.com', expect.objectContaining({
                customFields: expect.objectContaining({
                    team_id: 'team-42',
                    signup_source: 'google-oauth',
                    is_admin: true,
                    seat_count: 7,
                }),
            }));
        });

        it('should NOT pull nested provider state into customFields', () => {
            const token = createJWT({
                email: 'safe@example.com',
                team_id: 'team-42',
                // Nested object should be skipped — too risky to dump into CRM
                provider_internal: { encryptedSession: 'should-not-leak' },
            });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            const call = (tracker.identify as any).mock.calls[0];
            expect(call[1].customFields).not.toHaveProperty('provider_internal');
        });
    });

    // ─── Auto-group ──────────────────────────────────────────────────────

    describe('Auto-group from JWT claims', () => {
        it('should call tracker.group() with org_id from a JWT', () => {
            const token = createJWT({
                email: 'ada@acme.io',
                organization_id: 'acme-co-1',
                organization_name: 'Acme Co.',
            });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.group).toHaveBeenCalledWith('acme-co-1', expect.objectContaining({
                name: 'Acme Co.',
            }));
        });

        it('should call tracker.group() with tenant_id when org_id is absent', () => {
            const token = createJWT({
                email: 'user@tenant.io',
                tenant_id: 'tenant-99',
            });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.group).toHaveBeenCalledWith('tenant-99', expect.any(Object));
        });
    });

    describe('Auto-group from Clerk', () => {
        it('should call tracker.group() with the Clerk organization', () => {
            (window as any).Clerk = {
                user: {
                    primaryEmailAddress: { emailAddress: 'clerk-org@example.com' },
                    firstName: 'C',
                    lastName: 'User',
                    organizationMemberships: [{
                        organization: {
                            id: 'clerk-org-abc',
                            name: 'Clerk Org Inc.',
                            slug: 'clerk-org-inc',
                        },
                    }],
                },
            };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.group).toHaveBeenCalledWith('clerk-org-abc', expect.objectContaining({
                name: 'Clerk Org Inc.',
                slug: 'clerk-org-inc',
            }));
        });
    });

    describe('Auto-group from email domain', () => {
        it('should derive a group from a B2B email domain when no JWT group is present', () => {
            const token = createJWT({ email: 'someone@acme.com' });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.group).toHaveBeenCalledWith('acme.com', expect.objectContaining({
                name: 'acme.com',
            }));
        });

        it('should NOT derive a group from a personal email domain (gmail.com)', () => {
            const token = createJWT({ email: 'someone@gmail.com' });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('someone@gmail.com', expect.any(Object));
            expect(tracker.group).not.toHaveBeenCalled();
        });

        it('should prefer JWT-derived group over email-domain', () => {
            const token = createJWT({
                email: 'ada@acme.com',
                organization_id: 'real-org-id',
            });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.group).toHaveBeenCalledTimes(1);
            expect(tracker.group).toHaveBeenCalledWith('real-org-id', expect.any(Object));
        });
    });

    describe('window.__eutexa_group escape hatch', () => {
        it('should pick up a standalone __eutexa_group with the identified user', () => {
            (window as any).__eutexa_user = { email: 'standalone@example.com' };
            (window as any).__eutexa_group = { id: 'g-123', name: 'Group 123' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('standalone@example.com', expect.any(Object));
            expect(tracker.group).toHaveBeenCalledWith('g-123', expect.objectContaining({ name: 'Group 123' }));
        });
    });

    describe('eutexa:group window event', () => {
        it('should call tracker.group() on dispatched eutexa:group event', () => {
            plugin.init(tracker);

            window.dispatchEvent(new CustomEvent('eutexa:group', {
                detail: { id: 'event-grp', name: 'From event', traits: { plan: 'pro' } },
            }));

            expect(tracker.group).toHaveBeenCalledWith('event-grp', expect.objectContaining({
                name: 'From event',
                plan: 'pro',
            }));
        });

        it('should ignore eutexa:group events with no id', () => {
            plugin.init(tracker);
            window.dispatchEvent(new CustomEvent('eutexa:group', { detail: { name: 'No id' } }));
            expect(tracker.group).not.toHaveBeenCalled();
        });
    });

    describe('autoGroupMode option', () => {
        // These tests are sensitive to sticky-group state from earlier tests; reset
        // it explicitly so they pass regardless of run order.
        beforeEach(() => {
            delete localStorageMock.store['eutexa_grp_id'];
            delete localStorageMock.store['eutexa_grp_name'];
            delete localStorageMock.store['eutexa_idm'];
            delete localStorageMock.store['eutexa_idm_src'];
        });

        it("'off' disables group calls entirely", () => {
            const offTracker = createMockTracker({ autoGroupMode: 'off' });
            const token = createJWT({
                email: 'someone@acme.com',
                organization_id: 'org-1',
            });
            localStorageMock.store['token'] = token;

            plugin.init(offTracker);
            vi.advanceTimersByTime(2500);

            expect(offTracker.identify).toHaveBeenCalled();
            expect(offTracker.group).not.toHaveBeenCalled();
        });

        it("'jwt' skips the email-domain fallback", () => {
            const jwtTracker = createMockTracker({ autoGroupMode: 'jwt' });
            // No org claim in JWT, just a B2B email
            const token = createJWT({ email: 'someone@acme.com' });
            localStorageMock.store['token'] = token;

            plugin.init(jwtTracker);
            vi.advanceTimersByTime(2500);

            expect(jwtTracker.identify).toHaveBeenCalled();
            expect(jwtTracker.group).not.toHaveBeenCalled();
        });

        it("'domain' skips JWT-derived groups", () => {
            const domainTracker = createMockTracker({ autoGroupMode: 'domain' });
            const token = createJWT({
                email: 'ada@acme.com',
                organization_id: 'should-be-ignored',
            });
            localStorageMock.store['token'] = token;

            plugin.init(domainTracker);
            vi.advanceTimersByTime(2500);

            // The JWT org is ignored; we fall through to the email domain.
            expect(domainTracker.group).toHaveBeenCalledWith('acme.com', expect.any(Object));
            expect(domainTracker.group).not.toHaveBeenCalledWith('should-be-ignored', expect.any(Object));
        });
    });

    describe('Sticky group cache', () => {
        it('should restore a sticky group on init and call tracker.group()', () => {
            localStorageMock.store['eutexa_idm'] = 'sticky@acme.com';
            localStorageMock.store['eutexa_idm_src'] = 'localStorage:auth_token';
            localStorageMock.store['eutexa_grp_id'] = 'sticky-grp';
            localStorageMock.store['eutexa_grp_name'] = 'Sticky Group';

            plugin.init(tracker);

            expect(tracker.identify).toHaveBeenCalledWith('sticky@acme.com', {});
            expect(tracker.group).toHaveBeenCalledWith('sticky-grp', expect.objectContaining({ name: 'Sticky Group' }));
        });

        it('should persist the group to the sticky cache after auto-grouping', () => {
            const token = createJWT({
                email: 'persist-grp@acme.com',
                organization_id: 'persist-org',
                organization_name: 'Persist Org',
            });
            localStorageMock.store['token'] = token;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(localStorageMock.store['eutexa_grp_id']).toBe('persist-org');
            expect(localStorageMock.store['eutexa_grp_name']).toBe('Persist Org');
        });
    });

    describe('auth provider globals', () => {
        it('should identify Clerk user', () => {
            (window as any).Clerk = {
                user: {
                    primaryEmailAddress: { emailAddress: 'clerk@example.com' },
                    firstName: 'Clerk',
                    lastName: 'User',
                },
            };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('clerk@example.com', {
                firstName: 'Clerk',
                lastName: 'User',
            });
        });

        it('should identify Firebase user', () => {
            (window as any).firebase = {
                auth: () => ({
                    currentUser: {
                        email: 'firebase@example.com',
                        displayName: 'Firebase User',
                    },
                }),
            };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('firebase@example.com', {
                firstName: 'Firebase',
                lastName: 'User',
            });
        });

        it('should identify Google GIS user via credential JWT', () => {
            const googleJwt = createJWT({ email: 'google@example.com', given_name: 'Google', family_name: 'User' });
            (window as any).__google_credential_response = { credential: googleJwt };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('google@example.com', {
                firstName: 'Google',
                lastName: 'User',
            });
        });

        it('should identify Microsoft MSAL user', () => {
            (window as any).msalInstance = {
                getAllAccounts: () => [{
                    username: 'msal@example.com',
                    name: 'Microsoft User',
                }],
            };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('msal@example.com', {
                firstName: 'Microsoft',
                lastName: 'User',
            });
        });

        it('should identify Keycloak user', () => {
            (window as any).keycloak = {
                authenticated: true,
                tokenParsed: {
                    email: 'keycloak@example.com',
                    given_name: 'KC',
                    family_name: 'User',
                },
            };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('keycloak@example.com', {
                firstName: 'KC',
                lastName: 'User',
            });
        });

        it('should identify AWS Cognito user from localStorage', () => {
            localStorageMock.store['CognitoIdentityServiceProvider.abc123.user1.userData'] = JSON.stringify({
                UserAttributes: [
                    { Name: 'email', Value: 'cognito@example.com' },
                    { Name: 'given_name', Value: 'AWS' },
                    { Name: 'family_name', Value: 'User' },
                ],
            });

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('cognito@example.com', {
                firstName: 'AWS',
                lastName: 'User',
            });
        });
    });

    // ─── Production Safety Guards ───

    describe('email validation', () => {
        it('should reject strings that look like emails but are not', () => {
            (window as any).__eutexa_user = { email: 'user@v2.0' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should reject short TLDs', () => {
            (window as any).__eutexa_user = { email: 'config@a.b' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should accept valid emails with subdomains', () => {
            (window as any).__eutexa_user = { email: 'user@sub.domain.co.uk' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('user@sub.domain.co.uk', expect.any(Object));
        });
    });

    describe('size guards', () => {
        it('should skip storage values larger than 50KB (aggressive mode)', () => {
            const aggTracker = createMockTracker({ autoIdentifyMode: 'aggressive' });
            const largeObj: any = { email: 'buried@example.com', data: 'x'.repeat(60_000) };
            localStorageMock.store['auth-data'] = JSON.stringify(largeObj);

            plugin.init(aggTracker);
            vi.advanceTimersByTime(2500);

            expect(aggTracker.identify).not.toHaveBeenCalled();
        });
    });

    describe('guarded session probing', () => {
        // NextAuth probe runs in 'auto' (default) and 'aggressive' modes.

        it('should NOT probe /api/auth/session in providers mode (opt-in)', () => {
            const providersTracker = createMockTracker({ autoIdentifyMode: 'providers' });
            const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
            vi.stubGlobal('fetch', fetchMock);
            document.cookie = 'next-auth.session-token=some-encrypted-token';

            plugin.init(providersTracker);
            vi.advanceTimersByTime(30_000);

            const sessionCalls = (fetchMock.mock.calls as any[]).filter(
                (call: any[]) => typeof call[0] === 'string' && call[0].includes('/api/auth/session')
            );
            expect(sessionCalls).toHaveLength(0);
        });

        it('should NOT probe /api/auth/session without NextAuth signals', () => {
            const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
            vi.stubGlobal('fetch', fetchMock);

            plugin.init(tracker);
            vi.advanceTimersByTime(30_000);

            const sessionCalls = (fetchMock.mock.calls as any[]).filter(
                (call: any[]) => typeof call[0] === 'string' && call[0].includes('/api/auth/session')
            );
            expect(sessionCalls).toHaveLength(0);
        });

        it('should probe /api/auth/session in default \'auto\' mode when NextAuth cookie is present', async () => {
            document.cookie = 'next-auth.session-token=some-encrypted-token';
            const fetchMock = vi.fn(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    user: { email: 'nextauth@example.com', name: 'NA User' },
                    expires: '2099-01-01',
                }),
            }));
            vi.stubGlobal('fetch', fetchMock);

            plugin.init(tracker);
            vi.advanceTimersByTime(28_000);
            await vi.advanceTimersByTimeAsync(100);

            const sessionCalls = (fetchMock.mock.calls as any[]).filter(
                (call: any[]) => typeof call[0] === 'string' && call[0].includes('/api/auth/session')
            );
            expect(sessionCalls.length).toBeGreaterThan(0);
        });
    });

    describe('eutexa:identify window event hook', () => {
        it('should identify on dispatched eutexa:identify event', () => {
            plugin.init(tracker);

            window.dispatchEvent(new CustomEvent('eutexa:identify', {
                detail: { email: 'hook@example.com', firstName: 'Hook', lastName: 'User' },
            }));

            expect(tracker.identify).toHaveBeenCalledWith('hook@example.com', {
                firstName: 'Hook',
                lastName: 'User',
            });
        });

        it('should ignore eutexa:identify with invalid email', () => {
            plugin.init(tracker);
            window.dispatchEvent(new CustomEvent('eutexa:identify', {
                detail: { email: 'not-an-email' },
            }));
            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should re-allow identification after eutexa:logout event', () => {
            plugin.init(tracker);

            window.dispatchEvent(new CustomEvent('eutexa:identify', {
                detail: { email: 'first@example.com' },
            }));
            expect(tracker.identify).toHaveBeenCalledTimes(1);

            // Logout clears in-memory guard
            window.dispatchEvent(new Event('eutexa:logout'));

            window.dispatchEvent(new CustomEvent('eutexa:identify', {
                detail: { email: 'second@example.com' },
            }));
            expect(tracker.identify).toHaveBeenCalledTimes(2);
            expect(tracker.identify).toHaveBeenLastCalledWith('second@example.com', expect.any(Object));
        });
    });

    // ─── Lifecycle ───

    describe('deduplication and lifecycle', () => {
        it('should not identify same user twice', () => {
            (window as any).__eutexa_user = { email: 'dedup@example.com' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);
            vi.advanceTimersByTime(10000);

            expect(tracker.identify).toHaveBeenCalledTimes(1);
        });

        it('should cancel all remaining polls after identifying user', () => {
            (window as any).__eutexa_user = { email: 'stop@example.com' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            // Advance well past all poll times
            vi.advanceTimersByTime(600_000);

            expect(tracker.identify).toHaveBeenCalledTimes(1);
        });

        it('should not identify if no auth data found', () => {
            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should clean up on destroy', () => {
            plugin.init(tracker);
            plugin.destroy();

            (window as any).__eutexa_user = { email: 'late@example.com' };
            vi.advanceTimersByTime(60_000);

            expect(tracker.identify).not.toHaveBeenCalled();
        });
    });

    // ─── Exponential Backoff ───

    describe('exponential backoff polling', () => {
        it('should check at 2s but not at 1s', () => {
            (window as any).__eutexa_user = { email: 'timing@example.com' };

            plugin.init(tracker);

            vi.advanceTimersByTime(1000);
            expect(tracker.identify).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1500);
            expect(tracker.identify).toHaveBeenCalledTimes(1);
        });

        it('should not fetch-intercept (no monkey-patching)', () => {
            const originalFetch = window.fetch;
            plugin.init(tracker);

            // fetch should NOT have been replaced
            expect(window.fetch).toBe(originalFetch);
        });
    });
});
