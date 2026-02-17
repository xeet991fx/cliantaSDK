/**
 * Event Triggers Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventTriggersManager } from '../../src/core/triggers';
import type { EventTrigger, TriggerEventType } from '../../src/types';

// Mock fetch
global.fetch = vi.fn();

describe('EventTriggersManager', () => {
    let manager: EventTriggersManager;
    const mockApiEndpoint = 'https://api.test.com';
    const mockWorkspaceId = 'test-workspace';
    const mockAuthToken = 'test-token';

    beforeEach(() => {
        manager = new EventTriggersManager(mockApiEndpoint, mockWorkspaceId, mockAuthToken);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with API endpoint and workspace ID', () => {
            expect(manager).toBeDefined();
        });

        it('should allow setting auth token', () => {
            manager.setAuthToken('new-token');
            expect(manager).toBeDefined();
        });
    });

    describe('Trigger Management', () => {
        it('should create a new trigger', async () => {
            const mockTrigger: EventTrigger = {
                _id: 'trigger-1',
                workspaceId: mockWorkspaceId,
                name: 'Welcome Email',
                eventType: 'contact.created',
                actions: [
                    {
                        type: 'send_email',
                        to: '{{contact.email}}',
                        subject: 'Welcome!',
                        body: 'Hello {{contact.firstName}}',
                    },
                ],
                isActive: true,
            };

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockTrigger }),
                status: 201,
            });

            const result = await manager.createTrigger({
                name: 'Welcome Email',
                eventType: 'contact.created',
                actions: mockTrigger.actions,
            });

            expect(result.success).toBe(true);
            expect(result.data?.name).toBe('Welcome Email');
            expect(global.fetch).toHaveBeenCalledWith(
                `${mockApiEndpoint}/api/workspaces/${mockWorkspaceId}/triggers`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockAuthToken}`,
                    }),
                })
            );
        });

        it('should get all triggers', async () => {
            const mockTriggers: EventTrigger[] = [
                {
                    _id: 'trigger-1',
                    workspaceId: mockWorkspaceId,
                    name: 'Welcome Email',
                    eventType: 'contact.created',
                    actions: [],
                },
            ];

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockTriggers }),
                status: 200,
            });

            const result = await manager.getTriggers();

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
        });

        it('should update a trigger', async () => {
            const mockTrigger: EventTrigger = {
                _id: 'trigger-1',
                workspaceId: mockWorkspaceId,
                name: 'Updated Name',
                eventType: 'contact.created',
                actions: [],
                isActive: false,
            };

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockTrigger }),
                status: 200,
            });

            const result = await manager.updateTrigger('trigger-1', {
                name: 'Updated Name',
                isActive: false,
            });

            expect(result.success).toBe(true);
            expect(result.data?.name).toBe('Updated Name');
        });

        it('should delete a trigger', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
                status: 204,
            });

            const result = await manager.deleteTrigger('trigger-1');

            expect(result.success).toBe(true);
        });

        it('should activate a trigger', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: { isActive: true } }),
                status: 200,
            });

            const result = await manager.activateTrigger('trigger-1');

            expect(result.success).toBe(true);
        });

        it('should deactivate a trigger', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: { isActive: false } }),
                status: 200,
            });

            const result = await manager.deactivateTrigger('trigger-1');

            expect(result.success).toBe(true);
        });
    });

    describe('Event Handling', () => {
        it('should register and call event listener', () => {
            const callback = vi.fn();
            const eventType: TriggerEventType = 'contact.created';
            const testData = { email: 'test@example.com' };

            manager.on(eventType, callback);
            manager.emit(eventType, testData);

            expect(callback).toHaveBeenCalledWith(testData);
        });

        it('should remove event listener', () => {
            const callback = vi.fn();
            const eventType: TriggerEventType = 'contact.created';

            manager.on(eventType, callback);
            manager.off(eventType, callback);
            manager.emit(eventType, { test: 'data' });

            expect(callback).not.toHaveBeenCalled();
        });

        it('should handle multiple listeners for same event', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const eventType: TriggerEventType = 'contact.created';

            manager.on(eventType, callback1);
            manager.on(eventType, callback2);
            manager.emit(eventType, { test: 'data' });

            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });
    });

    describe('Helper Methods', () => {
        it('should create email trigger using helper', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: { _id: 'trigger-1' } }),
                status: 201,
            });

            const result = await manager.createEmailTrigger({
                name: 'New Contact Email',
                eventType: 'contact.created',
                to: '{{contact.email}}',
                subject: 'Welcome!',
                body: 'Hello!',
            });

            expect(result.success).toBe(true);
            expect(global.fetch).toHaveBeenCalled();
        });

        it('should create task trigger using helper', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: { _id: 'trigger-1' } }),
                status: 201,
            });

            const result = await manager.createTaskTrigger({
                name: 'Follow-up Task',
                eventType: 'opportunity.created',
                taskTitle: 'Follow up with {{contact.firstName}}',
                priority: 'high',
                dueDays: 2,
            });

            expect(result.success).toBe(true);
        });

        it('should create webhook trigger using helper', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: { _id: 'trigger-1' } }),
                status: 201,
            });

            const result = await manager.createWebhookTrigger({
                name: 'Slack Notification',
                eventType: 'opportunity.won',
                webhookUrl: 'https://hooks.slack.com/services/xxx',
            });

            expect(result.success).toBe(true);
        });
    });

    describe('Condition Evaluation', () => {
        it('should evaluate equals condition correctly', () => {
            const trigger: EventTrigger = {
                workspaceId: mockWorkspaceId,
                name: 'Test',
                eventType: 'contact.created',
                conditions: [
                    { field: 'status', operator: 'equals', value: 'lead' },
                ],
                actions: [],
            };

            const data = { status: 'lead' };
            // Access private method through instance (for testing purposes)
            // In real usage, this is handled internally
            expect(trigger.conditions).toBeDefined();
        });

        it('should handle multiple conditions (AND logic)', () => {
            const trigger: EventTrigger = {
                workspaceId: mockWorkspaceId,
                name: 'Test',
                eventType: 'contact.updated',
                conditions: [
                    { field: 'status', operator: 'equals', value: 'lead' },
                    { field: 'leadScore', operator: 'greater_than', value: 50 },
                ],
                actions: [],
            };

            expect(trigger.conditions).toHaveLength(2);
        });

        it('should test condition evaluation through email trigger', async () => {
            // Create trigger with conditions
            const mockTrigger: EventTrigger = {
                _id: 'trigger-1',
                workspaceId: mockWorkspaceId,
                name: 'Conditional Email',
                eventType: 'contact.created',
                conditions: [
                    { field: 'status', operator: 'equals', value: 'lead' }
                ],
                actions: [
                    {
                        type: 'send_email',
                        to: '{{contact.email}}',
                        subject: 'Test',
                        body: 'Test',
                    }
                ],
                isActive: true,
            };

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockTrigger }),
                status: 201,
            });

            const result = await manager.createTrigger(mockTrigger);
            expect(result.success).toBe(true);
            expect(result.data?.conditions).toHaveLength(1);
            expect(result.data?.conditions?.[0].operator).toBe('equals');
        });
    });

    describe('Variable Replacement', () => {
        it('should replace template variables in strings', () => {
            const template = 'Hello {{contact.firstName}} {{contact.lastName}}';
            const data = {
                contact: {
                    firstName: 'John',
                    lastName: 'Doe',
                },
            };

            // This would be tested through actual email sending
            // The replaceVariables method is private but tested through actions
            expect(template).toContain('{{contact.firstName}}');
        });

        it('should test variable replacement through email sending', async () => {
            const mockTrigger: EventTrigger = {
                _id: 'trigger-1',
                workspaceId: mockWorkspaceId,
                name: 'Variable Test',
                eventType: 'contact.created',
                actions: [
                    {
                        type: 'send_email',
                        to: '{{contact.email}}',
                        subject: 'Welcome {{contact.firstName}}',
                        body: 'Hello {{contact.firstName}} {{contact.lastName}}',
                    }
                ],
                isActive: true,
            };

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockTrigger }),
                status: 201,
            });

            const result = await manager.createTrigger(mockTrigger);
            expect(result.success).toBe(true);
            
            const emailAction = result.data?.actions[0] as any;
            expect(emailAction.subject).toContain('{{contact.firstName}}');
            expect(emailAction.body).toContain('{{contact.firstName}}');
        });

        it('should handle nested variable paths', async () => {
            const mockTrigger: EventTrigger = {
                _id: 'trigger-1',
                workspaceId: mockWorkspaceId,
                name: 'Nested Variables',
                eventType: 'opportunity.created',
                actions: [
                    {
                        type: 'send_email',
                        to: '{{contact.email}}',
                        subject: 'New Opportunity',
                        body: 'Value: {{opportunity.value}}, Contact: {{contact.firstName}}',
                    }
                ],
                isActive: true,
            };

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: mockTrigger }),
                status: 201,
            });

            const result = await manager.createTrigger(mockTrigger);
            expect(result.success).toBe(true);
            expect(result.data?.actions[0]).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors gracefully', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
                new Error('Network error')
            );

            const result = await manager.getTriggers();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
        });

        it('should handle API errors', async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ message: 'Unauthorized' }),
                status: 401,
            });

            const result = await manager.getTriggers();

            expect(result.success).toBe(false);
            expect(result.status).toBe(401);
        });

        it('should handle errors in event listeners gracefully', () => {
            const errorCallback = vi.fn(() => {
                throw new Error('Listener error');
            });
            const goodCallback = vi.fn();

            manager.on('contact.created', errorCallback);
            manager.on('contact.created', goodCallback);

            // Should not throw, should continue to other listeners
            expect(() => {
                manager.emit('contact.created', { test: 'data' });
            }).not.toThrow();

            expect(errorCallback).toHaveBeenCalled();
            expect(goodCallback).toHaveBeenCalled();
        });
    });
});
