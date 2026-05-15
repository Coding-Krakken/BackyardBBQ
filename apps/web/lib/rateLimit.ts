/**
 * Simple in-memory rate limiter for API routes
 * For production, use Redis-based solution like @upstash/ratelimit
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  /**
   * Maximum number of requests allowed within the window
   * @default 60
   */
  maxRequests?: number;
  
  /**
   * Time window in milliseconds
   * @default 60000 (1 minute)
   */
  windowMs?: number;
  
  /**
   * Unique identifier for this rate limit (usually IP or user ID)
   */
  identifier: string;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check if request should be rate limited
 * 
 * @example
 * const rateLimitResult = checkRateLimit({
 *   identifier: req.headers.get('x-forwarded-for') || 'anonymous',
 *   maxRequests: 10,
 *   windowMs: 60000
 * });
 * 
 * if (!rateLimitResult.success) {
 *   return NextResponse.json(
 *     { error: 'Too many requests' },
 *     { 
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Limit': rateLimitResult.limit.toString(),
 *         'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
 *         'X-RateLimit-Reset': rateLimitResult.reset.toString()
 *       }
 *     }
 *   );
 * }
 */
export function checkRateLimit({
  identifier,
  maxRequests = 60,
  windowMs = 60000
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  
  let entry = rateLimitStore.get(key);
  
  // Initialize or reset if window has passed
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + windowMs
    };
    rateLimitStore.set(key, entry);
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: entry.resetTime
    };
  }
  
  // Increment counter
  entry.count++;
  
  if (entry.count > maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: entry.resetTime
    };
  }
  
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    reset: entry.resetTime
  };
}

/**
 * Get client identifier from Next.js request
 * Tries x-forwarded-for header first, falls back to x-real-ip
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list, get the first IP
    const firstIp = forwarded.split(',')[0];
    return firstIp ? firstIp.trim() : 'anonymous';
  }
  
  return realIp || 'anonymous';
}
