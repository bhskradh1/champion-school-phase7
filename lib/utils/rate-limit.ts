/**
 * Rate Limiting Utility for API Protection
 * Implements sliding window rate limiting
 */

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  message: string;       // Error message when limit exceeded
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 60,        // 60 requests per minute
  message: 'Too many requests, please try again later'
};

// In-memory store for development (use Redis in production)
const requestStore = new Map<string, { count: number; resetAt: Date }>();

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {}
): RateLimitResult {
  const finalConfig = { ...defaultConfig, ...config };
  const now = new Date();
  
  const stored = requestStore.get(identifier);
  
  if (!stored || now >= stored.resetAt) {
    // New window
    const resetAt = new Date(now.getTime() + finalConfig.windowMs);
    requestStore.set(identifier, { count: 1, resetAt });
    
    return {
      success: true,
      remaining: finalConfig.maxRequests - 1,
      resetAt
    };
  }
  
  // Existing window
  if (stored.count >= finalConfig.maxRequests) {
    // Limit exceeded
    return {
      success: false,
      remaining: 0,
      resetAt: stored.resetAt,
      retryAfter: Math.ceil((stored.resetAt.getTime() - now.getTime()) / 1000)
    };
  }
  
  // Increment count
  stored.count += 1;
  requestStore.set(identifier, stored);
  
  return {
    success: true,
    remaining: finalConfig.maxRequests - stored.count,
    resetAt: stored.resetAt
  };
}

/**
 * Clean up expired entries from the store
 * Call this periodically (e.g., every 5 minutes)
 */
export function cleanupRateLimitStore(): void {
  const now = new Date();
  for (const [key, value] of requestStore.entries()) {
    if (now >= value.resetAt) {
      requestStore.delete(key);
    }
  }
}

// Start cleanup interval
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

/**
 * Get current rate limit status for an identifier
 */
export function getRateLimitStatus(
  identifier: string,
  config: Partial<RateLimitConfig> = {}
): RateLimitResult {
  const finalConfig = { ...defaultConfig, ...config };
  const now = new Date();
  const stored = requestStore.get(identifier);
  
  if (!stored || now >= stored.resetAt) {
    return {
      success: true,
      remaining: finalConfig.maxRequests,
      resetAt: new Date(now.getTime() + finalConfig.windowMs)
    };
  }
  
  return {
    success: stored.count < finalConfig.maxRequests,
    remaining: Math.max(0, finalConfig.maxRequests - stored.count),
    resetAt: stored.resetAt,
    retryAfter: stored.count >= finalConfig.maxRequests 
      ? Math.ceil((stored.resetAt.getTime() - now.getTime()) / 1000)
      : undefined
  };
}

/**
 * Reset rate limit for an identifier
 */
export function resetRateLimit(identifier: string): void {
  requestStore.delete(identifier);
}

/**
 * Rate limit middleware factory for Next.js API routes
 */
export function createRateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  
  return async function rateLimitMiddleware(request: Request): Promise<RateLimitResult> {
    // Extract identifier (IP address or user ID)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const result = checkRateLimit(`ip:${ip}`, finalConfig);
    
    return result;
  };
}

/**
 * Role-based rate limits
 */
export const roleBasedLimits = {
  student: {
    api: { windowMs: 60 * 1000, maxRequests: 30 },      // 30 req/min
    discussion: { windowMs: 60 * 1000, maxRequests: 20 }, // 20 messages/min
    threads: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 1 } // 1 thread/day
  },
  teacher: {
    api: { windowMs: 60 * 1000, maxRequests: 100 },     // 100 req/min
    discussion: { windowMs: 60 * 1000, maxRequests: 50 }  // 50 messages/min
  },
  admin: {
    api: { windowMs: 60 * 1000, maxRequests: 200 },     // 200 req/min
    discussion: { windowMs: 60 * 1000, maxRequests: 100 } // 100 messages/min
  }
};

/**
 * Get rate limit config based on user role
 */
export function getRateLimitForRole(role: string, endpoint: string): RateLimitConfig {
  const roleLimits = roleBasedLimits[role as keyof typeof roleBasedLimits] || roleBasedLimits.student;
  
  if (endpoint.includes('discussion')) {
    return {
      ...roleLimits.discussion,
      message: `Too many ${endpoint.includes('thread') ? 'threads' : 'messages'}. Please slow down.`
    };
  }
  
  return {
    ...roleLimits.api,
    message: 'Too many requests. Please try again later.'
  };
}

/**
 * Track daily thread creation for students
 */
const dailyThreadTracker = new Map<string, { count: number; resetAt: Date }>();

export function checkDailyThreadLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  
  const stored = dailyThreadTracker.get(userId);
  
  if (!stored || now >= stored.resetAt) {
    dailyThreadTracker.set(userId, { count: 1, resetAt: tomorrow });
    return { allowed: true, remaining: 0 };
  }
  
  if (stored.count >= 1) {
    return { allowed: false, remaining: 0 };
  }
  
  stored.count += 1;
  dailyThreadTracker.set(userId, stored);
  return { allowed: true, remaining: 0 };
}

export function resetDailyThreadTracker(): void {
  const now = new Date();
  for (const [key, value] of dailyThreadTracker.entries()) {
    if (now >= value.resetAt) {
      dailyThreadTracker.delete(key);
    }
  }
}

// Reset daily trackers at midnight
const msUntilMidnight = () => {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return tomorrow.getTime() - now.getTime();
};

setTimeout(function resetAtMidnight() {
  resetDailyThreadTracker();
  setTimeout(resetAtMidnight, msUntilMidnight());
}, msUntilMidnight());
