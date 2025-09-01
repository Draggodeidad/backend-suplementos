import { Router } from 'express';
import { getHealth } from '../controllers/healthController';

const router = Router();

// GET /api/v1/health
router.get('/', getHealth);

export default router;
