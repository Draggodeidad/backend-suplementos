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
 *     description: Retorna lista de usuarios con sus perfiles usando paginación basada en cursor
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 1000
 *         description: Número máximo de usuarios a retornar
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Cursor para paginación (ID del último usuario de la página anterior)
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Orden de los resultados por fecha de creación
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
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: number
 *                     hasNext:
 *                       type: boolean
 *                     hasPrevious:
 *                       type: boolean
 *                     nextCursor:
 *                       type: string
 *                     previousCursor:
 *                       type: string
 *                     count:
 *                       type: number
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const getAllUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Validar y parsear parámetros
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000);
    const cursor = req.query.cursor as string;
    const order = (req.query.order as string) === 'desc' ? 'desc' : 'asc';

    // Construir query base para perfiles
    let profileQuery = supabaseAdmin
      .from('profiles')
      .select('user_id, role, terms_accepted_at, created_at, updated_at')
      .order('created_at', { ascending: order === 'asc' });

    // Aplicar cursor para paginación si existe
    if (cursor) {
      // Obtener el timestamp del cursor
      const { data: cursorProfile, error: cursorError } = await supabaseAdmin
        .from('profiles')
        .select('created_at')
        .eq('user_id', cursor)
        .single();

      if (cursorError) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid cursor provided',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (order === 'asc') {
        profileQuery = profileQuery.gt('created_at', cursorProfile.created_at);
      } else {
        profileQuery = profileQuery.lt('created_at', cursorProfile.created_at);
      }
    }

    // Obtener un registro extra para determinar si hay más páginas
    profileQuery = profileQuery.limit(limit + 1);

    const { data: profiles, error: profilesError } = await profileQuery;

    if (profilesError) {
      throw profilesError;
    }

    // Verificar si hay más páginas disponibles
    const hasNext = profiles.length > limit;
    const actualProfiles = hasNext ? profiles.slice(0, limit) : profiles;
    const hasPrevious = !!cursor;

    // Obtener detalles de autenticación para los usuarios
    const userIds = actualProfiles.map((profile) => profile.user_id);

    if (userIds.length === 0) {
      res.status(200).json({
        users: [],
        pagination: {
          limit,
          hasNext: false,
          hasPrevious,
          nextCursor: null,
          previousCursor: null,
          count: 0,
        },
      });
      return;
    }

    // Obtener datos de autenticación en lotes
    const authUsersPromises = userIds.map(async (userId) => {
      try {
        const { data: user, error } =
          await supabaseAdmin.auth.admin.getUserById(userId);
        return error ? null : user.user;
      } catch {
        return null;
      }
    });

    const authUsersResults = await Promise.allSettled(authUsersPromises);
    const authUsers = authUsersResults
      .filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value !== null
      )
      .map((result) => result.value);

    // Combinar datos de auth y perfiles
    const usersWithProfiles = actualProfiles
      .map((profile) => {
        const authUser = authUsers.find((user) => user?.id === profile.user_id);
        if (!authUser) return null;

        return {
          id: authUser.id,
          email: authUser.email,
          phone: authUser.phone,
          created_at: authUser.created_at,
          updated_at: authUser.updated_at,
          profile: {
            user_id: profile.user_id,
            role: profile.role,
            terms_accepted_at: profile.terms_accepted_at,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
          },
        };
      })
      .filter((user) => user !== null);

    // Preparar cursors para navegación
    const nextCursor =
      hasNext && usersWithProfiles.length > 0
        ? usersWithProfiles[usersWithProfiles.length - 1].id
        : null;

    // Para obtener el cursor anterior, necesitaríamos hacer otra consulta
    // Por simplicidad, usamos el primer usuario de la página actual
    const previousCursor =
      hasPrevious && usersWithProfiles.length > 0
        ? usersWithProfiles[0].id
        : null;

    const response = {
      users: usersWithProfiles,
      pagination: {
        limit,
        hasNext,
        hasPrevious,
        nextCursor,
        previousCursor,
        count: usersWithProfiles.length,
      },
    };

    res.status(200).json(response);

    logger.info(
      {
        adminId: req.user?.id,
        usersReturned: usersWithProfiles.length,
        cursor,
        hasNext,
        hasPrevious,
      },
      'Admin retrieved users list with cursor pagination'
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
