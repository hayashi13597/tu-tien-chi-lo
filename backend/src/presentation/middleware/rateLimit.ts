import rateLimit from 'express-rate-limit';

// Brute-force / credential-stuffing guard for the auth surface. Applied only to
// the unauthenticated auth routes (login/register/refresh) where an attacker can
// otherwise try passwords or replay stolen refresh tokens without limit.
//
// The 429 body is shaped like every other error response ({ error: { code,
// message } }) so clients parse rate-limit rejections the same way they parse a
// DomainError — see errorHandler. keyGenerator is left at the default (client
// IP); behind a proxy/load balancer the app must set `trust proxy` for the real
// client IP to be seen (not configured here — single-host dev/deploy).
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // per IP per window across the auth routes
  standardHeaders: true, // expose RateLimit-* headers
  legacyHeaders: false,
  // Disabled under the test runner: the limiter is a process-wide singleton with
  // an in-memory store, so the integration suite's many login/register calls
  // would otherwise trip it and fail unrelated tests. Same NODE_ENV gating the
  // `secure` cookie flag uses (see cookies.ts).
  skip: () => process.env.NODE_ENV === 'test',
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' },
    });
  },
});
