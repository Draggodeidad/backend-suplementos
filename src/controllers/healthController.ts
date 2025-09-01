import { Request, Response } from 'express';
import { config } from '../config';

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: "ok"
 *               timestamp: "2024-01-01T00:00:00.000Z"
 *               uptime: 123.456
 *               environment: "development"
 *               version: "v1"
 *               service: "back-suplementos"
 */
export const getHealth = (req: Request, res: Response) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: config.apiVersion,
    service: 'back-suplementos',
  };

  res.status(200).json(healthCheck);
};
