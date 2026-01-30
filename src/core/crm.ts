/**
 * Clianta SDK - CRM API Client
 * @see SDK_VERSION in core/config.ts
 */

import type { Contact, Opportunity, ApiResponse, PaginatedResponse } from '../types';

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
}
