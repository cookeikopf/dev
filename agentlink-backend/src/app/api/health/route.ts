/**
 * AgentLink MVP - Health Check Endpoint
 * GET /api/health - Check system health
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    services: {
        database: {
            status: 'healthy' | 'unhealthy';
            latency: number;
            error?: string;
        };
        api: {
            status: 'healthy';
            uptime: number;
        };
    };
    environment: {
        node_env: string;
        auth_provider: string;
    };
}

// Start time for uptime calculation
const startTime = Date.now();

// Get version from package.json or environment
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
const AUTH_PROVIDER = process.env.AUTH_PROVIDER || 'supabase';

export async function GET() {
    const timestamp = new Date().toISOString();
    
    // Check database health
    const dbStart = Date.now();
    let dbStatus: HealthStatus['services']['database'];
    
    try {
        const { error } = await supabaseAdmin
            .from('agents')
            .select('count', { count: 'exact', head: true });
        
        const dbLatency = Date.now() - dbStart;
        
        if (error) {
            dbStatus = {
                status: 'unhealthy',
                latency: dbLatency,
                error: error.message,
            };
        } else {
            dbStatus = {
                status: 'healthy',
                latency: dbLatency,
            };
        }
    } catch (error) {
        dbStatus = {
            status: 'unhealthy',
            latency: Date.now() - dbStart,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }

    // Determine overall status
    const overallStatus: HealthStatus['status'] = 
        dbStatus.status === 'healthy' ? 'healthy' : 'degraded';

    const health: HealthStatus = {
        status: overallStatus,
        timestamp,
        version: VERSION,
        services: {
            database: dbStatus,
            api: {
                status: 'healthy',
                uptime: Math.floor((Date.now() - startTime) / 1000),
            },
        },
        environment: {
            node_env: process.env.NODE_ENV || 'development',
            auth_provider: AUTH_PROVIDER,
        },
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    return NextResponse.json(health, { 
        status: statusCode,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    });
}
