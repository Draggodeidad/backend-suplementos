import { supabase, supabaseAdmin } from '../config/supabase';
import { Profile } from '../types/auth';
import { logger } from '../utils/logger';

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
      throw new Error('Failed to get profile');
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
      throw new Error('Failed to create profile');
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
        throw error;
      }

      logger.info({ userId }, 'Profile updated');
      return profile;
    } catch (error: any) {
      logger.error({ error: error.message, userId }, 'Error updating profile');
      throw new Error('Failed to update profile');
    }
  }

  /**
   * Obtener o crear perfil (usado cuando un usuario se autentica por primera vez)
   */
  static async getOrCreateProfile(userId: string): Promise<Profile> {
    try {
      let profile = await this.getProfile(userId);

      if (!profile) {
        profile = await this.createProfile(userId);
      }

      return profile;
    } catch (error: any) {
      logger.error(
        { error: error.message, userId },
        'Error getting or creating profile'
      );
      throw new Error('Failed to get or create profile');
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
      throw new Error('Failed to accept terms');
    }
  }
}
