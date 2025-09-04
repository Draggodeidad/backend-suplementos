import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';
import { config } from '../config';
import { logger } from '../utils/logger';
import { JWTPayload, AuthRequest } from '../types/auth';

/**
 * Middleware que verifica el token JWT de Supabase
 */
export const authGuard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Access token required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verificar el token JWT
    const decoded = jwt.verify(token, config.supabaseJwtSecret) as JWTPayload;

    // Obtener el usuario de Supabase
    const { data: user, error } = await supabase.auth.getUser(token);

    if (error || !user.user) {
      logger.warn({ error: error?.message }, 'Invalid token');
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Agregar información del usuario a la request
    (req as any).user = {
      id: user.user.id,
      email: user.user.email,
      phone: user.user.phone,
      created_at: user.user.created_at,
      updated_at: user.user.updated_at,
    };

    logger.debug(
      { userId: user.user.id, email: user.user.email },
      'User authenticated'
    );
    next();
  } catch (error: any) {
    logger.error({ error: error.message }, 'Authentication error');

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token format',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication service error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Middleware opcional que agrega información del usuario si hay token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      next();
      return;
    }

    // Verificar el token JWT
    jwt.verify(token, config.supabaseJwtSecret) as JWTPayload;

    // Obtener el usuario de Supabase
    const { data: user, error } = await supabase.auth.getUser(token);

    if (!error && user.user) {
      (req as any).user = {
        id: user.user.id,
        email: user.user.email,
        phone: user.user.phone,
        created_at: user.user.created_at,
        updated_at: user.user.updated_at,
      };
    }

    next();
  } catch (error) {
    // En modo opcional, los errores no detienen la request
    next();
  }
};

/**
 * Extrae el token Bearer del header Authorization
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
