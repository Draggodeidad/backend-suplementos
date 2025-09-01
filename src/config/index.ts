import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // API
  apiVersion: process.env.API_VERSION || 'v1',
  apiPrefix: `/api/${process.env.API_VERSION || 'v1'}`,

  // Security
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to 100 requests per windowMs

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Database (para futuras fases)
  dbUrl: process.env.DATABASE_URL || '',

  // JWT (para futuras fases)
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
} as const;

export default config;
