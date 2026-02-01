/**
 * ConsentManager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
    setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete localStorageMock.store[key]; }),
    clear: vi.fn(() => { localStorageMock.store = {}; }),
};

vi.stubGlobal('localStorage', localStorageMock);

import { ConsentManager } from '../../src/consent';
import type { ConsentState, TrackingEvent } from '../../src/types';

describe('ConsentManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
    });

    const createMockEvent = (name: string): TrackingEvent => ({
        workspaceId: 'test-workspace',
        visitorId: 'test-visitor',
        sessionId: 'test-session',
        eventType: 'custom',
        eventName: name,
        url: 'https://test.com',
        properties: {},
        device: { userAgent: 'test', screen: '1920x1080', language: 'en', timezone: 'UTC' },
        timestamp: new Date().toISOString(),
        sdkVersion: '1.0.0',
    });

    describe('initialization', () => {
        it('should use default consent when no stored consent', () => {
            const manager = new ConsentManager();
            const state = manager.getState();

            expect(state.analytics).toBe(true);
            expect(state.marketing).toBe(false);
            expect(state.personalization).toBe(false);
        });

        it('should load stored consent', () => {
            // Use correct storage format with version field
            localStorageMock.store['mb_consent'] = JSON.stringify({
                state: { analytics: false, marketing: true, personalization: true },
                timestamp: Date.now(),
                version: 1,
            });

            const manager = new ConsentManager();
            const state = manager.getState();

            expect(state.analytics).toBe(false);
            expect(state.marketing).toBe(true);
            expect(state.personalization).toBe(true);
        });
    });

    describe('grant()', () => {
        it('should update consent state', () => {
            const manager = new ConsentManager();
            manager.grant({ marketing: true });

            const state = manager.getState();
            expect(state.marketing).toBe(true);
        });

        it('should call onChange callback', () => {
            const callback = vi.fn();
            const manager = new ConsentManager({ onConsentChange: callback });

            manager.grant({ marketing: true });

            expect(callback).toHaveBeenCalledWith(
                expect.objectContaining({ marketing: true }),
                expect.objectContaining({ marketing: false })
            );
        });

        it('should persist to storage', () => {
            const manager = new ConsentManager();
            manager.grant({ marketing: true });

            expect(localStorageMock.setItem).toHaveBeenCalled();
        });
    });

    describe('revoke()', () => {
        it('should revoke specific categories', () => {
            const manager = new ConsentManager({
                defaultConsent: { analytics: true, marketing: true, personalization: true },
            });

            manager.revoke(['marketing', 'personalization']);

            const state = manager.getState();
            expect(state.analytics).toBe(true);
            expect(state.marketing).toBe(false);
            expect(state.personalization).toBe(false);
        });
    });

    describe('canTrack()', () => {
        it('should return true when analytics consent is granted', () => {
            const manager = new ConsentManager({
                defaultConsent: { analytics: true },
            });

            expect(manager.canTrack()).toBe(true);
        });

        it('should return false when analytics consent is denied', () => {
            const manager = new ConsentManager({
                defaultConsent: { analytics: false },
            });

            expect(manager.canTrack()).toBe(false);
        });

        it('should return false when waitForConsent and no explicit consent', () => {
            const manager = new ConsentManager({
                waitForConsent: true,
                defaultConsent: { analytics: true },
            });

            expect(manager.canTrack()).toBe(false);
        });

        it('should return true when waitForConsent and explicit consent given', () => {
            const manager = new ConsentManager({
                waitForConsent: true,
                defaultConsent: { analytics: true },
            });

            manager.grant({ analytics: true });

            expect(manager.canTrack()).toBe(true);
        });
    });

    describe('event buffering', () => {
        it('should buffer events', () => {
            const manager = new ConsentManager();

            manager.bufferEvent(createMockEvent('event-1'));
            manager.bufferEvent(createMockEvent('event-2'));

            expect(manager.getBufferSize()).toBe(2);
        });

        it('should flush buffered events', () => {
            const manager = new ConsentManager();

            manager.bufferEvent(createMockEvent('event-1'));
            manager.bufferEvent(createMockEvent('event-2'));

            const events = manager.flushBuffer();

            expect(events).toHaveLength(2);
            expect(manager.getBufferSize()).toBe(0);
        });

        it('should limit buffer size to 100 events', () => {
            const manager = new ConsentManager();

            for (let i = 0; i < 105; i++) {
                manager.bufferEvent(createMockEvent(`event-${i}`));
            }

            expect(manager.getBufferSize()).toBe(100);
        });
    });

    describe('reset()', () => {
        it('should reset to default consent', () => {
            const manager = new ConsentManager();
            manager.grant({ marketing: true, personalization: true });
            manager.reset();

            const state = manager.getState();
            expect(state.analytics).toBe(true);
            expect(state.marketing).toBe(false);
            expect(state.personalization).toBe(false);
        });

        it('should clear buffered events', () => {
            const manager = new ConsentManager();
            manager.bufferEvent(createMockEvent('event-1'));
            manager.reset();

            expect(manager.getBufferSize()).toBe(0);
        });
    });

    describe('onChange()', () => {
        it('should register multiple callbacks', () => {
            const manager = new ConsentManager();
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            manager.onChange(callback1);
            manager.onChange(callback2);

            manager.grant({ marketing: true });

            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        it('should return unsubscribe function', () => {
            const manager = new ConsentManager();
            const callback = vi.fn();

            const unsubscribe = manager.onChange(callback);
            unsubscribe();

            manager.grant({ marketing: true });

            expect(callback).not.toHaveBeenCalled();
        });
    });
});
