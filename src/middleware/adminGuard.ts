import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { ProfileService } from '../services/profileService';
import { logger } from '../utils/logger';

/**
 * Middleware que verifica si el usuario autenticado es administrador
 */
export const adminGuard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Obtener el perfil del usuario para verificar su rol
    const profile = await ProfileService.getProfile(user.id);

    if (!profile) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'User profile not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (profile.role !== 'admin') {
      logger.warn(
        { userId: user.id, email: user.email, role: profile.role },
        'Non-admin user attempted to access admin endpoint'
      );

      res.status(403).json({
        error: 'Forbidden',
        message: 'Administrator privileges required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Agregar información del perfil a la request
    (req as any).profile = profile;

    logger.info({ userId: user.id, email: user.email }, 'Admin access granted');
    next();
  } catch (error: any) {
    logger.error(
      { error: error.message, userId: req.user?.id },
      'Error in adminGuard'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify admin privileges',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Middleware opcional que agrega información de admin si el usuario es admin
 */
export const optionalAdminGuard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      next();
      return;
    }

    const profile = await ProfileService.getProfile(user.id);

    if (profile && profile.role === 'admin') {
      (req as any).profile = profile;
      (req as any).isAdmin = true;
    }

    next();
  } catch (error) {
    // En modo opcional, los errores no detienen la request
    next();
  }
};
