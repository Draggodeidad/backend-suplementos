import { Response } from 'express';
import { ProfileService } from '../services/profileService';
import { AuthRequest } from '../types/auth';
import { logger } from '../utils/logger';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     Profile:
 *       type: object
 *       properties:
 *         user_id:
 *           type: string
 *           format: uuid
 *         role:
 *           type: string
 *           enum: [user, admin]
 *         terms_accepted_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     MeResponse:
 *       type: object
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/User'
 *         profile:
 *           $ref: '#/components/schemas/Profile'
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /me:
 *   get:
 *     summary: Obtener información del usuario autenticado
 *     description: Retorna la información del usuario y su perfil
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Información del usuario obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MeResponse'
 *             example:
 *               user:
 *                 id: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "user@example.com"
 *                 created_at: "2024-01-01T00:00:00.000Z"
 *                 updated_at: "2024-01-01T00:00:00.000Z"
 *               profile:
 *                 user_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 role: "user"
 *                 terms_accepted_at: "2024-01-01T00:00:00.000Z"
 *                 created_at: "2024-01-01T00:00:00.000Z"
 *                 updated_at: "2024-01-01T00:00:00.000Z"
 *       401:
 *         description: Token de autenticación requerido o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Unauthorized"
 *               message: "Access token required"
 *               timestamp: "2024-01-01T00:00:00.000Z"
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found in request',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Obtener o crear el perfil del usuario
    const profile = await ProfileService.getOrCreateProfile(user.id);

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      profile: {
        user_id: profile.user_id,
        role: profile.role,
        terms_accepted_at: profile.terms_accepted_at,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (error: any) {
    logger.error(
      { error: error.message, userId: req.user?.id },
      'Error in getMe'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get user information',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * @swagger
 * /me/accept-terms:
 *   post:
 *     summary: Aceptar términos y condiciones
 *     description: Marca que el usuario ha aceptado los términos y condiciones
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Términos aceptados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 profile:
 *                   $ref: '#/components/schemas/Profile'
 *       401:
 *         description: Token de autenticación requerido o inválido
 *       500:
 *         description: Error interno del servidor
 */
export const acceptTerms = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found in request',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const profile = await ProfileService.acceptTerms(user.id);

    res.status(200).json({
      message: 'Terms accepted successfully',
      profile,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(
      { error: error.message, userId: req.user?.id },
      'Error accepting terms'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to accept terms',
      timestamp: new Date().toISOString(),
    });
  }
};
