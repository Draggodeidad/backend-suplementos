import { supabase, supabaseAdmin } from '../config/supabase';
import { Profile } from '../types/auth';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  InternalServerError,
} from '../types/errors';

export class ProfileService {
  /**
   * Obtener perfil por ID de usuario
   */
  static async getProfile(userId: string): Promise<Profile | null> {
    try {
      // Usar cliente admin para evitar problemas de RLS
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw error;
      }

      return data;
    } catch (error: any) {
      logger.error({ error: error.message, userId }, 'Error getting profile');
      throw new InternalServerError('Failed to get profile');
    }
  }

  /**
   * Crear perfil para usuario
   */
  static async createProfile(
    userId: string,
    data: Partial<Profile> = {}
  ): Promise<Profile> {
    try {
      const profileData = {
        user_id: userId,
        role: data.role || 'user',
        terms_accepted_at: data.terms_accepted_at || null,
        ...data,
      };

      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info({ userId, role: profile.role }, 'Profile created');
      return profile;
    } catch (error: any) {
      logger.error({ error: error.message, userId }, 'Error creating profile');
      throw new InternalServerError('Failed to create profile');
    }
  }

  /**
   * Actualizar perfil
   */
  static async updateProfile(
    userId: string,
    data: Partial<Profile>
  ): Promise<Profile> {
    try {
      logger.info({ userId, updateData: data }, 'Attempting to update profile');

      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error({ error, userId }, 'Supabase error updating profile');
        throw error;
      }

      if (!profile) {
        logger.error({ userId }, 'No profile returned after update');
        throw new NotFoundError('Profile', userId);
      }

      logger.info({ userId, profile }, 'Profile updated successfully');
      return profile;
    } catch (error: any) {
      logger.error(
        { error: error.message, errorCode: error.code, userId },
        'Error updating profile'
      );
      // Si ya es un error de dominio, re-lanzarlo
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(`Failed to update profile: ${error.message}`);
    }
  }

  /**
   * Obtener o crear perfil de manera atómica usando upsert.
   * Soluciona condiciones de carrera en solicitudes concurrentes.
   *
   * IMPORTANTE: Si el perfil ya existe, lo retorna sin modificar.
   * Solo crea perfil nuevo si no existe.
   *
   * @param userId - ID del usuario
   * @param initialData - Datos iniciales opcionales para el perfil (solo para creación)
   * @returns Profile - El perfil existente o recién creado
   */
  static async getOrCreateProfile(
    userId: string,
    initialData: Partial<Profile> = {}
  ): Promise<Profile> {
    try {
      // Primero intentar obtener el perfil existente
      const existingProfile = await this.getProfile(userId);

      if (existingProfile) {
        logger.info(
          {
            userId,
            role: existingProfile.role,
            action: 'retrieved',
            profileId: existingProfile.user_id,
          },
          'Profile retrieved - already exists'
        );
        return existingProfile;
      }

      // Si no existe, usar upsert para crearlo de manera atómica
      const profileData = {
        user_id: userId,
        role: initialData.role || 'user',
        terms_accepted_at: initialData.terms_accepted_at || null,
        // Los timestamps se manejan automáticamente por la base de datos
      };

      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .upsert(profileData, {
          onConflict: 'user_id',
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) {
        // Si falló el upsert, podría ser que otro hilo lo creó primero
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          logger.info(
            { userId },
            'Concurrent creation detected, fetching existing profile'
          );
          const fallbackProfile = await this.getProfile(userId);
          if (fallbackProfile) {
            return fallbackProfile;
          }
        }
        throw error;
      }

      logger.info(
        {
          userId,
          role: profile.role,
          action: 'created',
          profileId: profile.user_id,
        },
        'Profile created via atomic upsert'
      );

      return profile;
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          errorCode: error.code,
          userId,
        },
        'Error in atomic getOrCreateProfile'
      );

      throw new InternalServerError(`Failed to get or create profile: ${error.message}`);
    }
  }

  /**
   * Aceptar términos y condiciones
   */
  static async acceptTerms(userId: string): Promise<Profile> {
    try {
      return await this.updateProfile(userId, {
        terms_accepted_at: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error({ error: error.message, userId }, 'Error accepting terms');
      throw new InternalServerError('Failed to accept terms');
    }
  }
}
