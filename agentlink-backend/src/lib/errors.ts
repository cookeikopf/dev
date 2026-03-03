/**
 * AgentLink MVP - Error Handling
 * Custom error classes and error response utilities
 */

// ============================================
// Custom Error Classes
// ============================================

export class ApiError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public code: string = 'INTERNAL_ERROR',
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export class ValidationError extends ApiError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

export class AuthenticationError extends ApiError {
    constructor(message: string = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends ApiError {
    constructor(message: string = 'Access denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends ApiError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

export class RateLimitError extends ApiError {
    constructor(
        message: string = 'Rate limit exceeded',
        public retryAfter?: number
    ) {
        super(message, 429, 'RATE_LIMIT_ERROR');
        this.name = 'RateLimitError';
    }
}

export class ConflictError extends ApiError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT_ERROR');
        this.name = 'ConflictError';
    }
}

// ============================================
// Error Response Helpers
// ============================================

export interface ErrorResponse {
    error: {
        message: string;
        code: string;
        status: number;
        details?: Record<string, unknown>;
    };
}

export function createErrorResponse(error: ApiError | Error): Response {
    if (error instanceof ApiError) {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (error instanceof RateLimitError && error.retryAfter) {
            headers['Retry-After'] = error.retryAfter.toString();
        }

        const body: ErrorResponse = {
            error: {
                message: error.message,
                code: error.code,
                status: error.statusCode,
                ...(error.details && { details: error.details }),
            },
        };

        return new Response(JSON.stringify(body), {
            status: error.statusCode,
            headers,
        });
    }

    // Generic error
    return new Response(
        JSON.stringify({
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR',
                status: 500,
            },
        }),
        {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

export function createSuccessResponse<T>(
    data: T,
    status: number = 200,
    headers?: Record<string, string>
): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
    });
}

// ============================================
// Error Handler Middleware
// ============================================

export async function handleApiRequest<T>(
    handler: () => Promise<Response>
): Promise<Response> {
    try {
        return await handler();
    } catch (error) {
        console.error('API Error:', error);

        if (error instanceof ApiError) {
            return createErrorResponse(error);
        }

        // Log unexpected errors
        if (error instanceof Error) {
            console.error('Unexpected error:', {
                message: error.message,
                stack: error.stack,
            });
        }

        return createErrorResponse(
            new ApiError('Internal server error', 500, 'INTERNAL_ERROR')
        );
    }
}

// ============================================
// Supabase Error Handler
// ============================================

export function handleSupabaseError(error: any): never {
    console.error('Supabase error:', error);

    // Handle specific Supabase error codes
    if (error.code === 'PGRST116') {
        throw new NotFoundError('Resource');
    }

    if (error.code === '23505') {
        throw new ConflictError('Resource already exists');
    }

    if (error.code === '23503') {
        throw new ValidationError('Referenced resource does not exist');
    }

    if (error.code === '42501') {
        throw new AuthorizationError('Insufficient permissions');
    }

    throw new ApiError(
        error.message || 'Database error',
        500,
        'DATABASE_ERROR',
        { originalError: error }
    );
}

// ============================================
// HTTP Status Code Helpers
// ============================================

export const HttpStatus = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
} as const;
