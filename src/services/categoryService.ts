// ==========================================
// SERVICIO PARA GESTIÓN DE CATEGORÍAS
// ==========================================

import { supabaseAdmin } from '../config/supabase';
import { Category } from '../types/catalog';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  ConflictError,
  InternalServerError,
} from '../types/errors';

export class CategoryService {
  /**
   * Obtener todas las categorías
   */
  static async getAllCategories(): Promise<Category[]> {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      logger.error({ error }, 'Error fetching categories');
      throw new InternalServerError('Failed to fetch categories');
    }

    return data || [];
  }

  /**
   * Obtener categoría por ID
   */
  static async getCategoryById(id: number): Promise<Category | null> {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No encontrado
      }
      logger.error({ error, categoryId: id }, 'Error fetching category');
      throw new InternalServerError('Failed to fetch category');
    }

    return data;
  }

  /**
   * Crear nueva categoría
   */
  static async createCategory(name: string): Promise<Category> {
    // Verificar si ya existe
    const existing = await this.getCategoryByName(name);
    if (existing) {
      throw new ConflictError('Category', 'name', name);
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert([{ name }])
      .select()
      .single();

    if (error) {
      logger.error({ error, name }, 'Error creating category');
      throw new InternalServerError('Failed to create category');
    }

    logger.info({ categoryId: data.id, name }, 'Category created successfully');
    return data;
  }

  /**
   * Actualizar categoría
   */
  static async updateCategory(id: number, name: string): Promise<Category> {
    // Verificar que no existe otra categoría con el mismo nombre
    const existing = await this.getCategoryByName(name);
    if (existing && existing.id !== id) {
      throw new ConflictError('Category', 'name', name);
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ error, categoryId: id, name }, 'Error updating category');
      throw new InternalServerError('Failed to update category');
    }

    logger.info(
      { categoryId: id, newName: name },
      'Category updated successfully'
    );
    return data;
  }

  /**
   * Eliminar categoría
   */
  static async deleteCategory(id: number): Promise<void> {
    // Verificar si hay productos asociados
    const { count: productCount } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id);

    if (productCount && productCount > 0) {
      // Actualizar productos para quitar la categoría
      await supabaseAdmin
        .from('products')
        .update({ category_id: null })
        .eq('category_id', id);

      logger.info(
        { categoryId: id, affectedProducts: productCount },
        'Products updated to remove category reference'
      );
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error({ error, categoryId: id }, 'Error deleting category');
      throw new InternalServerError('Failed to delete category');
    }

    logger.info({ categoryId: id }, 'Category deleted successfully');
  }

  /**
   * Obtener categoría por nombre (helper privado)
   */
  private static async getCategoryByName(
    name: string
  ): Promise<Category | null> {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (error) {
      logger.error({ error, name }, 'Error checking category name');
      throw new InternalServerError('Failed to check category name');
    }

    return data;
  }

  /**
   * Obtener estadísticas de categorías
   */
  static async getCategoryStats(): Promise<
    Array<{
      category: Category;
      productCount: number;
    }>
  > {
    const { data, error } = await supabaseAdmin.from('categories').select(`
        *,
        products!inner(count)
      `);

    if (error) {
      logger.error({ error }, 'Error fetching category stats');
      throw new Error('Failed to fetch category statistics');
    }

    return (
      data?.map((category) => ({
        category: {
          id: category.id,
          name: category.name,
        },
        productCount: category.products?.length || 0,
      })) || []
    );
  }
}
