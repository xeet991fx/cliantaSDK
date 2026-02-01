/**
 * Clianta SDK - CRM API Client
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
    PaginatedResponse 
} from '../types';

/**
 * CRM API Client for managing contacts and opportunities
 */
export class CRMClient {
    private apiEndpoint: string;
    private workspaceId: string;
    private authToken?: string;

    constructor(apiEndpoint: string, workspaceId: string, authToken?: string) {
        this.apiEndpoint = apiEndpoint;
        this.workspaceId = workspaceId;
        this.authToken = authToken;
    }

    /**
     * Set authentication token for API requests
     */
    setAuthToken(token: string): void {
        this.authToken = token;
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

        if (this.authToken) {
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
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());

        const query = queryParams.toString();
        const endpoint = `/api/workspaces/${this.workspaceId}/companies/${companyId}/deals${query ? `?${query}` : ''}`;

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
}
