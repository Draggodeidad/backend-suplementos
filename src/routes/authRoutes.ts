import { Router } from 'express';
import { authGuard } from '../middleware/auth';
import { getMe, acceptTerms } from '../controllers/authController';

const router = Router();

// GET /api/v1/me - Obtener información del usuario autenticado
router.get('/me', authGuard, getMe);

// POST /api/v1/me/accept-terms - Aceptar términos y condiciones
router.post('/me/accept-terms', authGuard, acceptTerms);

export default router;
