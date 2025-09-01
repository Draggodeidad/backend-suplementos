import { Router } from 'express';
import { config } from '../config';
import healthRoutes from './healthRoutes';

const router = Router();

// Health check route
router.use('/health', healthRoutes);

// API info route
router.get('/', (req, res) => {
  res.json({
    name: 'Back Suplementos API',
    version: config.apiVersion,
    description:
      'API REST para catálogo de suplementos, carrito, checkout, pagos, órdenes y notificaciones',
    endpoints: {
      health: '/health',
      docs: '/docs',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
