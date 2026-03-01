/**
 * Clianta SDK - React Integration
 * 
 * Provides CliantaProvider component (with ErrorBoundary) for easy
 * React/Next.js integration using the clianta.config.ts pattern.
 */

'use client';

import {
    useEffect,
    useState,
    createContext,
    useContext,
    useRef,
    Component,
    type ReactNode,
    type ErrorInfo,
} from 'react';
import { clianta } from './index';
import type { CliantaConfig, TrackerCore } from './types';

// ============================================
// CONTEXT
// ============================================

interface CliantaContextValue {
    tracker: TrackerCore | null;
    isReady: boolean;
}

const CliantaContext = createContext<CliantaContextValue>({
    tracker: null,
    isReady: false,
});

// ============================================
// ERROR BOUNDARY
// ============================================

interface ErrorBoundaryProps {
    children: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

/**
 * Internal ErrorBoundary to prevent SDK errors from crashing the host app.
 * Catches render-time errors in the provider tree.
 */
class CliantaErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[Clianta] SDK error caught by ErrorBoundary:', error);
        this.props.onError?.(error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            // Render children anyway — SDK failure shouldn't break the host UI
            return this.props.fallback ?? this.props.children;
        }
        return this.props.children;
    }
}

// ============================================
// PROVIDER
// ============================================

export interface CliantaProviderProps {
    /** Configuration object (from clianta.config.ts) */
    config: CliantaConfig;
    /** React children */
    children: ReactNode;
    /** Optional error handler when the SDK encounters errors */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * CliantaProvider - Wrap your app to enable tracking
 * 
 * Includes an ErrorBoundary so SDK failures never crash the host app.
 * 
 * @example
 * // In clianta.config.ts:
 * import { CliantaConfig } from '@clianta/sdk';
 * 
 * const config: CliantaConfig = {
 *   projectId: 'your-project-id',
 *   apiEndpoint: process.env.NEXT_PUBLIC_CLIANTA_API_ENDPOINT || 'http://localhost:5000',
 *   debug: process.env.NODE_ENV === 'development',
 * };
 * 
 * export default config;
 * 
 * // In app/layout.tsx or main.tsx:
 * import { CliantaProvider } from '@clianta/sdk/react';
 * import cliantaConfig from '../clianta.config';
 * 
 * <CliantaProvider config={cliantaConfig}>
 *   {children}
 * </CliantaProvider>
 */
export function CliantaProvider({ config, children, onError }: CliantaProviderProps) {
    const [tracker, setTracker] = useState<TrackerCore | null>(null);
    const [isReady, setIsReady] = useState(false);
    // Stable ref to projectId — the only value that truly identifies the tracker
    const projectIdRef = useRef(config.projectId);

    useEffect(() => {
        // Initialize tracker with config
        const projectId = config.projectId;
        if (!projectId) {
            console.error('[Clianta] Missing projectId in config. Please add projectId to your clianta.config.ts');
            return;
        }

        // Only re-initialize if projectId actually changed
        if (projectIdRef.current !== projectId) {
            projectIdRef.current = projectId;
        }

        try {
            // Extract projectId (handled separately) and pass rest as options
            const { projectId: _, ...options } = config;
            const instance = clianta(projectId, options);
            setTracker(instance);
            setIsReady(true);
        } catch (error) {
            console.error('[Clianta] Failed to initialize SDK:', error);
            onError?.(error as Error, { componentStack: '' } as ErrorInfo);
        }

        // Cleanup: flush pending events on unmount
        return () => {
            tracker?.flush();
            setIsReady(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.projectId]);

    return (
        <CliantaErrorBoundary onError={onError}>
            <CliantaContext.Provider value={{ tracker, isReady }}>
                {children}
            </CliantaContext.Provider>
        </CliantaErrorBoundary>
    );
}

// ============================================
// HOOKS
// ============================================

/**
 * useClianta - Hook to access tracker in any component
 * 
 * @example
 * const tracker = useClianta();
 * tracker?.track('button_click', 'CTA Button');
 */
export function useClianta(): TrackerCore | null {
    const { tracker } = useContext(CliantaContext);
    return tracker;
}

/**
 * useCliantaReady - Hook to check if SDK is initialized
 * 
 * @example
 * const { isReady, tracker } = useCliantaReady();
 * if (isReady) {
 *   tracker.track('purchase', 'Order', { value: 99 });
 * }
 */
export function useCliantaReady(): { isReady: boolean; tracker: TrackerCore | null } {
    const { tracker, isReady } = useContext(CliantaContext);
    return { isReady, tracker };
}

/**
 * useCliantaTrack - Convenience hook for tracking events
 * 
 * @example
 * const track = useCliantaTrack();
 * track('purchase', 'Order Completed', { orderId: '123' });
 */
export function useCliantaTrack() {
    const tracker = useClianta();
    return (
        eventType: string,
        eventName: string,
        properties?: Record<string, unknown>
    ) => {
        tracker?.track(eventType, eventName, properties);
    };
}

// Re-export types for convenience
export type { CliantaConfig, TrackerCore };
