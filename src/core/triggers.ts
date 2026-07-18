/**
 * Eutexa SDK - Event Triggers Manager
 * Manages event-driven automation and email notifications
 */

import type {
    EventTrigger,
    TriggerEventType,
    TriggerCondition,
    TriggerAction,
    EmailAction,
    WebhookAction,
    TaskAction,
    ContactUpdateAction,
    ApiResponse,
} from '../types';
import { logger } from './logger';

/**
 * Event Triggers Manager
 * Handles event-driven automation based on CRM actions
 * 
 * Similar to:
 * - Salesforce: Process Builder, Flow Automation
 * - HubSpot: Workflows, Email Sequences
 * - Pipedrive: Workflow Automation
 */
export class EventTriggersManager {
    private apiEndpoint: string;
    private workspaceId: string;
    private authToken?: string;
    private triggers: Map<string, EventTrigger> = new Map();
    private listeners: Map<TriggerEventType, Set<(data: unknown) => void>> = new Map();

    constructor(apiEndpoint: string, workspaceId: string, authToken?: string) {
        this.apiEndpoint = apiEndpoint;
        this.workspaceId = workspaceId;
        this.authToken = authToken;
    }

    /**
     * Set authentication token
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
    // TRIGGER MANAGEMENT
    // ============================================

    /**
     * Get all event triggers
     */
    async getTriggers(): Promise<ApiResponse<EventTrigger[]>> {
        return this.request<EventTrigger[]>(
            `/api/workspaces/${this.workspaceId}/triggers`
        );
    }

    /**
     * Get a single trigger by ID
     */
    async getTrigger(triggerId: string): Promise<ApiResponse<EventTrigger>> {
        return this.request<EventTrigger>(
            `/api/workspaces/${this.workspaceId}/triggers/${triggerId}`
        );
    }

    /**
     * Create a new event trigger
     */
    async createTrigger(trigger: Partial<EventTrigger>): Promise<ApiResponse<EventTrigger>> {
        const result = await this.request<EventTrigger>(
            `/api/workspaces/${this.workspaceId}/triggers`,
            {
                method: 'POST',
                body: JSON.stringify(trigger),
            }
        );

        // Cache the trigger locally if successful
        if (result.success && result.data?._id) {
            this.triggers.set(result.data._id, result.data);
        }

        return result;
    }

    /**
     * Update an existing trigger
     */
    async updateTrigger(
        triggerId: string,
        updates: Partial<EventTrigger>
    ): Promise<ApiResponse<EventTrigger>> {
        const result = await this.request<EventTrigger>(
            `/api/workspaces/${this.workspaceId}/triggers/${triggerId}`,
            {
                method: 'PUT',
                body: JSON.stringify(updates),
            }
        );

        // Update cache if successful
        if (result.success && result.data?._id) {
            this.triggers.set(result.data._id, result.data);
        }

        return result;
    }

    /**
     * Delete a trigger
     */
    async deleteTrigger(triggerId: string): Promise<ApiResponse<void>> {
        const result = await this.request<void>(
            `/api/workspaces/${this.workspaceId}/triggers/${triggerId}`,
            {
                method: 'DELETE',
            }
        );

        // Remove from cache if successful
        if (result.success) {
            this.triggers.delete(triggerId);
        }

        return result;
    }

    /**
     * Activate a trigger
     */
    async activateTrigger(triggerId: string): Promise<ApiResponse<EventTrigger>> {
        return this.updateTrigger(triggerId, { isActive: true });
    }

    /**
     * Deactivate a trigger
     */
    async deactivateTrigger(triggerId: string): Promise<ApiResponse<EventTrigger>> {
        return this.updateTrigger(triggerId, { isActive: false });
    }

    // ============================================
    // EVENT HANDLING (CLIENT-SIDE)
    // ============================================

    /**
     * Register a local event listener for client-side triggers
     * This allows immediate client-side reactions to events
     */
    on(eventType: TriggerEventType, callback: (data: unknown) => void): void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)!.add(callback);
        logger.debug(`Event listener registered: ${eventType}`);
    }

    /**
     * Remove an event listener
     */
    off(eventType: TriggerEventType, callback: (data: unknown) => void): void {
        const listeners = this.listeners.get(eventType);
        if (listeners) {
            listeners.delete(callback);
        }
    }

    /**
     * Emit an event (client-side only)
     * This will trigger any registered local listeners
     */
    emit(eventType: TriggerEventType, data: unknown): void {
        logger.debug(`Event emitted: ${eventType}`, data);
        
        const listeners = this.listeners.get(eventType);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.error(`Error in event listener for ${eventType}:`, error);
                }
            });
        }
    }

    /**
     * Check if conditions are met for a trigger
     * Supports dynamic field evaluation including custom fields and nested paths
     */
    private evaluateConditions(conditions: TriggerCondition[], data: Record<string, unknown>): boolean {
        if (!conditions || conditions.length === 0) {
            return true; // No conditions means always fire
        }

        return conditions.every(condition => {
            // Support dot notation for nested fields (e.g., 'customFields.industry')
            const fieldValue = condition.field.includes('.') 
                ? this.getNestedValue(data, condition.field)
                : data[condition.field];
            const targetValue = condition.value;

            switch (condition.operator) {
                case 'equals':
                    return fieldValue === targetValue;
                case 'not_equals':
                    return fieldValue !== targetValue;
                case 'contains':
                    return String(fieldValue).includes(String(targetValue));
                case 'greater_than':
                    return Number(fieldValue) > Number(targetValue);
                case 'less_than':
                    return Number(fieldValue) < Number(targetValue);
                case 'in':
                    return Array.isArray(targetValue) && targetValue.includes(fieldValue);
                case 'not_in':
                    return Array.isArray(targetValue) && !targetValue.includes(fieldValue);
                default:
                    return false;
            }
        });
    }

    /**
     * Execute actions for a triggered event (client-side preview)
     * Note: Actual execution happens on the backend
     */
    async executeActions(trigger: EventTrigger, data: Record<string, unknown>): Promise<void> {
        logger.info(`Executing actions for trigger: ${trigger.name}`);

        for (const action of trigger.actions) {
            try {
                await this.executeAction(action, data);
            } catch (error) {
                logger.error(`Failed to execute action:`, error);
            }
        }
    }

    /**
     * Execute a single action
     */
    private async executeAction(action: TriggerAction, data: Record<string, unknown>): Promise<void> {
        switch (action.type) {
            case 'send_email':
                await this.executeSendEmail(action as EmailAction, data);
                break;
            case 'webhook':
                await this.executeWebhook(action as WebhookAction, data);
                break;
            case 'create_task':
                await this.executeCreateTask(action as TaskAction, data);
                break;
            case 'update_contact':
                await this.executeUpdateContact(action as ContactUpdateAction, data);
                break;
            default:
                logger.warn(`Unknown action type:`, action);
        }
    }

    /**
     * Execute send email action (via backend API)
     */
    private async executeSendEmail(action: EmailAction, data: Record<string, unknown>): Promise<void> {
        logger.debug('Sending email:', action);

        const payload = {
            to: this.replaceVariables(action.to, data),
            subject: action.subject ? this.replaceVariables(action.subject, data) : undefined,
            body: action.body ? this.replaceVariables(action.body, data) : undefined,
            templateId: action.templateId,
            cc: action.cc,
            bcc: action.bcc,
            from: action.from,
            delayMinutes: action.delayMinutes,
        };

        await this.request(
            `/api/workspaces/${this.workspaceId}/emails/send`,
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        );
    }

    /**
     * Execute webhook action
     */
    private async executeWebhook(action: WebhookAction, data: Record<string, unknown>): Promise<void> {
        logger.debug('Calling webhook:', action.url);

        const body = action.body ? this.replaceVariables(action.body, data) : JSON.stringify(data);

        await fetch(action.url, {
            method: action.method,
            headers: {
                'Content-Type': 'application/json',
                ...action.headers,
            },
            body,
        });
    }

    /**
     * Execute create task action
     */
    private async executeCreateTask(action: TaskAction, data: Record<string, unknown>): Promise<void> {
        logger.debug('Creating task:', action.title);

        const dueDate = action.dueDays
            ? new Date(Date.now() + action.dueDays * 24 * 60 * 60 * 1000).toISOString()
            : undefined;

        await this.request(
            `/api/workspaces/${this.workspaceId}/tasks`,
            {
                method: 'POST',
                body: JSON.stringify({
                    title: this.replaceVariables(action.title, data),
                    description: action.description ? this.replaceVariables(action.description, data) : undefined,
                    priority: action.priority,
                    dueDate,
                    assignedTo: action.assignedTo,
                    relatedContactId: typeof data.contactId === 'string' ? data.contactId : undefined,
                }),
            }
        );
    }

    /**
     * Execute update contact action
     */
    private async executeUpdateContact(action: ContactUpdateAction, data: Record<string, unknown>): Promise<void> {
        const contactId = data.contactId || data._id;
        if (!contactId) {
            logger.warn('Cannot update contact: no contactId in data');
            return;
        }

        logger.debug('Updating contact:', contactId);

        await this.request(
            `/api/workspaces/${this.workspaceId}/contacts/${contactId}`,
            {
                method: 'PUT',
                body: JSON.stringify(action.updates),
            }
        );
    }

    /**
     * Replace variables in a string template
     * Supports syntax like {{contact.email}}, {{opportunity.value}}
     */
    private replaceVariables(template: string, data: Record<string, unknown>): string {
        return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const value = this.getNestedValue(data, path.trim());
            return value !== undefined ? String(value) : match;
        });
    }

    /**
     * Get nested value from object using dot notation
     * Supports dynamic field access including custom fields
     */
    private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
        return path.split('.').reduce((current: unknown, key: string) => {
            return current !== null && current !== undefined && typeof current === 'object' 
                ? (current as Record<string, unknown>)[key] 
                : undefined;
        }, obj);
    }

    /**
     * Extract all available field paths from a data object
     * Useful for dynamic field discovery based on platform-specific attributes
     * @param obj - The data object to extract fields from
     * @param prefix - Internal use for nested paths
     * @param maxDepth - Maximum depth to traverse (default: 3)
     * @returns Array of field paths (e.g., ['email', 'contact.firstName', 'customFields.industry'])
     */
    private extractAvailableFields(
        obj: Record<string, unknown>, 
        prefix: string = '', 
        maxDepth: number = 3
    ): string[] {
        if (maxDepth <= 0) return [];
        
        const fields: string[] = [];
        
        for (const key in obj) {
            if (!obj.hasOwnProperty(key)) continue;
            
            const value = obj[key];
            const fieldPath = prefix ? `${prefix}.${key}` : key;
            
            fields.push(fieldPath);
            
            // Recursively traverse nested objects
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                const nestedFields = this.extractAvailableFields(
                    value as Record<string, unknown>,
                    fieldPath,
                    maxDepth - 1
                );
                fields.push(...nestedFields);
            }
        }
        
        return fields;
    }

    /**
     * Get available fields from sample data
     * Helps with dynamic field detection for platform-specific attributes
     * @param sampleData - Sample data object to analyze
     * @returns Array of available field paths
     */
    getAvailableFields(sampleData: Record<string, unknown>): string[] {
        return this.extractAvailableFields(sampleData);
    }

    // ============================================
    // HELPER METHODS FOR COMMON PATTERNS
    // ============================================

    /**
     * Create a simple email trigger
     * Helper method for common use case
     */
    async createEmailTrigger(config: {
        name: string;
        eventType: TriggerEventType;
        to: string;
        subject: string;
        body: string;
        conditions?: TriggerCondition[];
    }): Promise<ApiResponse<EventTrigger>> {
        return this.createTrigger({
            name: config.name,
            eventType: config.eventType,
            conditions: config.conditions,
            actions: [
                {
                    type: 'send_email',
                    to: config.to,
                    subject: config.subject,
                    body: config.body,
                },
            ],
            isActive: true,
        });
    }

    /**
     * Create a task creation trigger
     */
    async createTaskTrigger(config: {
        name: string;
        eventType: TriggerEventType;
        taskTitle: string;
        taskDescription?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        dueDays?: number;
        conditions?: TriggerCondition[];
    }): Promise<ApiResponse<EventTrigger>> {
        return this.createTrigger({
            name: config.name,
            eventType: config.eventType,
            conditions: config.conditions,
            actions: [
                {
                    type: 'create_task',
                    title: config.taskTitle,
                    description: config.taskDescription,
                    priority: config.priority,
                    dueDays: config.dueDays,
                },
            ],
            isActive: true,
        });
    }

    /**
     * Create a webhook trigger
     */
    async createWebhookTrigger(config: {
        name: string;
        eventType: TriggerEventType;
        webhookUrl: string;
        method?: 'POST' | 'PUT' | 'PATCH';
        conditions?: TriggerCondition[];
    }): Promise<ApiResponse<EventTrigger>> {
        return this.createTrigger({
            name: config.name,
            eventType: config.eventType,
            conditions: config.conditions,
            actions: [
                {
                    type: 'webhook',
                    url: config.webhookUrl,
                    method: config.method || 'POST',
                },
            ],
            isActive: true,
        });
    }
}
