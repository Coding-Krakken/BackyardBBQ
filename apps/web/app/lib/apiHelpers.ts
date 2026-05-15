import { NextRequest, NextResponse } from "next/server";
import { ERROR_MESSAGES, RATE_LIMIT_CONSTANTS } from "./constants";

/**
 * Standardized API error response structure
 */
export interface ApiError {
  error: string;
  message?: string;
  code?: string;
  details?: unknown;
}

/**
 * Standard error responses with consistent format
 */
export class ApiErrorResponse {
  static unauthorized(message = ERROR_MESSAGES.UNAUTHORIZED): NextResponse<ApiError> {
    return NextResponse.json(
      { error: "Unauthorized", message },
      { status: 401 }
    );
  }

  static forbidden(message = ERROR_MESSAGES.FORBIDDEN): NextResponse<ApiError> {
    return NextResponse.json(
      { error: "Forbidden", message },
      { status: 403 }
    );
  }

  static notFound(message = ERROR_MESSAGES.NOT_FOUND): NextResponse<ApiError> {
    return NextResponse.json(
      { error: "Not Found", message },
      { status: 404 }
    );
  }

  static badRequest(message: string, details?: unknown): NextResponse<ApiError> {
    return NextResponse.json(
      { error: "Bad Request", message, details },
      { status: 400 }
    );
  }

  static validationError(message = ERROR_MESSAGES.VALIDATION_ERROR, details?: unknown): NextResponse<ApiError> {
    return NextResponse.json(
      { error: "Validation Error", message, details },
      { status: 422 }
    );
  }

  static rateLimitExceeded(message = ERROR_MESSAGES.RATE_LIMIT_EXCEEDED): NextResponse<ApiError> {
    return NextResponse.json(
      { error: "Rate Limit Exceeded", message },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  static serverError(message = ERROR_MESSAGES.SERVER_ERROR, error?: unknown): NextResponse<ApiError> {
    // Log the actual error for debugging
    console.error("Server error:", error);
    
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * Error handler wrapper for API routes
 * Provides consistent error handling and logging
 */
export function withErrorHandler<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse<T | ApiError>> => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Log error with request context
      console.error("API Error:", {
        url: request.url,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Return standardized error response
      return ApiErrorResponse.serverError(
        ERROR_MESSAGES.SERVER_ERROR,
        error
      ) as NextResponse<ApiError>;
    }
  };
}

/**
 * Simple in-memory rate limiter
 * For production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Clean up expired records
  if (record && record.resetAt < now) {
    rateLimitStore.delete(identifier);
  }

  const current = rateLimitStore.get(identifier);

  if (!current) {
    // First request in window
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (current.count >= limit) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  // Increment count
  current.count++;
  rateLimitStore.set(identifier, current);
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt };
}

/**
 * Rate limit middleware for API routes
 */
export function withRateLimit(
  limit: number,
  windowMs: number,
  getIdentifier?: (request: NextRequest) => string
) {
  return function <T = any>(
    handler: (request: NextRequest, context?: any) => Promise<NextResponse<T>>
  ) {
    return async (request: NextRequest, context?: any): Promise<NextResponse<T | ApiError>> => {
      // Get identifier (IP address or custom)
      const identifier = getIdentifier
        ? getIdentifier(request)
        : request.ip || request.headers.get("x-forwarded-for") || "unknown";

      const rateLimit = checkRateLimit(identifier, limit, windowMs);

      if (!rateLimit.allowed) {
        return ApiErrorResponse.rateLimitExceeded() as NextResponse<ApiError>;
      }

      // Add rate limit headers
      const response = await handler(request, context);
      response.headers.set("X-RateLimit-Limit", limit.toString());
      response.headers.set("X-RateLimit-Remaining", rateLimit.remaining.toString());
      response.headers.set("X-RateLimit-Reset", new Date(rateLimit.resetAt).toISOString());

      return response;
    };
  };
}

/**
 * Validation helper
 */
export function validateRequired<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[]
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter((field) => !data[field]);
  return {
    valid: missing.length === 0,
    missing: missing.map(String),
  };
}
