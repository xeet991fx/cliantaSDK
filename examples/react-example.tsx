import { useEffect, useState } from 'react';
import { clianta, CRMClient, type TrackerCore, type Contact } from '@clianta/sdk';

/**
 * React Hook for Clianta Tracker
 */
export function useClianta(workspaceId: string, config?: any): TrackerCore | null {
    const [tracker, setTracker] = useState<TrackerCore | null>(null);

    useEffect(() => {
        const instance = clianta(workspaceId, {
            debug: process.env.NODE_ENV === 'development',
            ...config,
        });

        setTracker(instance);

        // Cleanup on unmount
        return () => {
            instance.flush();
        };
    }, [workspaceId]);

    return tracker;
}

/**
 * Example React Component using Clianta SDK
 */
export default function App() {
    const tracker = useClianta('your-workspace-id');
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);

    // Track custom event
    const handleButtonClick = () => {
        tracker?.track('button_click', 'CTA Clicked', {
            buttonId: 'signup-cta',
            location: 'hero-section',
        });
    };

    // Identify user
    const handleIdentify = () => {
        tracker?.identify('user@example.com', {
            firstName: 'John',
            lastName: 'Doe',
            company: 'Acme Inc',
        });
    };

    // Fetch contacts using CRM API
    const fetchContacts = async () => {
        setLoading(true);
        try {
            const crm = new CRMClient(
                'https://api.clianta.online',
                'your-workspace-id',
                'your-auth-token' // Get from your auth system
            );

            const response = await crm.getContacts({ page: 1, limit: 10 });

            if (response.success && response.data) {
                setContacts(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app">
            <h1>Clianta SDK - React Example</h1>

            <section>
                <h2>Tracking</h2>
                <button onClick={handleButtonClick}>
                    Track Button Click
                </button>
                <button onClick={handleIdentify}>
                    Identify User
                </button>
            </section>

            <section>
                <h2>CRM API</h2>
                <button onClick={fetchContacts} disabled={loading}>
                    {loading ? 'Loading...' : 'Fetch Contacts'}
                </button>

                {contacts.length > 0 && (
                    <ul>
                        {contacts.map((contact) => (
                            <li key={contact._id}>
                                {contact.firstName} {contact.lastName} - {contact.email}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
