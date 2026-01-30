/**
 * Clianta SDK - Next.js Integration Guide
 * Complete examples for App Router and Pages Router
 */

// ============================================
// OPTION 1: App Router Provider (Recommended)
// ============================================

// components/CliantaProvider.tsx
'use client';

import { useEffect, createContext, useContext, useState } from 'react';
import { clianta, type TrackerCore, type ConsentState } from '@clianta/sdk';

interface CliantaContextType {
    tracker: TrackerCore | null;
    consent: (state: ConsentState) => void;
    deleteData: () => void;
}

const CliantaContext = createContext<CliantaContextType>({
    tracker: null,
    consent: () => { },
    deleteData: () => { },
});

export function useClianta() {
    return useContext(CliantaContext);
}

interface CliantaProviderProps {
    children: React.ReactNode;
    workspaceId: string;
    apiEndpoint?: string;
    waitForConsent?: boolean;
    anonymousMode?: boolean;
    cookielessMode?: boolean;
}

export function CliantaProvider({
    children,
    workspaceId,
    apiEndpoint = 'https://api.clianta.online',
    waitForConsent = false,
    anonymousMode = false,
    cookielessMode = false,
}: CliantaProviderProps) {
    const [tracker, setTracker] = useState<TrackerCore | null>(null);

    useEffect(() => {
        const instance = clianta(workspaceId, {
            apiEndpoint,
            debug: process.env.NODE_ENV === 'development',
            autoPageView: true,
            consent: {
                waitForConsent,
                anonymousMode,
            },
            cookielessMode,
        });

        setTracker(instance);

        return () => {
            instance.flush();
        };
    }, [workspaceId, apiEndpoint, waitForConsent, anonymousMode, cookielessMode]);

    const consent = (state: ConsentState) => {
        tracker?.consent(state);
    };

    const deleteData = () => {
        tracker?.deleteData();
    };

    return (
        <CliantaContext.Provider value={{ tracker, consent, deleteData }}>
            {children}
        </CliantaContext.Provider>
    );
}

// ============================================
// USAGE: app/layout.tsx
// ============================================

/*
import { CliantaProvider } from '@/components/CliantaProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <CliantaProvider 
                    workspaceId={process.env.NEXT_PUBLIC_WORKSPACE_ID!}
                    apiEndpoint={process.env.NEXT_PUBLIC_API_ENDPOINT}
                    waitForConsent={true}  // GDPR: buffer until consent
                    anonymousMode={true}   // GDPR: anonymous until consent
                >
                    {children}
                </CliantaProvider>
            </body>
        </html>
    );
}
*/

// ============================================
// EXAMPLE: Cookie Consent Banner
// ============================================

'use client';

import { useState, useEffect } from 'react';
// import { useClianta } from '@/components/CliantaProvider';

export function CookieConsentBanner() {
    const { consent, deleteData } = useClianta();
    const [showBanner, setShowBanner] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        // Check if consent was already given
        const hasConsent = localStorage.getItem('cookie_consent');
        if (!hasConsent) {
            setShowBanner(true);
        }
    }, []);

    const acceptAll = () => {
        consent({
            analytics: true,
            marketing: true,
            personalization: true,
        });
        localStorage.setItem('cookie_consent', 'all');
        setShowBanner(false);
    };

    const acceptEssential = () => {
        consent({
            analytics: false,
            marketing: false,
            personalization: false,
        });
        localStorage.setItem('cookie_consent', 'essential');
        setShowBanner(false);
    };

    const handleDeleteData = () => {
        deleteData();
        localStorage.removeItem('cookie_consent');
        alert('Your data has been deleted.');
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-50">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <p className="text-sm text-gray-600">
                    We use cookies to improve your experience.
                    <button
                        onClick={() => setShowSettings(true)}
                        className="underline ml-1"
                    >
                        Manage preferences
                    </button>
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={acceptEssential}
                        className="px-4 py-2 border rounded"
                    >
                        Essential Only
                    </button>
                    <button
                        onClick={acceptAll}
                        className="px-4 py-2 bg-blue-600 text-white rounded"
                    >
                        Accept All
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================
// EXAMPLE: Track Events in Components
// ============================================

'use client';

// import { useClianta } from '@/components/CliantaProvider';

export function SignupButton() {
    const { tracker } = useClianta();

    const handleClick = () => {
        tracker?.track('button_click', 'Signup CTA', {
            location: 'navbar',
            variant: 'primary',
        });

        // Your signup logic
    };

    return (
        <button
            onClick={handleClick}
            className="bg-blue-600 text-white px-4 py-2 rounded"
        >
            Sign Up
        </button>
    );
}

// ============================================
// EXAMPLE: Identify on Login
// ============================================

'use client';

// import { useClianta } from '@/components/CliantaProvider';

export function LoginForm() {
    const { tracker } = useClianta();

    const handleLogin = async (email: string, password: string) => {
        // Your login logic...
        const user = await authenticateUser(email, password);

        // Identify the user in Clianta
        tracker?.identify(email, {
            firstName: user.firstName,
            lastName: user.lastName,
            company: user.company,
        });
    };

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const email = (form.email as HTMLInputElement).value;
            const password = (form.password as HTMLInputElement).value;
            handleLogin(email, password);
        }}>
            <input type="email" name="email" placeholder="Email" />
            <input type="password" name="password" placeholder="Password" />
            <button type="submit">Login</button>
        </form>
    );
}

// Placeholder for auth function
async function authenticateUser(email: string, password: string) {
    return { firstName: 'John', lastName: 'Doe', company: 'Acme' };
}

// ============================================
// OPTION 2: Pages Router (_app.tsx)
// ============================================

/*
// pages/_app.tsx
import { useEffect } from 'react';
import { clianta } from '@clianta/sdk';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
    useEffect(() => {
        const tracker = clianta(process.env.NEXT_PUBLIC_WORKSPACE_ID!, {
            apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT,
            consent: {
                waitForConsent: true,
                anonymousMode: true,
            },
        });

        return () => { tracker.flush(); };
    }, []);

    return <Component {...pageProps} />;
}
*/

// ============================================
// ENVIRONMENT VARIABLES (.env.local)
// ============================================

/*
NEXT_PUBLIC_WORKSPACE_ID=your-workspace-id
NEXT_PUBLIC_API_ENDPOINT=https://api.clianta.online
*/
