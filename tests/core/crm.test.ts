import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CRMClient } from '../../src/core/crm';

describe('CRMClient', () => {
    let client: CRMClient;
    const mockConfig = {
        apiKey: 'test-api-key',
        workspaceId: 'test-workspace',
        endpoint: 'https://api.test.com',
    };

    beforeEach(() => {
        client = new CRMClient(mockConfig);
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const mockSuccessResponse = (data: unknown) => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ success: true, data }),
        });
    };

    const mockPaginatedResponse = (data: unknown[], total = 10, page = 1, limit = 10) => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
                success: true,
                data,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            }),
        });
    };

    describe('Companies API', () => {
        const mockCompany = {
            id: 'company-1',
            name: 'Test Company',
            industry: 'Technology',
            website: 'https://test.com',
            size: '50-100',
        };

        it('should get companies with pagination', async () => {
            mockPaginatedResponse([mockCompany]);
            
            const result = await client.getCompanies({ page: 1, limit: 10 });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/companies'),
                expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
            );
            expect(result.data).toHaveLength(1);
        });

        it('should get a single company by ID', async () => {
            mockSuccessResponse(mockCompany);
            
            const result = await client.getCompany('company-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/companies/company-1'),
                expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
            );
            expect(result.data?.id).toBe('company-1');
        });

        it('should create a new company', async () => {
            mockSuccessResponse(mockCompany);
            
            const result = await client.createCompany({
                name: 'Test Company',
                industry: 'Technology',
            });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/companies'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('Test Company'),
                })
            );
            expect(result.data?.name).toBe('Test Company');
        });

        it('should update a company', async () => {
            mockSuccessResponse({ ...mockCompany, name: 'Updated Company' });
            
            const result = await client.updateCompany('company-1', { name: 'Updated Company' });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/companies/company-1'),
                expect.objectContaining({ method: 'PUT' })
            );
            expect(result.data?.name).toBe('Updated Company');
        });

        it('should delete a company', async () => {
            mockSuccessResponse({ deleted: true });
            
            await client.deleteCompany('company-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/companies/company-1'),
                expect.objectContaining({ method: 'DELETE' })
            );
        });

        it('should get company contacts', async () => {
            mockPaginatedResponse([{ id: 'contact-1', companyId: 'company-1' }]);
            
            const result = await client.getCompanyContacts('company-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/companies/company-1/contacts'),
                expect.any(Object)
            );
            expect(result.data).toHaveLength(1);
        });

        it('should get company deals', async () => {
            mockPaginatedResponse([{ id: 'deal-1', companyId: 'company-1' }]);
            
            const result = await client.getCompanyDeals('company-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/companies/company-1/deals'),
                expect.any(Object)
            );
            expect(result.data).toHaveLength(1);
        });
    });

    describe('Pipelines API', () => {
        const mockPipeline = {
            id: 'pipeline-1',
            name: 'Sales Pipeline',
            stages: [
                { id: 'stage-1', name: 'Lead', order: 1 },
                { id: 'stage-2', name: 'Qualified', order: 2 },
            ],
        };

        it('should get all pipelines', async () => {
            mockPaginatedResponse([mockPipeline]);
            
            const result = await client.getPipelines();
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/pipelines'),
                expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
            );
            expect(result.data).toHaveLength(1);
        });

        it('should get a single pipeline by ID', async () => {
            mockSuccessResponse(mockPipeline);
            
            const result = await client.getPipeline('pipeline-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/pipelines/pipeline-1'),
                expect.any(Object)
            );
            expect(result.data?.name).toBe('Sales Pipeline');
        });

        it('should create a new pipeline', async () => {
            mockSuccessResponse(mockPipeline);
            
            const result = await client.createPipeline({
                name: 'Sales Pipeline',
                stages: [
                    { name: 'Lead', order: 1 },
                    { name: 'Qualified', order: 2 },
                ],
            });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/pipelines'),
                expect.objectContaining({ method: 'POST' })
            );
            expect(result.data?.stages).toHaveLength(2);
        });

        it('should update a pipeline', async () => {
            mockSuccessResponse({ ...mockPipeline, name: 'Updated Pipeline' });
            
            const result = await client.updatePipeline('pipeline-1', { name: 'Updated Pipeline' });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/pipelines/pipeline-1'),
                expect.objectContaining({ method: 'PUT' })
            );
            expect(result.data?.name).toBe('Updated Pipeline');
        });

        it('should delete a pipeline', async () => {
            mockSuccessResponse({ deleted: true });
            
            await client.deletePipeline('pipeline-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/pipelines/pipeline-1'),
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });

    describe('Tasks API', () => {
        const mockTask = {
            id: 'task-1',
            title: 'Follow up call',
            type: 'call' as const,
            status: 'pending' as const,
            dueDate: '2024-12-15',
            priority: 'high' as const,
        };

        it('should get all tasks', async () => {
            mockPaginatedResponse([mockTask]);
            
            const result = await client.getTasks();
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/tasks'),
                expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
            );
            expect(result.data).toHaveLength(1);
        });

        it('should get a single task by ID', async () => {
            mockSuccessResponse(mockTask);
            
            const result = await client.getTask('task-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/tasks/task-1'),
                expect.any(Object)
            );
            expect(result.data?.title).toBe('Follow up call');
        });

        it('should create a new task', async () => {
            mockSuccessResponse(mockTask);
            
            const result = await client.createTask({
                title: 'Follow up call',
                type: 'call',
                dueDate: '2024-12-15',
            });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/tasks'),
                expect.objectContaining({ method: 'POST' })
            );
            expect(result.data?.type).toBe('call');
        });

        it('should update a task', async () => {
            mockSuccessResponse({ ...mockTask, status: 'completed' as const });
            
            const result = await client.updateTask('task-1', { status: 'completed' });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/tasks/task-1'),
                expect.objectContaining({ method: 'PUT' })
            );
            expect(result.data?.status).toBe('completed');
        });

        it('should complete a task', async () => {
            mockSuccessResponse({ ...mockTask, status: 'completed' as const });
            
            const result = await client.completeTask('task-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/tasks/task-1/complete'),
                expect.objectContaining({ method: 'PATCH' })
            );
            expect(result.data?.status).toBe('completed');
        });

        it('should delete a task', async () => {
            mockSuccessResponse({ deleted: true });
            
            await client.deleteTask('task-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/tasks/task-1'),
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });

    describe('Activities API', () => {
        const mockActivity = {
            id: 'activity-1',
            type: 'call' as const,
            subject: 'Sales call',
            description: 'Discussed pricing',
            contactId: 'contact-1',
            createdAt: '2024-01-15T10:00:00Z',
        };

        it('should get contact activities', async () => {
            mockPaginatedResponse([mockActivity]);
            
            const result = await client.getContactActivities('contact-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/contacts/contact-1/activities'),
                expect.any(Object)
            );
            expect(result.data).toHaveLength(1);
        });

        it('should get opportunity activities', async () => {
            mockPaginatedResponse([{ ...mockActivity, opportunityId: 'opp-1' }]);
            
            const result = await client.getOpportunityActivities('opp-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/opportunities/opp-1/activities'),
                expect.any(Object)
            );
            expect(result.data).toHaveLength(1);
        });

        it('should create an activity', async () => {
            mockSuccessResponse(mockActivity);
            
            const result = await client.createActivity({
                type: 'call',
                subject: 'Sales call',
                contactId: 'contact-1',
            });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/activities'),
                expect.objectContaining({ method: 'POST' })
            );
            expect(result.data?.type).toBe('call');
        });

        it('should update an activity', async () => {
            mockSuccessResponse({ ...mockActivity, subject: 'Updated call' });
            
            const result = await client.updateActivity('activity-1', { subject: 'Updated call' });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/activities/activity-1'),
                expect.objectContaining({ method: 'PATCH' })
            );
            expect(result.data?.subject).toBe('Updated call');
        });

        it('should delete an activity', async () => {
            mockSuccessResponse({ deleted: true });
            
            await client.deleteActivity('activity-1');
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/activities/activity-1'),
                expect.objectContaining({ method: 'DELETE' })
            );
        });

        it('should log a call', async () => {
            mockSuccessResponse({ ...mockActivity, type: 'call' as const });
            
            const result = await client.logCall('contact-1', {
                subject: 'Cold call',
                duration: 300,
                outcome: 'interested',
            });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/activities'),
                expect.objectContaining({ method: 'POST' })
            );
            expect(result.data?.type).toBe('call');
        });

        it('should log a meeting', async () => {
            mockSuccessResponse({ ...mockActivity, type: 'meeting' as const });
            
            const result = await client.logMeeting('contact-1', {
                subject: 'Demo meeting',
                startTime: '2024-01-15T10:00:00Z',
                endTime: '2024-01-15T11:00:00Z',
                attendees: ['user@test.com'],
            });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/activities'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should add a note', async () => {
            mockSuccessResponse({ ...mockActivity, type: 'note' as const });
            
            const result = await client.addNote({ contactId: 'contact-1', content: 'Important note about this contact' });
            
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/activities'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('Important note'),
                })
            );
        });
    });
});
