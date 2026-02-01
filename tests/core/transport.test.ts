/**
 * Transport Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transport } from '../../src/core/transport';
import type { TrackingEvent, IdentifyPayload } from '../../src/types';

describe('Transport', () => {
    let transport: Transport;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        transport = new Transport({ 
            apiEndpoint: 'https://api.test.com',
            maxRetries: 2,
            retryDelay: 10,
            timeout: 5000,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const createMockEvent = (): TrackingEvent => ({
        workspaceId: 'test-workspace',
        visitorId: 'test-visitor',
        sessionId: 'test-session',
        eventType: 'custom',
        eventName: 'test-event',
        url: 'https://test.com',
        properties: { key: 'value' },
        device: { userAgent: 'test', screen: '1920x1080', language: 'en', timezone: 'UTC' },
        timestamp: new Date().toISOString(),
        sdkVersion: '1.0.0',
    });

    describe('sendEvents()', () => {
        it('should send events to correct endpoint', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
            });

            const events = [createMockEvent()];
            const result = await transport.sendEvents(events);

            expect(result.success).toBe(true);
            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.test.com/api/public/track/event',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ events }),
                })
            );
        });

        it('should return failure for 4xx errors', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 400,
            });

            const result = await transport.sendEvents([createMockEvent()]);

            expect(result.success).toBe(false);
            expect(result.status).toBe(400);
            // Should NOT retry on 4xx
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('should retry on 5xx errors', async () => {
            fetchMock
                .mockResolvedValueOnce({ ok: false, status: 500 })
                .mockResolvedValueOnce({ ok: true, status: 200 });

            const result = await transport.sendEvents([createMockEvent()]);

            expect(result.success).toBe(true);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should retry on network errors', async () => {
            fetchMock
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({ ok: true, status: 200 });

            const result = await transport.sendEvents([createMockEvent()]);

            expect(result.success).toBe(true);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should fail after max retries', async () => {
            fetchMock.mockRejectedValue(new Error('Network error'));

            const result = await transport.sendEvents([createMockEvent()]);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(fetchMock).toHaveBeenCalledTimes(2); // maxRetries = 2
        });
    });

    describe('sendIdentify()', () => {
        it('should send identify request to correct endpoint', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
            });

            const payload: IdentifyPayload = {
                workspaceId: 'test-workspace',
                visitorId: 'test-visitor',
                email: 'test@example.com',
                properties: { firstName: 'John' },
            };

            const result = await transport.sendIdentify(payload);

            expect(result.success).toBe(true);
            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.test.com/api/public/track/identify',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(payload),
                })
            );
        });
    });

    describe('sendBeacon()', () => {
        it('should use navigator.sendBeacon when available', () => {
            const beaconMock = vi.fn().mockReturnValue(true);
            vi.stubGlobal('navigator', { sendBeacon: beaconMock });

            const events = [createMockEvent()];
            const result = transport.sendBeacon(events);

            expect(result).toBe(true);
            expect(beaconMock).toHaveBeenCalledWith(
                'https://api.test.com/api/public/track/event',
                expect.any(Blob)
            );
        });

        it('should return false when sendBeacon is not available', () => {
            vi.stubGlobal('navigator', {});

            const result = transport.sendBeacon([createMockEvent()]);

            expect(result).toBe(false);
        });
    });
});
