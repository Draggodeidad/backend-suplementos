import { Router } from 'express';
import { config } from '../config';
import healthRoutes from './healthRoutes';
import authRoutes from './authRoutes';
import adminRoutes from './adminRoutes';
import productRoutes from './productRoutes';
import productAdminRoutes from './productAdminRoutes';

const router = Router();

// Health check route
router.use('/health', healthRoutes);

// Authentication routes
router.use('/', authRoutes);

// Public product routes
router.use('/', productRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Admin product routes
router.use('/admin', productAdminRoutes);

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
      products: '/products',
      categories: '/categories',
      admin: '/admin',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
