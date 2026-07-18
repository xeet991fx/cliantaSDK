/**
 * VisitorClient — Standalone client for visitor-related API calls.
 * Extracted from Tracker to keep the core Tracker class focused on tracking.
 *
 * Usage (standalone):
 *   const visitor = new VisitorClient(transport, workspaceId, visitorId);
 *   const profile = await visitor.getProfile();
 *
 * Usage (via Tracker):
 *   const tracker = eutexa({ projectId: '...' });
 *   const profile = await tracker.visitor.getProfile();
 */
import type {
    VisitorProfile,
    VisitorActivity,
    VisitorActivityOptions,
    VisitorTimeline,
    EngagementMetrics,
} from '../types';
import { logger } from './logger';

/** Minimal transport interface — only fetchData is needed */
export interface VisitorTransport {
    fetchData<T>(url: string, params?: Record<string, string>): Promise<{
        success: boolean;
        data?: T;
        error?: Error | string;
    }>;
}

/**
 * Privacy-safe visitor API client.
 * All methods return data for the current visitor only (no cross-visitor access).
 */
export class VisitorClient {
    constructor(
        private transport: VisitorTransport,
        private workspaceId: string,
        private visitorId: string
    ) { }

    /** Update visitorId (e.g. after reset) */
    setVisitorId(id: string): void {
        this.visitorId = id;
    }

    private basePath(): string {
        return `/api/public/track/visitor/${this.workspaceId}/${this.visitorId}`;
    }

    /**
     * Get the current visitor's profile from the CRM.
     * Returns visitor data and linked contact info if identified.
     */
    async getProfile(): Promise<VisitorProfile | null> {
        const result = await this.transport.fetchData<VisitorProfile>(
            `${this.basePath()}/profile`
        );
        if (result.success && result.data) {
            logger.debug('Visitor profile fetched:', result.data);
            return result.data;
        }
        logger.warn('Failed to fetch visitor profile:', result.error);
        return null;
    }

    /**
     * Get the current visitor's recent activity/events.
     * Returns paginated list of tracking events.
     */
    async getActivity(
        options?: VisitorActivityOptions
    ): Promise<{
        data: VisitorActivity[];
        pagination: { page: number; limit: number; total: number; pages: number };
    } | null> {
        const params: Record<string, string> = {};
        if (options?.page) params.page = options.page.toString();
        if (options?.limit) params.limit = options.limit.toString();
        if (options?.eventType) params.eventType = options.eventType;
        if (options?.startDate) params.startDate = options.startDate;
        if (options?.endDate) params.endDate = options.endDate;

        const result = await this.transport.fetchData<any>(
            `${this.basePath()}/activity`,
            params
        );
        if (result.success && result.data) {
            return result.data;
        }
        logger.warn('Failed to fetch visitor activity:', result.error);
        return null;
    }

    /**
     * Get a summarized journey timeline for the current visitor.
     * Includes top pages, sessions, time spent, and recent activities.
     */
    async getTimeline(): Promise<VisitorTimeline | null> {
        const result = await this.transport.fetchData<VisitorTimeline>(
            `${this.basePath()}/timeline`
        );
        if (result.success && result.data) {
            return result.data;
        }
        logger.warn('Failed to fetch visitor timeline:', result.error);
        return null;
    }

    /**
     * Get engagement metrics for the current visitor.
     * Includes time on site, page views, bounce rate, and engagement score.
     */
    async getEngagement(): Promise<EngagementMetrics | null> {
        const result = await this.transport.fetchData<EngagementMetrics>(
            `${this.basePath()}/engagement`
        );
        if (result.success && result.data) {
            return result.data;
        }
        logger.warn('Failed to fetch visitor engagement:', result.error);
        return null;
    }
}
