// ==========================================
// SERVICIO PARA GESTIÓN DE INVENTARIO
// ==========================================

import { supabaseAdmin } from '../config/supabase';
import {
  Inventory,
  UpdateInventoryRequest,
  InventoryUpdateResponse,
  LowStockProduct,
} from '../types/catalog';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  ValidationError,
  InsufficientDataError,
  InternalServerError,
} from '../types/errors';

export class InventoryService {
  /**
   * Obtener inventario de un producto
   */
  static async getInventory(productId: number): Promise<Inventory | null> {
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('product_id', productId)
      .maybeSingle();

    if (error) {
      logger.error({ error, productId }, 'Error fetching inventory');
      throw new InternalServerError('Failed to fetch inventory');
    }

    return data;
  }

  /**
   * Crear registro de inventario para un producto
   */
  static async createInventory(
    productId: number,
    stock: number = 0,
    lowStockThreshold: number = 5
  ): Promise<Inventory> {
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .insert([
        {
          product_id: productId,
          stock,
          low_stock_threshold: lowStockThreshold,
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error(
        { error, productId, stock, lowStockThreshold },
        'Error creating inventory'
      );
      throw new InternalServerError('Failed to create inventory');
    }

    logger.info(
      { productId, stock, lowStockThreshold },
      'Inventory created successfully'
    );

    return data;
  }

  /**
   * Actualizar inventario de un producto
   */
  static async updateInventory(
    productId: number,
    updates: UpdateInventoryRequest
  ): Promise<InventoryUpdateResponse> {
    const { stock, low_stock_threshold } = updates;

    // Validar que el stock no sea negativo
    if (stock < 0) {
      throw new ValidationError('Stock cannot be negative', 'stock');
    }

    // Preparar objeto de actualización
    const updateData: Partial<Inventory> = { stock };
    if (low_stock_threshold !== undefined) {
      updateData.low_stock_threshold = low_stock_threshold;
    }

    try {
      // Actualizar inventario
      const { data: inventoryData, error: inventoryError } = await supabaseAdmin
        .from('inventory')
        .update(updateData)
        .eq('product_id', productId)
        .select()
        .single();

      if (inventoryError) {
        logger.error(
          { error: inventoryError, productId, updates },
          'Error updating inventory'
        );
        throw new InternalServerError('Failed to update inventory');
      }

      // Obtener información del producto
      const { data: productData, error: productError } = await supabaseAdmin
        .from('products')
        .select('id, name, sku')
        .eq('id', productId)
        .single();

      if (productError) {
        logger.error(
          { error: productError, productId },
          'Error fetching product info'
        );
        throw new InternalServerError('Failed to fetch product information');
      }

      const response: InventoryUpdateResponse = {
        inventory: inventoryData,
        product: productData,
      };

      logger.info(
        {
          productId,
          newStock: inventoryData.stock,
          lowStockThreshold: inventoryData.low_stock_threshold,
        },
        'Inventory updated successfully'
      );

      return response;
    } catch (error: any) {
      logger.error(
        { error: error.message, productId, updates },
        'Error in updateInventory'
      );
      // Si ya es un error de dominio, re-lanzarlo
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new InternalServerError('Failed to update inventory');
    }
  }

  /**
   * Ajustar stock (sumar o restar cantidad)
   */
  static async adjustStock(
    productId: number,
    adjustment: number,
    reason?: string
  ): Promise<Inventory> {
    // Obtener stock actual
    const currentInventory = await this.getInventory(productId);
    if (!currentInventory) {
      throw new NotFoundError('Inventory', productId);
    }

    const newStock = currentInventory.stock + adjustment;

    if (newStock < 0) {
      throw new InsufficientDataError(
        'stock',
        currentInventory.stock,
        Math.abs(adjustment)
      );
    }

    // Actualizar stock
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .update({ stock: newStock })
      .eq('product_id', productId)
      .select()
      .single();

    if (error) {
      logger.error(
        { error, productId, adjustment, newStock },
        'Error adjusting stock'
      );
      throw new InternalServerError('Failed to adjust stock');
    }

    logger.info(
      {
        productId,
        adjustment,
        previousStock: currentInventory.stock,
        newStock,
        reason,
      },
      'Stock adjusted successfully'
    );

    return data;
  }

  /**
   * Obtener productos con stock bajo usando función SQL
   */
  static async getLowStockProducts(): Promise<LowStockProduct[]> {
    try {
      // Usar función SQL para comparar columnas
      const { data, error } = await supabaseAdmin.rpc('get_low_stock_products');

      if (error) {
        logger.error({ error }, 'Error fetching low stock products');
        throw new InternalServerError('Failed to fetch low stock products');
      }

      return data || [];
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in getLowStockProducts');
      throw new InternalServerError('Failed to get low stock products');
    }
  }

  /**
   * Verificar si un producto tiene stock suficiente
   */
  static async checkStockAvailability(
    productId: number,
    requiredQuantity: number
  ): Promise<{
    available: boolean;
    currentStock: number;
    requested: number;
  }> {
    const inventory = await this.getInventory(productId);

    if (!inventory) {
      return {
        available: false,
        currentStock: 0,
        requested: requiredQuantity,
      };
    }

    return {
      available: inventory.stock >= requiredQuantity,
      currentStock: inventory.stock,
      requested: requiredQuantity,
    };
  }

  /**
   * Reservar stock (decrementar) - Útil para carritos/órdenes
   */
  static async reserveStock(
    productId: number,
    quantity: number
  ): Promise<Inventory> {
    // Verificar disponibilidad
    const availability = await this.checkStockAvailability(productId, quantity);

    if (!availability.available) {
      throw new InsufficientDataError(
        'stock',
        availability.currentStock,
        quantity
      );
    }

    // Decrementar stock
    return await this.adjustStock(productId, -quantity, 'Stock reserved');
  }

  /**
   * Liberar stock reservado (incrementar) - Útil para cancelaciones
   */
  static async releaseStock(
    productId: number,
    quantity: number
  ): Promise<Inventory> {
    return await this.adjustStock(productId, quantity, 'Stock released');
  }

  /**
   * Eliminar registro de inventario
   */
  static async deleteInventory(productId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('inventory')
      .delete()
      .eq('product_id', productId);

    if (error) {
      logger.error({ error, productId }, 'Error deleting inventory');
      throw new InternalServerError('Failed to delete inventory');
    }

    logger.info({ productId }, 'Inventory deleted successfully');
  }

  /**
   * Obtener estadísticas de inventario
   */
  static async getInventoryStats(): Promise<{
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalStockValue: number;
  }> {
    try {
      // Contar productos con inventario
      const { count: totalProducts } = await supabaseAdmin
        .from('inventory')
        .select('*', { count: 'exact', head: true });

      // Contar productos sin stock
      const { count: outOfStockCount } = await supabaseAdmin
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('stock', 0);

      // Obtener productos con stock bajo
      const lowStockProducts = await this.getLowStockProducts();

      return {
        totalProducts: totalProducts || 0,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockCount || 0,
        totalStockValue: 0, // Se podría calcular multiplicando stock × precio
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting inventory stats');
      throw new InternalServerError('Failed to get inventory statistics');
    }
  }
}
