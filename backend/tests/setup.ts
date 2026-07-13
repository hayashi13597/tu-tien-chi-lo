import 'dotenv/config';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
