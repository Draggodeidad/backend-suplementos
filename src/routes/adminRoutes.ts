import { Router } from 'express';
import { authGuard } from '../middleware/auth';
import { adminGuard } from '../middleware/adminGuard';
import {
  getAllUsers,
  updateUserRole,
  getStats,
} from '../controllers/adminController';

const router = Router();

// Todas las rutas de admin requieren autenticación Y permisos de admin
router.use(authGuard);
router.use(adminGuard);

// GET /api/v1/admin/users - Obtener lista de usuarios
router.get('/users', getAllUsers);

// PATCH /api/v1/admin/users/:userId/role - Cambiar rol de usuario
router.patch('/users/:userId/role', updateUserRole);

// GET /api/v1/admin/stats - Obtener estadísticas del sistema
router.get('/stats', getStats);

export default router;
