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

function createMockTracker(): TrackerCore & { identifyCalls: Array<{ email: string; traits: UserTraits }> } {
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
        getConfig: vi.fn(() => ({} as any)),
        getWorkspaceId: vi.fn(() => 'workspace-123'),
        deleteData: vi.fn(),
        getConsentState: vi.fn(() => ({ analytics: true })),
        group: vi.fn(),
        alias: vi.fn(async () => true),
        screen: vi.fn(),
        use: vi.fn(),
        onReady: vi.fn(),
        isReady: vi.fn(() => true),
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
        // Manually clear store data
        for (const k in localStorageMock.store) delete localStorageMock.store[k];
        for (const k in sessionStorageMock.store) delete sessionStorageMock.store[k];
        // Re-wire mock implementations
        localStorageMock.getItem.mockImplementation((key: string) => localStorageMock.store[key] ?? null);
        localStorageMock.setItem.mockImplementation((key: string, value: string) => { localStorageMock.store[key] = value; });
        localStorageMock.key.mockImplementation((index: number) => Object.keys(localStorageMock.store)[index] ?? null);
        sessionStorageMock.getItem.mockImplementation((key: string) => sessionStorageMock.store[key] ?? null);
        sessionStorageMock.setItem.mockImplementation((key: string, value: string) => { sessionStorageMock.store[key] = value; });
        sessionStorageMock.key.mockImplementation((index: number) => Object.keys(sessionStorageMock.store)[index] ?? null);
        // Clean window globals
        delete (window as any).Clerk;
        delete (window as any).firebase;
        delete (window as any).__clianta_user;
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

    describe('window.__clianta_user hook', () => {
        it('should identify user from __clianta_user', () => {
            (window as any).__clianta_user = {
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

        it('should ignore __clianta_user without valid email', () => {
            (window as any).__clianta_user = { email: 'not-an-email' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });
    });

    describe('JWT cookie detection', () => {
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

        it('should extract email from sub claim if it looks like email', () => {
            const token = createJWT({ sub: 'user@domain.com' });
            document.cookie = `access_token=${token}`;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('user@domain.com', expect.any(Object));
        });
    });

    describe('localStorage deep scan', () => {
        it('should identify user from direct JSON in localStorage', () => {
            localStorageMock.store['user'] = JSON.stringify({
                email: 'direct@example.com',
                firstName: 'Direct',
                lastName: 'User',
            });

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('direct@example.com', expect.any(Object));
        });

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

        /**
         * ─── YOUR APP'S EXACT GOOGLE OAUTH FLOW ─────────────────────────────
         * Flow:
         *   1. User clicks "Login with Google"
         *   2. Backend Passport.js handles OAuth, generates JWT (id only), redirects to /auth/callback?token=xxx
         *   3. Frontend auth/callback/page.tsx exchanges token → gets { token, user }
         *   4. Zustand setUser({ email, name, ... }) + setToken(jwt) persists to localStorage
         *   5. Zustand persist writes:
         *      auth-storage = { state: { user: { email, name, ... }, token: "eyJ...", isAuthenticated: true }, version: 0 }
         *   6. SDK should detect email from state.user.email via deep scan
         */
        it('should identify user from YOUR Google OAuth flow (Zustand auth-storage)', () => {
            // This is the EXACT shape Zustand persist writes after Google OAuth
            // in your useAuthStore (partialize: state => ({ user, token, isAuthenticated }))
            const zustandShape = JSON.stringify({
                state: {
                    user: {
                        _id: '507f1f77bcf86cd799439011',
                        email: 'googleuser@gmail.com',      // ← from Google profile
                        name: 'Google Test User',             // ← from Google profile
                        authProvider: 'google',
                        isVerified: true,
                    },
                    token: createJWT({ id: '507f1f77bcf86cd799439011' }), // ← id-only JWT
                    isAuthenticated: true,
                },
                version: 0,
            });

            localStorageMock.store['auth-storage'] = zustandShape;

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('googleuser@gmail.com', {
                firstName: 'Google',
                lastName: 'Test User',
            });
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
            (window as any).__clianta_user = { email: 'user@v2.0' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should reject short TLDs', () => {
            (window as any).__clianta_user = { email: 'config@a.b' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });

        it('should accept valid emails with subdomains', () => {
            (window as any).__clianta_user = { email: 'user@sub.domain.co.uk' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).toHaveBeenCalledWith('user@sub.domain.co.uk', expect.any(Object));
        });
    });

    describe('size guards', () => {
        it('should skip storage values larger than 50KB', () => {
            // Create a large JSON with email buried inside
            const largeObj: any = { email: 'buried@example.com', data: 'x'.repeat(60_000) };
            localStorageMock.store['auth-data'] = JSON.stringify(largeObj);

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);

            expect(tracker.identify).not.toHaveBeenCalled();
        });
    });

    describe('guarded session probing', () => {
        it('should NOT probe /api/auth/session without NextAuth signals', () => {
            const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
            vi.stubGlobal('fetch', fetchMock);

            plugin.init(tracker);
            // Advance past the 4th poll check (when probing would trigger)
            vi.advanceTimersByTime(30_000);

            // fetch should NOT have been called with /api/auth/session
            const sessionCalls = (fetchMock.mock.calls as any[]).filter(
                (call: any[]) => typeof call[0] === 'string' && call[0].includes('/api/auth/session')
            );
            expect(sessionCalls).toHaveLength(0);
        });

        it('should probe /api/auth/session when NextAuth cookie is present', async () => {
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
            // Advance past the 4th poll (27s cumulative: 2+5+10+10)
            vi.advanceTimersByTime(28_000);

            // Give async probe time to complete
            await vi.advanceTimersByTimeAsync(100);

            const sessionCalls = (fetchMock.mock.calls as any[]).filter(
                (call: any[]) => typeof call[0] === 'string' && call[0].includes('/api/auth/session')
            );
            expect(sessionCalls.length).toBeGreaterThan(0);
        });
    });

    // ─── Lifecycle ───

    describe('deduplication and lifecycle', () => {
        it('should not identify same user twice', () => {
            (window as any).__clianta_user = { email: 'dedup@example.com' };

            plugin.init(tracker);
            vi.advanceTimersByTime(2500);
            vi.advanceTimersByTime(10000);

            expect(tracker.identify).toHaveBeenCalledTimes(1);
        });

        it('should cancel all remaining polls after identifying user', () => {
            (window as any).__clianta_user = { email: 'stop@example.com' };

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

            (window as any).__clianta_user = { email: 'late@example.com' };
            vi.advanceTimersByTime(60_000);

            expect(tracker.identify).not.toHaveBeenCalled();
        });
    });

    // ─── Exponential Backoff ───

    describe('exponential backoff polling', () => {
        it('should check at 2s but not at 1s', () => {
            (window as any).__clianta_user = { email: 'timing@example.com' };

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
