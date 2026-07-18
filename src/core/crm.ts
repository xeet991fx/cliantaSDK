/**
 * Eutexa SDK - CRM API Client
 * @see SDK_VERSION in core/config.ts
 */

import type {
    Contact,
    Company,
    Opportunity,
    Pipeline,
    Task,
    Activity,
    ApiResponse,
    PaginatedResponse,
    EventTrigger,
    EmailTemplate,
} from '../types';
import { EventTriggersManager } from './triggers';

// Supported event types for the inbound events endpoint
export type InboundEventType =
    | 'user.registered'
    | 'user.updated'
    | 'user.subscribed'
    | 'user.unsubscribed'
    | 'contact.created'
    | 'contact.updated'
    | 'purchase.completed';

export interface InboundEventPayload {
    /** Event type (e.g. "user.registered") */
    event: InboundEventType;
    /** Contact data — at least email or phone is required */
    contact: {
        email?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
        company?: string;
        jobTitle?: string;
        tags?: string[];
    };
    /** Optional extra data stored as customFields on the contact */
    data?: Record<string, unknown>;
}

export interface InboundEventResult {
    success: boolean;
    contactCreated: boolean;
    contactId?: string;
    event: string;
    error?: string;
}

/**
 * CRM API Client for managing contacts and opportunities
 */
export class CRMClient {
    private apiEndpoint: string;
    private workspaceId: string;
    private authToken?: string;
    private apiKey?: string;
    public triggers: EventTriggersManager;

    constructor(apiEndpoint: string, workspaceId: string, authToken?: string, apiKey?: string) {
        this.apiEndpoint = apiEndpoint;
        this.workspaceId = workspaceId;
        this.authToken = authToken;
        this.apiKey = apiKey;
        this.triggers = new EventTriggersManager(apiEndpoint, workspaceId, authToken);
    }

    /**
     * Set authentication token for API requests (user JWT)
     */
    setAuthToken(token: string): void {
        this.authToken = token;
        this.apiKey = undefined;
        this.triggers.setAuthToken(token);
    }

    /**
     * Set workspace API key for server-to-server requests.
     * Use this instead of setAuthToken when integrating from an external app.
     */
    setApiKey(key: string): void {
        this.apiKey = key;
        this.authToken = undefined;
    }

    /**
     * Validate required parameter exists
     * @throws {Error} if value is null/undefined or empty string
     */
    private validateRequired(param: string, value: unknown, methodName: string): void {
        if (value === null || value === undefined || value === '') {
            throw new Error(`[CRMClient.${methodName}] ${param} is required`);
        }
    }

    /**
     * Make authenticated API request
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = `${this.apiEndpoint}${endpoint}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {}),
        };

        if (this.apiKey) {
            headers['X-Api-Key'] = this.apiKey;
        } else if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.message || 'Request failed',
                    status: response.status,
                };
            }

            return {
                success: true,
                data: data.data || data,
                status: response.status,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
                status: 0,
            };
        }
    }

    // ============================================
    // INBOUND EVENTS API (API-key authenticated)
    // ============================================

    /**
     * Send an inbound event from an external app (e.g. user signup on client website).
     * Requires the client to be initialized with an API key via setApiKey() or the constructor.
     *
     * The contact is upserted in the CRM and matching workflow automations fire automatically.
     *
     * @example
     * const crm = new CRMClient('http://localhost:5000', 'WORKSPACE_ID');
     * crm.setApiKey('mm_live_...');
     *
     * await crm.sendEvent({
     *   event: 'user.registered',
     *   contact: { email: 'alice@example.com', firstName: 'Alice' },
     *   data: { plan: 'free', signupSource: 'homepage' },
     * });
     */
    async sendEvent(payload: InboundEventPayload): Promise<InboundEventResult> {
        const url = `${this.apiEndpoint}/api/public/events`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        if (this.apiKey) {
            headers['X-Api-Key'] = this.apiKey;
        } else if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    contactCreated: false,
                    event: payload.event,
                    error: data.error || 'Request failed',
                };
            }

            return {
                success: data.success,
                contactCreated: data.contactCreated,
                contactId: data.contactId,
                event: data.event,
            };
        } catch (error) {
            return {
                success: false,
                contactCreated: false,
                event: payload.event,
                error: error instanceof Error ? error.message : 'Network error',
            };
        }
    }

    // ============================================
    // CONTACTS API
    // ============================================

    /**
     * Get all contacts with pagination
     */
    async getContacts(params?: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
    }): Promise<ApiResponse<PaginatedResponse<Contact>>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.search) queryParams.set('search', params.search);
        if (params?.status) queryParams.set('status', params.status);

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/contacts${query ? `?${query}` : ''}`;

        return this.request<PaginatedResponse<Contact>>(endpoint);
    }

    /**
     * Get a single contact by ID
     */
    async getContact(contactId: string): Promise<ApiResponse<Contact>> {
        this.validateRequired('contactId', contactId, 'getContact');
        return this.request<Contact>(
            `/api/workspaces/${this.workspaceId}/contacts/${contactId}`
        );
    }

    /**
     * Create a new contact
     */
    async createContact(contact: Partial<Contact>): Promise<ApiResponse<Contact>> {
        return this.request<Contact>(
            `/api/workspaces/${this.workspaceId}/contacts`,
            {
                method: 'POST',
                body: JSON.stringify(contact),
            }
        );
    }

    /**
     * Update an existing contact
     */
    async updateContact(
        contactId: string,
        updates: Partial<Contact>
    ): Promise<ApiResponse<Contact>> {
        this.validateRequired('contactId', contactId, 'updateContact');
        return this.request<Contact>(
            `/api/workspaces/${this.workspaceId}/contacts/${contactId}`,
            {
                method: 'PUT',
                body: JSON.stringify(updates),
            }
        );
    }

    /**
     * Delete a contact
     */
    async deleteContact(contactId: string): Promise<ApiResponse<void>> {
        this.validateRequired('contactId', contactId, 'deleteContact');
        return this.request<void>(
            `/api/workspaces/${this.workspaceId}/contacts/${contactId}`,
            {
                method: 'DELETE',
            }
        );
    }

    // ============================================
    // OPPORTUNITIES API
    // ============================================

    /**
     * Get all opportunities with pagination
     */
    async getOpportunities(params?: {
        page?: number;
        limit?: number;
        pipelineId?: string;
        stageId?: string;
    }): Promise<ApiResponse<PaginatedResponse<Opportunity>>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.pipelineId) queryParams.set('pipelineId', params.pipelineId);
        if (params?.stageId) queryParams.set('stageId', params.stageId);

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/opportunities${query ? `?${query}` : ''}`;

        return this.request<PaginatedResponse<Opportunity>>(endpoint);
    }

    /**
     * Get a single opportunity by ID
     */
    async getOpportunity(opportunityId: string): Promise<ApiResponse<Opportunity>> {
        return this.request<Opportunity>(
            `/api/workspaces/${this.workspaceId}/opportunities/${opportunityId}`
        );
    }

    /**
     * Create a new opportunity
     */
    async createOpportunity(
        opportunity: Partial<Opportunity>
    ): Promise<ApiResponse<Opportunity>> {
        return this.request<Opportunity>(
            `/api/workspaces/${this.workspaceId}/opportunities`,
            {
                method: 'POST',
                body: JSON.stringify(opportunity),
            }
        );
    }

    /**
     * Update an existing opportunity
     */
    async updateOpportunity(
        opportunityId: string,
        updates: Partial<Opportunity>
    ): Promise<ApiResponse<Opportunity>> {
        return this.request<Opportunity>(
            `/api/workspaces/${this.workspaceId}/opportunities/${opportunityId}`,
            {
                method: 'PUT',
                body: JSON.stringify(updates),
            }
        );
    }

    /**
     * Delete an opportunity
     */
    async deleteOpportunity(opportunityId: string): Promise<ApiResponse<void>> {
        return this.request<void>(
            `/api/workspaces/${this.workspaceId}/opportunities/${opportunityId}`,
            {
                method: 'DELETE',
            }
        );
    }

    /**
     * Move opportunity to a different stage
     */
    async moveOpportunity(
        opportunityId: string,
        stageId: string
    ): Promise<ApiResponse<Opportunity>> {
        return this.request<Opportunity>(
            `/api/workspaces/${this.workspaceId}/opportunities/${opportunityId}/move`,
            {
                method: 'POST',
                body: JSON.stringify({ stageId }),
            }
        );
    }

    // ============================================
    // COMPANIES API
    // ============================================

    /**
     * Get all companies with pagination
     */
    async getCompanies(params?: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        industry?: string;
    }): Promise<ApiResponse<PaginatedResponse<Company>>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.search) queryParams.set('search', params.search);
        if (params?.status) queryParams.set('status', params.status);
        if (params?.industry) queryParams.set('industry', params.industry);

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/companies${query ? `?${query}` : ''}`;

        return this.request<PaginatedResponse<Company>>(endpoint);
    }

    /**
     * Get a single company by ID
     */
    async getCompany(companyId: string): Promise<ApiResponse<Company>> {
        return this.request<Company>(
            `/api/workspaces/${this.workspaceId}/companies/${companyId}`
        );
    }

    /**
     * Create a new company
     */
    async createCompany(company: Partial<Company>): Promise<ApiResponse<Company>> {
        return this.request<Company>(
            `/api/workspaces/${this.workspaceId}/companies`,
            {
                method: 'POST',
                body: JSON.stringify(company),
            }
        );
    }

    /**
     * Update an existing company
     */
    async updateCompany(
        companyId: string,
        updates: Partial<Company>
    ): Promise<ApiResponse<Company>> {
        return this.request<Company>(
            `/api/workspaces/${this.workspaceId}/companies/${companyId}`,
            {
                method: 'PUT',
                body: JSON.stringify(updates),
            }
        );
    }

    /**
     * Delete a company
     */
    async deleteCompany(companyId: string): Promise<ApiResponse<void>> {
        return this.request<void>(
            `/api/workspaces/${this.workspaceId}/companies/${companyId}`,
            {
                method: 'DELETE',
            }
        );
    }

    /**
     * Get contacts belonging to a company
     */
    async getCompanyContacts(
        companyId: string,
        params?: { page?: number; limit?: number }
    ): Promise<ApiResponse<PaginatedResponse<Contact>>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/companies/${companyId}/contacts${query ? `?${query}` : ''}`;

        return this.request<PaginatedResponse<Contact>>(endpoint);
    }

    /**
     * Get deals/opportunities belonging to a company
     */
    async getCompanyDeals(
        companyId: string,
        params?: { page?: number; limit?: number }
    ): Promise<ApiResponse<PaginatedResponse<Opportunity>>> {
        const queryParams = new URLSearchParams();
        queryParams.set('companyId', companyId);
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());

        const endpoint = `/api/workspaces/${this.workspaceId}/opportunities?${queryParams.toString()}`;

        return this.request<PaginatedResponse<Opportunity>>(endpoint);
    }

    // ============================================
    // PIPELINES API
    // ============================================

    /**
     * Get all pipelines
     */
    async getPipelines(): Promise<ApiResponse<Pipeline[]>> {
        return this.request<Pipeline[]>(
            `/api/workspaces/${this.workspaceId}/pipelines`
        );
    }

    /**
     * Get a single pipeline by ID
     */
    async getPipeline(pipelineId: string): Promise<ApiResponse<Pipeline>> {
        return this.request<Pipeline>(
            `/api/workspaces/${this.workspaceId}/pipelines/${pipelineId}`
        );
    }

    /**
     * Create a new pipeline
     */
    async createPipeline(pipeline: Partial<Pipeline>): Promise<ApiResponse<Pipeline>> {
        return this.request<Pipeline>(
            `/api/workspaces/${this.workspaceId}/pipelines`,
            {
                method: 'POST',
                body: JSON.stringify(pipeline),
            }
        );
    }

    /**
     * Update an existing pipeline
     */
    async updatePipeline(
        pipelineId: string,
        updates: Partial<Pipeline>
    ): Promise<ApiResponse<Pipeline>> {
        return this.request<Pipeline>(
            `/api/workspaces/${this.workspaceId}/pipelines/${pipelineId}`,
            {
                method: 'PUT',
                body: JSON.stringify(updates),
            }
        );
    }

    /**
     * Delete a pipeline
     */
    async deletePipeline(pipelineId: string): Promise<ApiResponse<void>> {
        return this.request<void>(
            `/api/workspaces/${this.workspaceId}/pipelines/${pipelineId}`,
            {
                method: 'DELETE',
            }
        );
    }

    // ============================================
    // TASKS API
    // ============================================

    /**
     * Get all tasks with pagination
     */
    async getTasks(params?: {
        page?: number;
        limit?: number;
        status?: string;
        priority?: string;
        contactId?: string;
        companyId?: string;
        opportunityId?: string;
    }): Promise<ApiResponse<PaginatedResponse<Task>>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.status) queryParams.set('status', params.status);
        if (params?.priority) queryParams.set('priority', params.priority);
        if (params?.contactId) queryParams.set('contactId', params.contactId);
        if (params?.companyId) queryParams.set('companyId', params.companyId);
        if (params?.opportunityId) queryParams.set('opportunityId', params.opportunityId);

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/tasks${query ? `?${query}` : ''}`;

        return this.request<PaginatedResponse<Task>>(endpoint);
    }

    /**
     * Get a single task by ID
     */
    async getTask(taskId: string): Promise<ApiResponse<Task>> {
        return this.request<Task>(
            `/api/workspaces/${this.workspaceId}/tasks/${taskId}`
        );
    }

    /**
     * Create a new task
     */
    async createTask(task: Partial<Task>): Promise<ApiResponse<Task>> {
        return this.request<Task>(
            `/api/workspaces/${this.workspaceId}/tasks`,
            {
                method: 'POST',
                body: JSON.stringify(task),
            }
        );
    }

    /**
     * Update an existing task
     */
    async updateTask(
        taskId: string,
        updates: Partial<Task>
    ): Promise<ApiResponse<Task>> {
        return this.request<Task>(
            `/api/workspaces/${this.workspaceId}/tasks/${taskId}`,
            {
                method: 'PUT',
                body: JSON.stringify(updates),
            }
        );
    }

    /**
     * Mark a task as completed
     */
    async completeTask(taskId: string): Promise<ApiResponse<Task>> {
        return this.request<Task>(
            `/api/workspaces/${this.workspaceId}/tasks/${taskId}/complete`,
            {
                method: 'PATCH',
            }
        );
    }

    /**
     * Delete a task
     */
    async deleteTask(taskId: string): Promise<ApiResponse<void>> {
        return this.request<void>(
            `/api/workspaces/${this.workspaceId}/tasks/${taskId}`,
            {
                method: 'DELETE',
            }
        );
    }

    // ============================================
    // ACTIVITIES API
    // ============================================

    /**
     * Get activities for a contact
     */
    async getContactActivities(
        contactId: string,
        params?: { page?: number; limit?: number; type?: string }
    ): Promise<ApiResponse<PaginatedResponse<Activity>>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.type) queryParams.set('type', params.type);

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/contacts/${contactId}/activities${query ? `?${query}` : ''}`;

        return this.request<PaginatedResponse<Activity>>(endpoint);
    }

    /**
     * Get activities for an opportunity/deal
     */
    async getOpportunityActivities(
        opportunityId: string,
        params?: { page?: number; limit?: number; type?: string }
    ): Promise<ApiResponse<PaginatedResponse<Activity>>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.type) queryParams.set('type', params.type);

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/opportunities/${opportunityId}/activities${query ? `?${query}` : ''}`;

        return this.request<PaginatedResponse<Activity>>(endpoint);
    }

    /**
     * Create a new activity
     */
    async createActivity(activity: Partial<Activity>): Promise<ApiResponse<Activity>> {
        // Determine the correct endpoint based on related entity
        let endpoint: string;
        if (activity.opportunityId) {
            endpoint = `/api/workspaces/${this.workspaceId}/opportunities/${activity.opportunityId}/activities`;
        } else if (activity.contactId) {
            endpoint = `/api/workspaces/${this.workspaceId}/contacts/${activity.contactId}/activities`;
        } else {
            endpoint = `/api/workspaces/${this.workspaceId}/activities`;
        }

        return this.request<Activity>(endpoint, {
            method: 'POST',
            body: JSON.stringify(activity),
        });
    }

    /**
     * Update an existing activity
     */
    async updateActivity(
        activityId: string,
        updates: Partial<Activity>
    ): Promise<ApiResponse<Activity>> {
        return this.request<Activity>(
            `/api/workspaces/${this.workspaceId}/activities/${activityId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(updates),
            }
        );
    }

    /**
     * Delete an activity
     */
    async deleteActivity(activityId: string): Promise<ApiResponse<void>> {
        return this.request<void>(
            `/api/workspaces/${this.workspaceId}/activities/${activityId}`,
            {
                method: 'DELETE',
            }
        );
    }

    /**
     * Log a call activity
     */
    async logCall(data: {
        contactId?: string;
        opportunityId?: string;
        direction: 'inbound' | 'outbound';
        duration?: number;
        outcome?: string;
        notes?: string;
    }): Promise<ApiResponse<Activity>> {
        return this.createActivity({
            type: 'call',
            title: `${data.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call`,
            direction: data.direction,
            duration: data.duration,
            outcome: data.outcome,
            description: data.notes,
            contactId: data.contactId,
            opportunityId: data.opportunityId,
        });
    }

    /**
     * Log a meeting activity
     */
    async logMeeting(data: {
        contactId?: string;
        opportunityId?: string;
        title: string;
        duration?: number;
        outcome?: string;
        notes?: string;
    }): Promise<ApiResponse<Activity>> {
        return this.createActivity({
            type: 'meeting',
            title: data.title,
            duration: data.duration,
            outcome: data.outcome,
            description: data.notes,
            contactId: data.contactId,
            opportunityId: data.opportunityId,
        });
    }

    /**
     * Add a note to a contact or opportunity
     */
    async addNote(data: {
        contactId?: string;
        opportunityId?: string;
        content: string;
    }): Promise<ApiResponse<Activity>> {
        return this.createActivity({
            type: 'note',
            title: 'Note',
            description: data.content,
            contactId: data.contactId,
            opportunityId: data.opportunityId,
        });
    }

    // ============================================
    // EMAIL TEMPLATES API
    // ============================================

    /**
     * Get all email templates
     */
    async getEmailTemplates(params?: {
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResponse<EmailTemplate>>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/email-templates${query ? `?${query}` : ''}`;

        return this.request<PaginatedResponse<EmailTemplate>>(endpoint);
    }

    /**
     * Get a single email template by ID
     */
    async getEmailTemplate(templateId: string): Promise<ApiResponse<EmailTemplate>> {
        return this.request<EmailTemplate>(
            `/api/workspaces/${this.workspaceId}/email-templates/${templateId}`
        );
    }

    /**
     * Create a new email template
     */
    async createEmailTemplate(template: Partial<EmailTemplate>): Promise<ApiResponse<EmailTemplate>> {
        return this.request<EmailTemplate>(
            `/api/workspaces/${this.workspaceId}/email-templates`,
            {
                method: 'POST',
                body: JSON.stringify(template),
            }
        );
    }

    /**
     * Update an email template
     */
    async updateEmailTemplate(
        templateId: string,
        updates: Partial<EmailTemplate>
    ): Promise<ApiResponse<EmailTemplate>> {
        return this.request<EmailTemplate>(
            `/api/workspaces/${this.workspaceId}/email-templates/${templateId}`,
            {
                method: 'PUT',
                body: JSON.stringify(updates),
            }
        );
    }

    /**
     * Delete an email template
     */
    async deleteEmailTemplate(templateId: string): Promise<ApiResponse<void>> {
        return this.request<void>(
            `/api/workspaces/${this.workspaceId}/email-templates/${templateId}`,
            {
                method: 'DELETE',
            }
        );
    }

    /**
     * Send an email using a template
     */
    async sendEmail(data: {
        to: string;
        templateId?: string;
        subject?: string;
        body?: string;
        cc?: string[];
        bcc?: string[];
        variables?: Record<string, unknown>;
        contactId?: string;
    }): Promise<ApiResponse<{ messageId: string }>> {
        return this.request<{ messageId: string }>(
            `/api/workspaces/${this.workspaceId}/emails/send`,
            {
                method: 'POST',
                body: JSON.stringify(data),
            }
        );
    }

    // ============================================
    // READ-BACK / DATA RETRIEVAL API
    // ============================================

    /**
     * Get a contact by email address.
     * Returns the first matching contact from a search query.
     */
    async getContactByEmail(email: string): Promise<ApiResponse<PaginatedResponse<Contact>>> {
        this.validateRequired('email', email, 'getContactByEmail');
        const queryParams = new URLSearchParams({ search: email, limit: '1' });
        return this.request<PaginatedResponse<Contact>>(
            `/api/workspaces/${this.workspaceId}/contacts?${queryParams.toString()}`
        );
    }

    /**
     * Get activity timeline for a contact
     */
    async getContactActivity(
        contactId: string,
        params?: {
            page?: number;
            limit?: number;
            type?: string;
            startDate?: string;
            endDate?: string;
        }
    ): Promise<ApiResponse<PaginatedResponse<Activity>>> {
        this.validateRequired('contactId', contactId, 'getContactActivity');
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        if (params?.type) queryParams.set('type', params.type);
        if (params?.startDate) queryParams.set('startDate', params.startDate);
        if (params?.endDate) queryParams.set('endDate', params.endDate);

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/contacts/${contactId}/activities${query ? `?${query}` : ''}`;

        return this.request<PaginatedResponse<Activity>>(endpoint);
    }

    /**
     * Get engagement metrics for a contact (via their linked visitor data)
     */
    async getContactEngagement(contactId: string): Promise<ApiResponse<{
        totalTimeOnSiteSeconds: number;
        averageSessionDurationSeconds: number;
        totalPageViews: number;
        totalSessions: number;
        engagementScore: number;
        lastActiveAt: string;
    }>> {
        this.validateRequired('contactId', contactId, 'getContactEngagement');
        return this.request(
            `/api/workspaces/${this.workspaceId}/contacts/${contactId}/engagement`
        );
    }

    /**
     * Get a full timeline for a contact including events, activities, and opportunities
     */
    async getContactTimeline(
        contactId: string,
        params?: {
            page?: number;
            limit?: number;
        }
    ): Promise<ApiResponse<PaginatedResponse<{
        type: 'event' | 'activity' | 'opportunity' | 'note';
        title: string;
        description?: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
    }>>> {
        this.validateRequired('contactId', contactId, 'getContactTimeline');
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/contacts/${contactId}/timeline${query ? `?${query}` : ''}`;

        return this.request(endpoint);
    }

    /**
     * Search contacts with advanced filters
     */
    async searchContacts(query: string, filters?: {
        status?: string;
        lifecycleStage?: string;
        source?: string;
        tags?: string[];
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResponse<Contact>>> {
        const queryParams = new URLSearchParams();
        queryParams.set('search', query);
        if (filters?.status) queryParams.set('status', filters.status);
        if (filters?.lifecycleStage) queryParams.set('lifecycleStage', filters.lifecycleStage);
        if (filters?.source) queryParams.set('source', filters.source);
        if (filters?.tags) queryParams.set('tags', filters.tags.join(','));
        if (filters?.page) queryParams.set('page', filters.page.toString());
        if (filters?.limit) queryParams.set('limit', filters.limit.toString());

        const qs = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/contacts${qs ? `?${qs}` : ''}`;

        return this.request<PaginatedResponse<Contact>>(endpoint);
    }

    // ============================================
    // WEBHOOK MANAGEMENT API
    // ============================================

    /**
     * List all webhook subscriptions
     */
    async listWebhooks(params?: {
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<PaginatedResponse<{
        _id: string;
        url: string;
        events: string[];
        isActive: boolean;
        createdAt: string;
    }>>> {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());

        const query = queryParams.toString();
        return this.request(
            `/api/workspaces/${this.workspaceId}/webhooks${query ? `?${query}` : ''}`
        );
    }

    /**
     * Create a new webhook subscription
     */
    async createWebhook(data: {
        url: string;
        events: string[];
        secret?: string;
    }): Promise<ApiResponse<{
        _id: string;
        url: string;
        events: string[];
        isActive: boolean;
    }>> {
        return this.request(
            `/api/workspaces/${this.workspaceId}/webhooks`,
            {
                method: 'POST',
                body: JSON.stringify(data),
            }
        );
    }

    /**
     * Delete a webhook subscription
     */
    async deleteWebhook(webhookId: string): Promise<ApiResponse<void>> {
        this.validateRequired('webhookId', webhookId, 'deleteWebhook');
        return this.request<void>(
            `/api/workspaces/${this.workspaceId}/webhooks/${webhookId}`,
            {
                method: 'DELETE',
            }
        );
    }

    // ============================================
    // EVENT TRIGGERS API (delegated to triggers manager)
    // ============================================

    /**
     * Get all event triggers
     */
    async getEventTriggers(): Promise<ApiResponse<EventTrigger[]>> {
        return this.triggers.getTriggers();
    }

    /**
     * Create a new event trigger
     */
    async createEventTrigger(trigger: Partial<EventTrigger>): Promise<ApiResponse<EventTrigger>> {
        return this.triggers.createTrigger(trigger);
    }

    /**
     * Update an event trigger
     */
    async updateEventTrigger(
        triggerId: string,
        updates: Partial<EventTrigger>
    ): Promise<ApiResponse<EventTrigger>> {
        return this.triggers.updateTrigger(triggerId, updates);
    }

    /**
     * Delete an event trigger
     */
    async deleteEventTrigger(triggerId: string): Promise<ApiResponse<void>> {
        return this.triggers.deleteTrigger(triggerId);
    }
}
