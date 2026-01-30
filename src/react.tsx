/**
 * Clianta SDK - React Integration
 * 
 * Provides CliantaProvider component for easy React/Next.js integration
 * using the clianta.config.ts pattern.
 */

'use client';

import { useEffect, createContext, useContext, useRef, type ReactNode } from 'react';
import { clianta } from './index';
import type { CliantaConfig, TrackerCore } from './types';

// Context for accessing tracker throughout the app
const CliantaContext = createContext<TrackerCore | null>(null);

export interface CliantaProviderProps {
    /** Configuration object (from clianta.config.ts) */
    config: CliantaConfig;
    /** React children */
    children: ReactNode;
}

/**
 * CliantaProvider - Wrap your app to enable tracking
 * 
 * @example
 * // In clianta.config.ts:
 * import { CliantaConfig } from '@clianta/sdk';
 * 
 * const config: CliantaConfig = {
 *   projectId: 'your-project-id',
 *   apiEndpoint: 'https://api.clianta.online',
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
export function CliantaProvider({ config, children }: CliantaProviderProps) {
    const trackerRef = useRef<TrackerCore | null>(null);

    useEffect(() => {
        // Initialize tracker with config
        const projectId = config.projectId;
        if (!projectId) {
            console.error('[Clianta] Missing projectId in config. Please add projectId to your clianta.config.ts');
            return;
        }

        // Extract projectId (handled separately) and pass rest as options
        const { projectId: _, ...options } = config;
        trackerRef.current = clianta(projectId, options);

        // Cleanup: flush pending events on unmount
        return () => {
            trackerRef.current?.flush();
        };
    }, [config]);

    return (
        <CliantaContext.Provider value={trackerRef.current}>
            {children}
        </CliantaContext.Provider>
    );
}

/**
 * useClianta - Hook to access tracker in any component
 * 
 * @example
 * const tracker = useClianta();
 * tracker?.track('button_click', 'CTA Button');
 */
export function useClianta(): TrackerCore | null {
    return useContext(CliantaContext);
}

/**
 * useClinataTrack - Convenience hook for tracking events
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
