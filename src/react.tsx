/**
 * Eutexa SDK - React Integration
 * 
 * TRUE PLUG-AND-PLAY: Just wrap your app with <EutexaProvider projectId="xxx" />
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
import { eutexa } from './index';
import type { EutexaConfig, TrackerCore } from './types';

// ============================================
// CONTEXT
// ============================================

interface EutexaContextValue {
    tracker: TrackerCore | null;
    isReady: boolean;
}

const EutexaContext = createContext<EutexaContextValue>({
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
class EutexaErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[Eutexa] SDK error caught by ErrorBoundary:', error);
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

export interface EutexaProviderProps {
    /** Project/workspace ID — required */
    projectId: string;
    /** API endpoint URL (e.g. https://api.eutexa.com) */
    apiEndpoint?: string;
    /** Enable debug logging (default: false) */
    debug?: boolean;
    /** Full config for advanced usage (optional — most users don't need this) */
    config?: Omit<EutexaConfig, 'projectId'>;
    /** React children */
    children: ReactNode;
    /** Error handler (optional) */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * EutexaProvider — Plug-and-play tracking for React/Next.js
 * 
 * Just wrap your app. Everything auto-tracks. Done.
 * 
 * @example
 * <EutexaProvider
 *   projectId={process.env.NEXT_PUBLIC_EUTEXA_PROJECT_ID!}
 *   apiEndpoint={process.env.NEXT_PUBLIC_EUTEXA_API_ENDPOINT!}
 * >
 *   {children}
 * </EutexaProvider>
 */
export function EutexaProvider({ projectId, apiEndpoint, debug, config, children, onError }: EutexaProviderProps) {
    const [tracker, setTracker] = useState<TrackerCore | null>(null);
    const [isReady, setIsReady] = useState(false);
    const trackerRef = useRef<TrackerCore | null>(null);

    useEffect(() => {
        if (!projectId) {
            console.error('[Eutexa] Missing projectId prop on EutexaProvider');
            return;
        }

        try {
            const options: EutexaConfig = {
                debug: debug ?? false,
                ...config, // advanced config overrides
                ...(apiEndpoint ? { apiEndpoint } : {}),
            };
            const instance = eutexa(projectId, options);
            trackerRef.current = instance;
            setTracker(instance);
            setIsReady(true);
        } catch (error) {
            console.error('[Eutexa] Failed to initialize SDK:', error);
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
        <EutexaErrorBoundary onError={onError}>
            <EutexaContext.Provider value={{ tracker, isReady }}>
                {children}
            </EutexaContext.Provider>
        </EutexaErrorBoundary>
    );
}

// ============================================
// HOOKS
// ============================================

/**
 * useEutexa — Access the tracker instance
 */
export function useEutexa(): TrackerCore | null {
    const { tracker } = useContext(EutexaContext);
    return tracker;
}

/**
 * useEutexaReady — Check if SDK is initialized
 */
export function useEutexaReady(): { isReady: boolean; tracker: TrackerCore | null } {
    const { tracker, isReady } = useContext(EutexaContext);
    return { isReady, tracker };
}

/**
 * useEutexaTrack — Quick tracking hook
 * Stable function reference (useCallback) — safe to use as a dependency or pass as a prop.
 */
export function useEutexaTrack() {
    const tracker = useEutexa();
    return useCallback(
        (eventType: string, eventName: string, properties?: Record<string, unknown>) => {
            tracker?.track(eventType, eventName, properties);
        },
        [tracker]
    );
}

// Re-export types for convenience
export type { EutexaConfig, TrackerCore };
