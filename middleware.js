// Vercel Edge Middleware — rate limiting for expensive API endpoints
// Requires @upstash/ratelimit and @vercel/kv (Upstash Redis)
// Falls through gracefully if not provisioned

export const config = {
  matcher: ['/api/llm/chat', '/api/agents'],
};

export default async function middleware(request) {
  // Only rate-limit in production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { kv } = await import('@vercel/kv');

    const ratelimit = new Ratelimit({
      redis: kv,
      // 20 requests per 60 seconds per IP
      limiter: Ratelimit.slidingWindow(20, '60 s'),
      analytics: true,
      prefix: 'ratelimit:api',
    });

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';

    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      });
    }

    // Attach rate limit headers to the response
    const response = new Response(null, {
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
      },
    });

    // Pass through — return undefined to let the request continue
    return;
  } catch {
    // If rate limiting deps are not available, pass through silently
    return;
  }
}
