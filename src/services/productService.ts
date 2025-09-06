// ==========================================
// SERVICIO PARA GESTIÓN DE PRODUCTOS
// ==========================================

import { supabaseAdmin } from '../config/supabase';
import {
  Product,
  CreateProductRequest,
  UpdateProductRequest,
  ProductListResponse,
  ProductQueryParams,
} from '../types/catalog';
import { InventoryService } from './inventoryService';
import { ImageService } from './imageService';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError,
} from '../types/errors';

export class ProductService {
  /**
   * Obtener lista de productos con filtros y paginación
   */
  static async getProducts(
    params: ProductQueryParams
  ): Promise<ProductListResponse> {
    const {
      page = '1',
      limit = '20',
      category_id,
      search,
      active = 'true',
      sort = 'created_at',
      order = 'desc',
    } = params;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    try {
      // Construir query base
      let query = supabaseAdmin.from('products').select(
        `
          *,
          category:categories(id, name),
          images:product_images(*),
          inventory(*)
        `,
        { count: 'exact' }
      );

      // Aplicar filtros
      if (active === 'true') {
        query = query.eq('active', true);
      } else if (active === 'false') {
        query = query.eq('active', false);
      }

      if (category_id) {
        const categoryId = parseInt(category_id);
        if (!isNaN(categoryId)) {
          query = query.eq('category_id', categoryId);
        }
      }

      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        query = query.or(
          `name.ilike.${searchTerm},description.ilike.${searchTerm},sku.ilike.${searchTerm}`
        );
      }

      // Aplicar ordenamiento
      const isAsc = order === 'asc';
      switch (sort) {
        case 'name':
          query = query.order('name', { ascending: isAsc });
          break;
        case 'price':
          query = query.order('retail_price', { ascending: isAsc });
          break;
        case 'created_at':
        default:
          query = query.order('created_at', { ascending: isAsc });
          break;
      }

      // Aplicar paginación
      query = query.range(offset, offset + limitNum - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error({ error, params }, 'Error fetching products');
        throw new InternalServerError('Failed to fetch products');
      }

      // Procesar datos
      const products = (data || []).map(this.formatProductData);
      const total = count || 0;
      const totalPages = Math.ceil(total / limitNum);

      const response: ProductListResponse = {
        products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        },
        filters: {
          category_id: category_id ? parseInt(category_id) : undefined,
          search: search || undefined,
          active: active !== 'all' ? active === 'true' : undefined,
        },
      };

      return response;
    } catch (error: any) {
      logger.error({ error: error.message, params }, 'Error in getProducts');
      throw new InternalServerError('Failed to fetch products');
    }
  }

  /**
   * Obtener producto por ID con relaciones
   */
  static async getProductById(id: number): Promise<Product | null> {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(
        `
        *,
        category:categories(id, name),
        images:product_images(*),
        inventory(*)
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error({ error, productId: id }, 'Error fetching product');
      throw new InternalServerError('Failed to fetch product');
    }

    return data ? this.formatProductData(data) : null;
  }

  /**
   * Crear nuevo producto
   */
  static async createProduct(
    productData: CreateProductRequest
  ): Promise<Product> {
    const {
      sku,
      name,
      description,
      category_id,
      retail_price,
      distributor_price,
      active = true,
      initial_stock = 0,
      low_stock_threshold = 5,
    } = productData;

    try {
      // Verificar que el SKU no exista
      const existingProduct = await this.getProductBySku(sku);
      if (existingProduct) {
        throw new ConflictError('Product', 'SKU', sku);
      }

      // Crear producto
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .insert([
          {
            sku,
            name,
            description,
            category_id,
            retail_price,
            distributor_price,
            active,
          },
        ])
        .select()
        .single();

      if (productError) {
        logger.error(
          { error: productError, productData },
          'Error creating product'
        );
        throw new InternalServerError('Failed to create product');
      }

      // Crear inventario inicial
      await InventoryService.createInventory(
        product.id,
        initial_stock,
        low_stock_threshold
      );

      logger.info(
        { productId: product.id, sku, name },
        'Product created successfully'
      );

      // Retornar producto completo
      const completeProduct = await this.getProductById(product.id);
      return completeProduct!;
    } catch (error: any) {
      logger.error(
        { error: error.message, productData },
        'Error in createProduct'
      );
      // Si ya es un error de dominio, re-lanzarlo
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new InternalServerError('Failed to create product');
    }
  }

  /**
   * Actualizar producto
   */
  static async updateProduct(
    id: number,
    updates: UpdateProductRequest
  ): Promise<Product> {
    try {
      // Verificar que el producto existe
      const existingProduct = await this.getProductById(id);
      if (!existingProduct) {
        throw new NotFoundError('Product', id);
      }

      // Si se actualiza el SKU, verificar que no exista
      if (updates.sku && updates.sku !== existingProduct.sku) {
        const productWithSku = await this.getProductBySku(updates.sku);
        if (productWithSku) {
          throw new ConflictError('Product', 'SKU', updates.sku);
        }
      }

      // Actualizar producto
      const { data, error } = await supabaseAdmin
        .from('products')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error(
          { error, productId: id, updates },
          'Error updating product'
        );
        throw new InternalServerError('Failed to update product');
      }

      logger.info({ productId: id, updates }, 'Product updated successfully');

      // Retornar producto completo
      const completeProduct = await this.getProductById(id);
      return completeProduct!;
    } catch (error: any) {
      logger.error(
        { error: error.message, productId: id, updates },
        'Error in updateProduct'
      );
      // Si ya es un error de dominio, re-lanzarlo
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new InternalServerError('Failed to update product');
    }
  }

  /**
   * Eliminar producto
   */
  static async deleteProduct(id: number): Promise<void> {
    try {
      // Verificar que el producto existe
      const existingProduct = await this.getProductById(id);
      if (!existingProduct) {
        throw new NotFoundError('Product', id);
      }

      // Eliminar imágenes asociadas
      await ImageService.deleteAllProductImages(id);

      // Eliminar inventario
      await InventoryService.deleteInventory(id);

      // Eliminar producto (las imágenes se eliminan por CASCADE)
      const { error } = await supabaseAdmin
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error({ error, productId: id }, 'Error deleting product');
        throw new InternalServerError('Failed to delete product');
      }

      logger.info(
        { productId: id, sku: existingProduct.sku, name: existingProduct.name },
        'Product deleted successfully'
      );
    } catch (error: any) {
      logger.error(
        { error: error.message, productId: id },
        'Error in deleteProduct'
      );
      // Si ya es un error de dominio, re-lanzarlo
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError('Failed to delete product');
    }
  }

  /**
   * Buscar producto por SKU
   */
  static async getProductBySku(sku: string): Promise<Product | null> {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('sku', sku)
      .maybeSingle();

    if (error) {
      logger.error({ error, sku }, 'Error fetching product by SKU');
      throw new InternalServerError('Failed to fetch product by SKU');
    }

    return data;
  }

  /**
   * Activar/desactivar producto
   */
  static async toggleProductStatus(id: number): Promise<Product> {
    const existingProduct = await this.getProductById(id);
    if (!existingProduct) {
      throw new NotFoundError('Product', id);
    }

    return await this.updateProduct(id, { active: !existingProduct.active });
  }

  /**
   * Obtener productos por categoría
   */
  static async getProductsByCategory(categoryId: number): Promise<Product[]> {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(
        `
        *,
        category:categories(id, name),
        images:product_images(*),
        inventory(*)
      `
      )
      .eq('category_id', categoryId)
      .eq('active', true)
      .order('name');

    if (error) {
      logger.error(
        { error, categoryId },
        'Error fetching products by category'
      );
      throw new InternalServerError('Failed to fetch products by category');
    }

    return (data || []).map(this.formatProductData);
  }

  /**
   * Formatear datos del producto (helper privado)
   */
  private static formatProductData(data: any): Product {
    return {
      id: data.id,
      sku: data.sku,
      name: data.name,
      description: data.description,
      category_id: data.category_id,
      retail_price: parseFloat(data.retail_price),
      distributor_price: parseFloat(data.distributor_price),
      active: data.active,
      created_at: data.created_at,
      updated_at: data.updated_at,
      category: data.category || undefined,
      images: data.images || [],
      inventory: data.inventory || undefined,
    };
  }

  /**
   * Obtener estadísticas de productos
   */
  static async getProductStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    withImages: number;
    categories: number;
  }> {
    try {
      // Total de productos
      const { count: total } = await supabaseAdmin
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Productos activos
      const { count: active } = await supabaseAdmin
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);

      // Productos con imágenes - usar consulta con JOIN para contar productos que tienen imágenes
      const { data: productsWithImages } = await supabaseAdmin
        .from('products')
        .select(
          `
          id,
          product_images!inner(id)
        `
        )
        .not('id', 'is', null);

      // Deduplicar por ID de producto para evitar contar productos con múltiples imágenes más de una vez
      const uniqueProductIds = new Set(
        productsWithImages?.map((product) => product.id) || []
      );
      const withImages = uniqueProductIds.size;

      // Categorías utilizadas
      const { count: categories } = await supabaseAdmin
        .from('categories')
        .select('*', { count: 'exact', head: true });

      return {
        total: total || 0,
        active: active || 0,
        inactive: (total || 0) - (active || 0),
        withImages: withImages || 0,
        categories: categories || 0,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting product stats');
      throw new InternalServerError('Failed to get product statistics');
    }
  }
}
