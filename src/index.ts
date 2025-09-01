import express, { Application, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { logger } from './utils/logger';
import { httpLogger } from './middleware/logger';
import {
  corsOptions,
  helmetOptions,
  rateLimitOptions,
} from './middleware/security';
import { swaggerUiHandler } from './middleware/swagger';
import apiRoutes from './routes';

const app: Application = express();

// Security middleware
app.use(helmetOptions);
app.use(corsOptions);
app.use(rateLimitOptions);

// Logging middleware
app.use(httpLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUiHandler);

// API Routes
app.use(config.apiPrefix, apiRoutes);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Back Suplementos API',
    version: config.apiVersion,
    documentation: '/api/docs',
    health: `${config.apiPrefix}/health`,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  logger.error(err, 'Unhandled error');
  res.status(500).json({
    error: 'Internal Server Error',
    message:
      config.nodeEnv === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      environment: config.nodeEnv,
      apiVersion: config.apiVersion,
      docs: `http://localhost:${config.port}/api/docs`,
      health: `http://localhost:${config.port}${config.apiPrefix}/health`,
    },
    '🚀 Server started successfully'
  );
});

export default app;
