/**
 * AgentLink MVP - Authentication Configuration
 * Supports both Clerk and NextAuth.js
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

// ============================================
// Authentication Provider Configuration
// ============================================

export type AuthProvider = 'clerk' | 'nextauth' | 'supabase';

const AUTH_PROVIDER = (process.env.AUTH_PROVIDER as AuthProvider) || 'supabase';

// ============================================
// Clerk Authentication (if using Clerk)
// ============================================

interface ClerkUser {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
}

/**
 * Verify Clerk session
 */
export async function verifyClerkSession(request: NextRequest): Promise<ClerkUser | null> {
    try {
        // In production, use @clerk/nextjs
        // const { getAuth } = await import('@clerk/nextjs/server');
        // const auth = getAuth(request);
        // return auth.userId ? { id: auth.userId, email: auth.user?.emailAddresses[0]?.emailAddress } : null;
        
        // For now, return null - implement with actual Clerk SDK
        return null;
    } catch {
        return null;
    }
}

// ============================================
// NextAuth.js Authentication (if using NextAuth)
// ============================================

interface NextAuthSession {
    user?: {
        id: string;
        email?: string;
        name?: string;
    };
}

/**
 * Get NextAuth session
 */
export async function getNextAuthSession(request: NextRequest): Promise<NextAuthSession | null> {
    try {
        // In production, use next-auth
        // const { getServerSession } = await import('next-auth/next');
        // const session = await getServerSession(authOptions);
        // return session;
        
        // For now, return null - implement with actual NextAuth
        return null;
    } catch {
        return null;
    }
}

// ============================================
// Supabase Authentication (default)
// ============================================

interface SupabaseUser {
    id: string;
    email?: string;
    user_metadata?: {
        full_name?: string;
        avatar_url?: string;
    };
}

/**
 * Get Supabase user from session
 */
export async function getSupabaseUser(): Promise<SupabaseUser | null> {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            return null;
        }

        return {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
        };
    } catch {
        return null;
    }
}

// ============================================
// Unified Authentication Interface
// ============================================

export interface AuthenticatedUser {
    id: string;
    email?: string;
    name?: string;
    provider: AuthProvider;
    metadata?: Record<string, unknown>;
}

/**
 * Get authenticated user using configured provider
 */
export async function getAuthenticatedUser(request?: NextRequest): Promise<AuthenticatedUser | null> {
    switch (AUTH_PROVIDER) {
        case 'clerk':
            if (!request) return null;
            const clerkUser = await verifyClerkSession(request);
            if (clerkUser) {
                return {
                    id: clerkUser.id,
                    email: clerkUser.email,
                    name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' '),
                    provider: 'clerk',
                };
            }
            return null;

        case 'nextauth':
            if (!request) return null;
            const nextAuthSession = await getNextAuthSession(request);
            if (nextAuthSession?.user) {
                return {
                    id: nextAuthSession.user.id,
                    email: nextAuthSession.user.email,
                    name: nextAuthSession.user.name,
                    provider: 'nextauth',
                };
            }
            return null;

        case 'supabase':
        default:
            const supabaseUser = await getSupabaseUser();
            if (supabaseUser) {
                return {
                    id: supabaseUser.id,
                    email: supabaseUser.email,
                    name: supabaseUser.user_metadata?.full_name,
                    provider: 'supabase',
                    metadata: supabaseUser.user_metadata,
                };
            }
            return null;
    }
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(request?: NextRequest): Promise<AuthenticatedUser> {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
        throw new Error('Authentication required');
    }
    
    return user;
}

// ============================================
// NextAuth Configuration (if using NextAuth)
// ============================================

export const nextAuthConfig = {
    providers: [
        // Configure your providers here
        // GoogleProvider({
        //     clientId: process.env.GOOGLE_CLIENT_ID!,
        //     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        // }),
        // GitHubProvider({
        //     clientId: process.env.GITHUB_CLIENT_ID!,
        //     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        // }),
    ],
    callbacks: {
        async session({ session, token }: { session: any; token: any }) {
            if (session.user) {
                session.user.id = token.sub;
            }
            return session;
        },
        async jwt({ token, user }: { token: any; user?: any }) {
            if (user) {
                token.sub = user.id;
            }
            return token;
        },
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
    session: {
        strategy: 'jwt' as const,
    },
};

// ============================================
// Clerk Configuration (if using Clerk)
// ============================================

export const clerkConfig = {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    signInUrl: '/auth/signin',
    signUpUrl: '/auth/signup',
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/dashboard',
};

// ============================================
// Supabase Auth Configuration
// ============================================

export const supabaseAuthConfig = {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    additionalRedirectURLs: [
        'http://localhost:3000/auth/callback',
        'https://agentlink.io/auth/callback',
    ],
    // OAuth providers
    providers: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
    },
};
