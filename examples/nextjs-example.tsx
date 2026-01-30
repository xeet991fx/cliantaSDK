// app/layout.tsx or app/providers.tsx
'use client';

import { useEffect } from 'react';
import { clianta } from '@clianta/sdk';

export function CliantaProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Initialize Clianta SDK
        const tracker = clianta(process.env.NEXT_PUBLIC_CLIANTA_WORKSPACE_ID!, {
            apiEndpoint: process.env.NEXT_PUBLIC_CLIANTA_API_ENDPOINT || 'https://api.clianta.online',
            debug: process.env.NODE_ENV === 'development',
            autoPageView: true,
        });

        // Cleanup on unmount
        return () => {
            tracker.flush();
        };
    }, []);

    return <>{children}</>;
}

// Usage in app/layout.tsx:
// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en">
//       <body>
//         <CliantaProvider>
//           {children}
//         </CliantaProvider>
//       </body>
//     </html>
//   );
// }

// ============================================
// Example: Track events in a component
// ============================================

'use client';

import { clianta } from '@clianta/sdk';

export function SignupButton() {
    const handleClick = () => {
        const tracker = clianta(process.env.NEXT_PUBLIC_CLIANTA_WORKSPACE_ID!);

        tracker.track('button_click', 'Signup CTA Clicked', {
            location: 'navbar',
            timestamp: new Date().toISOString(),
        });

        // Your signup logic here
    };

    return (
        <button onClick={handleClick}>
            Sign Up
        </button>
    );
}

// ============================================
// Example: Server-side CRM API usage
// ============================================

import { CRMClient } from '@clianta/sdk';

export async function getContacts() {
    const crm = new CRMClient(
        process.env.CLIANTA_API_ENDPOINT || 'https://api.clianta.online',
        process.env.CLIANTA_WORKSPACE_ID!,
        process.env.CLIANTA_AUTH_TOKEN!
    );

    const response = await crm.getContacts({
        page: 1,
        limit: 50,
        status: 'lead',
    });

    if (!response.success) {
        throw new Error(response.error || 'Failed to fetch contacts');
    }

    return response.data;
}

// Usage in a Server Component:
// export default async function ContactsPage() {
//   const contacts = await getContacts();
//
//   return (
//     <div>
//       <h1>Contacts</h1>
//       <ul>
//         {contacts.data.map((contact) => (
//           <li key={contact._id}>
//             {contact.firstName} {contact.lastName}
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }

// ============================================
// Environment Variables (.env.local)
// ============================================

// NEXT_PUBLIC_CLIANTA_WORKSPACE_ID=your-workspace-id
// NEXT_PUBLIC_CLIANTA_API_ENDPOINT=https://api.clianta.online
// CLIANTA_AUTH_TOKEN=your-auth-token (server-side only)
