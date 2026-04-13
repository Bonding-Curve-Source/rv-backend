import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

export function resolveCorsOptions(): CorsOptions | false {
  if (process.env.CORS_ENABLED === 'false') {
    return false;
  }

  const raw = process.env.CORS_ORIGINS;
  const fromEnv = raw
    ? raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  const origin = fromEnv.length > 0 ? fromEnv : DEFAULT_ORIGINS;

  return {
    origin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-KEY',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: ['Content-Disposition'],
  };
}
