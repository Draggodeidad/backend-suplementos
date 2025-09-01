import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { ProfileService } from '../services/profileService';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * @swagger
 * components:
 *   schemas:
 *     UserWithProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         created_at:
 *           type: string
 *           format: date-time
 *         profile:
 *           $ref: '#/components/schemas/Profile'
 *     AdminStatsResponse:
 *       type: object
 *       properties:
 *         total_users:
 *           type: number
 *         total_admins:
 *           type: number
 *         users_with_accepted_terms:
 *           type: number
 *         recent_registrations:
 *           type: number
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Obtener lista de todos los usuarios (solo admins)
 *     description: Retorna lista de usuarios con sus perfiles
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de usuarios a retornar
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Número de usuarios a omitir (paginación)
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserWithProfile'
 *                 total:
 *                   type: number
 *                 limit:
 *                   type: number
 *                 offset:
 *                   type: number
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const getAllUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Obtener usuarios de Supabase Auth
    const { data: authUsers, error: authError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: Math.floor(offset / limit) + 1,
        perPage: limit,
      });

    if (authError) {
      throw authError;
    }

    // Obtener perfiles correspondientes
    const userIds = authUsers.users.map((user) => user.id);
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .in('user_id', userIds);

    if (profilesError) {
      throw profilesError;
    }

    // Combinar datos de auth y perfiles
    const usersWithProfiles = authUsers.users.map((user) => {
      const profile = profiles?.find((p) => p.user_id === user.id);
      return {
        id: user.id,
        email: user.email,
        phone: user.phone,
        created_at: user.created_at,
        updated_at: user.updated_at,
        profile: profile || null,
      };
    });

    res.status(200).json({
      users: usersWithProfiles,
      total: authUsers.total,
      limit,
      offset,
    });

    logger.info(
      { adminId: req.user?.id, usersReturned: usersWithProfiles.length },
      'Admin retrieved users list'
    );
  } catch (error: any) {
    logger.error(
      { error: error.message, adminId: req.user?.id },
      'Error getting users list'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get users list',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * @swagger
 * /admin/users/{userId}/role:
 *   patch:
 *     summary: Cambiar rol de un usuario (solo admins)
 *     description: Cambia el rol de un usuario entre 'user' y 'admin'
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *             required:
 *               - role
 *     responses:
 *       200:
 *         description: Rol actualizado exitosamente
 *       400:
 *         description: Rol inválido
 *       403:
 *         description: Privilegios de administrador requeridos
 *       404:
 *         description: Usuario no encontrado
 */
export const updateUserRole = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'admin'].includes(role)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Role must be either "user" or "admin"',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verificar que el usuario existe
    const { data: user, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !user) {
      res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Actualizar el rol en el perfil
    const updatedProfile = await ProfileService.updateProfile(userId, { role });

    res.status(200).json({
      message: 'User role updated successfully',
      user: {
        id: user.user.id,
        email: user.user.email,
        profile: updatedProfile,
      },
      timestamp: new Date().toISOString(),
    });

    logger.info(
      {
        adminId: req.user?.id,
        targetUserId: userId,
        newRole: role,
        userEmail: user.user.email,
      },
      'Admin updated user role'
    );
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        adminId: req.user?.id,
        userId: req.params.userId,
      },
      'Error updating user role'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update user role',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     summary: Obtener estadísticas del sistema (solo admins)
 *     description: Retorna estadísticas generales de usuarios y sistema
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminStatsResponse'
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const getStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Obtener estadísticas de usuarios
    const { data: profileStats, error: statsError } = await supabaseAdmin
      .from('profiles')
      .select('role, terms_accepted_at', { count: 'exact' });

    if (statsError) {
      throw statsError;
    }

    // Calcular estadísticas
    const totalUsers = profileStats?.length || 0;
    const totalAdmins =
      profileStats?.filter((p) => p.role === 'admin').length || 0;
    const usersWithAcceptedTerms =
      profileStats?.filter((p) => p.terms_accepted_at !== null).length || 0;

    // Registros recientes (últimos 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentUsers, error: recentError } = await supabaseAdmin
      .from('profiles')
      .select('created_at', { count: 'exact' })
      .gte('created_at', sevenDaysAgo.toISOString());

    if (recentError) {
      throw recentError;
    }

    const stats = {
      total_users: totalUsers,
      total_admins: totalAdmins,
      users_with_accepted_terms: usersWithAcceptedTerms,
      recent_registrations: recentUsers?.length || 0,
      users_without_accepted_terms: totalUsers - usersWithAcceptedTerms,
      admin_percentage:
        totalUsers > 0 ? Math.round((totalAdmins / totalUsers) * 100) : 0,
    };

    res.status(200).json(stats);

    logger.info(
      { adminId: req.user?.id, stats },
      'Admin retrieved system stats'
    );
  } catch (error: any) {
    logger.error(
      { error: error.message, adminId: req.user?.id },
      'Error getting system stats'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get system statistics',
      timestamp: new Date().toISOString(),
    });
  }
};
