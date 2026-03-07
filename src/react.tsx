/**
 * Clianta SDK - React Integration
 * 
 * TRUE PLUG-AND-PLAY: Just wrap your app with <CliantaProvider projectId="xxx" />
 * and everything auto-tracks — page views, forms, clicks, scroll, engagement,
 * downloads, exit intent, errors, performance. Zero manual code needed.
 */

'use client';

import {
    useEffect,
    useState,
    createContext,
    useContext,
    useRef,
    useCallback,
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
 * Internal ErrorBoundary — SDK crashes never break the host app.
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
            return this.props.fallback ?? this.props.children;
        }
        return this.props.children;
    }
}

// ============================================
// PROVIDER
// ============================================

export interface CliantaProviderProps {
    /** Project/workspace ID — required */
    projectId: string;
    /** API endpoint URL (e.g. https://api.clianta.online) */
    apiEndpoint?: string;
    /** Enable debug logging (default: false) */
    debug?: boolean;
    /** Full config for advanced usage (optional — most users don't need this) */
    config?: Omit<CliantaConfig, 'projectId'>;
    /** React children */
    children: ReactNode;
    /** Error handler (optional) */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * CliantaProvider — Plug-and-play tracking for React/Next.js
 * 
 * Just wrap your app. Everything auto-tracks. Done.
 * 
 * @example
 * <CliantaProvider
 *   projectId={process.env.NEXT_PUBLIC_CLIANTA_PROJECT_ID!}
 *   apiEndpoint={process.env.NEXT_PUBLIC_CLIANTA_API_ENDPOINT!}
 * >
 *   {children}
 * </CliantaProvider>
 */
export function CliantaProvider({ projectId, apiEndpoint, debug, config, children, onError }: CliantaProviderProps) {
    const [tracker, setTracker] = useState<TrackerCore | null>(null);
    const [isReady, setIsReady] = useState(false);
    const trackerRef = useRef<TrackerCore | null>(null);

    useEffect(() => {
        if (!projectId) {
            console.error('[Clianta] Missing projectId prop on CliantaProvider');
            return;
        }

        try {
            const options: CliantaConfig = {
                debug: debug ?? false,
                ...config, // advanced config overrides
                ...(apiEndpoint ? { apiEndpoint } : {}),
            };
            const instance = clianta(projectId, options);
            trackerRef.current = instance;
            setTracker(instance);
            setIsReady(true);
        } catch (error) {
            console.error('[Clianta] Failed to initialize SDK:', error);
            onError?.(error as Error, { componentStack: '' } as ErrorInfo);
        }

        return () => {
            // Use ref so cleanup always flushes the live instance, not the stale closure value
            trackerRef.current?.flush();
            setIsReady(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

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
 * useClianta — Access the tracker instance
 */
export function useClianta(): TrackerCore | null {
    const { tracker } = useContext(CliantaContext);
    return tracker;
}

/**
 * useCliantaReady — Check if SDK is initialized
 */
export function useCliantaReady(): { isReady: boolean; tracker: TrackerCore | null } {
    const { tracker, isReady } = useContext(CliantaContext);
    return { isReady, tracker };
}

/**
 * useCliantaTrack — Quick tracking hook
 * Stable function reference (useCallback) — safe to use as a dependency or pass as a prop.
 */
export function useCliantaTrack() {
    const tracker = useClianta();
    return useCallback(
        (eventType: string, eventName: string, properties?: Record<string, unknown>) => {
            tracker?.track(eventType, eventName, properties);
        },
        [tracker]
    );
}

// Re-export types for convenience
export type { CliantaConfig, TrackerCore };
