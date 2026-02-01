/**
 * EventQueue Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage and sessionStorage
const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
    setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete localStorageMock.store[key]; }),
    clear: vi.fn(() => { localStorageMock.store = {}; }),
};

const sessionStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => sessionStorageMock.store[key] || null),
    setItem: vi.fn((key: string, value: string) => { sessionStorageMock.store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete sessionStorageMock.store[key]; }),
    clear: vi.fn(() => { sessionStorageMock.store = {}; }),
};

// Mock window
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', sessionStorageMock);
vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
});
vi.stubGlobal('document', {
    visibilityState: 'visible',
});

// Import after mocks
import { EventQueue } from '../../src/core/queue';
import { Transport } from '../../src/core/transport';
import type { TrackingEvent } from '../../src/types';

describe('EventQueue', () => {
    let transport: Transport;
    let queue: EventQueue;

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

    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        transport = new Transport({ apiEndpoint: 'https://api.test.com' });
        queue = new EventQueue(transport, { batchSize: 5, flushInterval: 10000 });
    });

    afterEach(() => {
        queue.destroy();
    });

    describe('push()', () => {
        it('should add event to queue', () => {
            const event = createMockEvent('test-event');
            queue.push(event);
            expect(queue.length).toBe(1);
        });

        it('should auto-flush when batch size reached', async () => {
            const flushSpy = vi.spyOn(queue, 'flush');
            
            for (let i = 0; i < 5; i++) {
                queue.push(createMockEvent(`event-${i}`));
            }

            expect(flushSpy).toHaveBeenCalled();
        });

        it('should drop oldest event when queue is full', () => {
            // Create queue with small max size
            const smallQueue = new EventQueue(transport, { 
                batchSize: 100, // Prevent auto-flush
                flushInterval: 100000,
                maxQueueSize: 3,
            });

            smallQueue.push(createMockEvent('event-1'));
            smallQueue.push(createMockEvent('event-2'));
            smallQueue.push(createMockEvent('event-3'));
            smallQueue.push(createMockEvent('event-4'));

            expect(smallQueue.length).toBe(3);
            smallQueue.destroy();
        });
    });

    describe('rate limiting', () => {
        it('should drop events when rate limit exceeded', () => {
            // Rate limit is 100 events per minute
            const limitedQueue = new EventQueue(transport, {
                batchSize: 200, // Prevent auto-flush
                flushInterval: 100000,
            });

            // Push 100 events (should all succeed)
            for (let i = 0; i < 100; i++) {
                limitedQueue.push(createMockEvent(`event-${i}`));
            }
            expect(limitedQueue.length).toBe(100);

            // 101st event should be dropped
            limitedQueue.push(createMockEvent('event-dropped'));
            expect(limitedQueue.length).toBe(100);

            limitedQueue.destroy();
        });
    });

    describe('clear()', () => {
        it('should clear all events from queue', () => {
            queue.push(createMockEvent('event-1'));
            queue.push(createMockEvent('event-2'));
            expect(queue.length).toBe(2);

            queue.clear();
            expect(queue.length).toBe(0);
        });
    });

    describe('flush()', () => {
        it('should send events via transport', async () => {
            const sendEventsSpy = vi.spyOn(transport, 'sendEvents').mockResolvedValue({ success: true });

            queue.push(createMockEvent('event-1'));
            queue.push(createMockEvent('event-2'));

            await queue.flush();

            expect(sendEventsSpy).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ eventName: 'event-1' }),
                    expect.objectContaining({ eventName: 'event-2' }),
                ])
            );
            expect(queue.length).toBe(0);
        });

        it('should re-queue events on failure', async () => {
            vi.spyOn(transport, 'sendEvents').mockResolvedValue({ success: false });

            queue.push(createMockEvent('event-1'));
            await queue.flush();

            // Events should be re-queued
            expect(queue.length).toBe(1);
        });

        it('should not flush if already flushing', async () => {
            const sendEventsSpy = vi.spyOn(transport, 'sendEvents').mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
            );

            queue.push(createMockEvent('event-1'));
            
            // Start first flush
            const flush1 = queue.flush();
            // Try second flush immediately
            const flush2 = queue.flush();

            await Promise.all([flush1, flush2]);

            // Should only have been called once
            expect(sendEventsSpy).toHaveBeenCalledTimes(1);
        });
    });
});
