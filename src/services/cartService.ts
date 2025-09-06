// ==========================================
// SERVICIO PARA GESTIÓN DEL CARRITO
// ==========================================

import { supabaseAdmin } from '../config/supabase';
import {
  Cart,
  CartItem,
  CartItemWithProduct,
  CartSummary,
  StockValidation,
} from '../types/cart';
import {
  NotFoundError,
  ValidationError,
  InternalServerError,
} from '../types/errors';
import { PricingService } from './pricingService';
import { InventoryService } from './inventoryService';
import { logger } from '../utils/logger';

export class CartService {
  /**
   * Obtener o crear carrito del usuario
   */
  static async getOrCreateCart(userId: string): Promise<Cart> {
    try {
      // Buscar carrito existente
      const { data: existingCart, error: findError } = await supabaseAdmin
        .from('carts')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (findError) {
        logger.error({ error: findError, userId }, 'Error finding cart');
        throw new InternalServerError('Failed to find cart');
      }

      if (existingCart) {
        return existingCart;
      }

      // Crear nuevo carrito
      const { data: newCart, error: createError } = await supabaseAdmin
        .from('carts')
        .insert([{ user_id: userId }])
        .select()
        .single();

      if (createError) {
        logger.error({ error: createError, userId }, 'Error creating cart');
        throw new InternalServerError('Failed to create cart');
      }

      logger.info({ userId, cartId: newCart.id }, 'New cart created');
      return newCart;
    } catch (error: any) {
      if (
        error instanceof NotFoundError ||
        error instanceof InternalServerError
      ) {
        throw error;
      }
      logger.error(
        { error: error.message, userId },
        'Error in getOrCreateCart'
      );
      throw new InternalServerError('Failed to get or create cart');
    }
  }

  /**
   * Obtener resumen completo del carrito
   */
  static async getCartSummary(userId: string): Promise<CartSummary> {
    try {
      const cart = await this.getOrCreateCart(userId);
      const items = await this.getCartItemsWithProducts(cart.id);
      const pricing = PricingService.calculatePricing(items);

      const summary: CartSummary = {
        cart,
        items,
        pricing,
        total_items: items.length,
      };

      logger.debug(
        {
          userId,
          cartId: cart.id,
          itemCount: items.length,
          tier: pricing.tier,
          subtotal: pricing.subtotal,
        },
        'Cart summary generated'
      );

      return summary;
    } catch (error: any) {
      if (
        error instanceof NotFoundError ||
        error instanceof InternalServerError
      ) {
        throw error;
      }
      logger.error({ error: error.message, userId }, 'Error in getCartSummary');
      throw new InternalServerError('Failed to get cart summary');
    }
  }

  /**
   * Agregar producto al carrito
   */
  static async addToCart(
    userId: string,
    productId: number,
    qty: number
  ): Promise<CartItemWithProduct> {
    if (qty <= 0) {
      throw new ValidationError('Quantity must be greater than 0', 'qty');
    }

    try {
      const cart = await this.getOrCreateCart(userId);

      // Primero verificar que el producto existe y está activo
      const productExists = await this.validateProductExists(productId);
      if (!productExists.exists) {
        throw new NotFoundError('Product', productId);
      }
      if (!productExists.isActive) {
        throw new ValidationError('Product is not available', 'product_id');
      }

      // Luego validar stock disponible
      const stockValidation = await this.validateStock(productId, qty);
      if (!stockValidation.is_valid) {
        throw new ValidationError(
          `Insufficient stock. Requested: ${qty}, Available: ${stockValidation.available_stock}`,
          'qty'
        );
      }

      // Verificar si el producto ya existe en el carrito
      const { data: existingItem, error: findError } = await supabaseAdmin
        .from('cart_items')
        .select('*')
        .eq('cart_id', cart.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (findError) {
        logger.error(
          { error: findError, cartId: cart.id, productId },
          'Error finding cart item'
        );
        throw new InternalServerError('Failed to check cart item');
      }

      let finalItem: CartItem;

      if (existingItem) {
        // Actualizar cantidad existente
        const newQty = existingItem.qty + qty;

        // Re-validar stock con nueva cantidad
        const newStockValidation = await this.validateStock(productId, newQty);
        if (!newStockValidation.is_valid) {
          throw new ValidationError(
            `Insufficient stock for total quantity. Requested: ${newQty}, Available: ${newStockValidation.available_stock}`,
            'qty'
          );
        }

        const { data: updatedItem, error: updateError } = await supabaseAdmin
          .from('cart_items')
          .update({ qty: newQty })
          .eq('cart_id', cart.id)
          .eq('product_id', productId)
          .select()
          .single();

        if (updateError) {
          logger.error(
            { error: updateError, cartId: cart.id, productId },
            'Error updating cart item'
          );
          throw new InternalServerError('Failed to update cart item');
        }

        finalItem = updatedItem;
      } else {
        // Crear nuevo item
        const { data: newItem, error: insertError } = await supabaseAdmin
          .from('cart_items')
          .insert([
            {
              cart_id: cart.id,
              product_id: productId,
              qty,
            },
          ])
          .select()
          .single();

        if (insertError) {
          logger.error(
            { error: insertError, cartId: cart.id, productId },
            'Error creating cart item'
          );
          throw new InternalServerError('Failed to add item to cart');
        }

        finalItem = newItem;
      }

      // Obtener item con información del producto
      const itemWithProduct = await this.getCartItemWithProduct(
        cart.id,
        productId
      );
      if (!itemWithProduct) {
        throw new InternalServerError('Failed to retrieve added item');
      }

      logger.info(
        {
          userId,
          cartId: cart.id,
          productId,
          qty: finalItem.qty,
          action: existingItem ? 'updated' : 'added',
        },
        'Item added to cart successfully'
      );

      return itemWithProduct;
    } catch (error: any) {
      if (
        error instanceof ValidationError ||
        error instanceof InternalServerError
      ) {
        throw error;
      }
      logger.error(
        { error: error.message, userId, productId, qty },
        'Error in addToCart'
      );
      throw new InternalServerError('Failed to add item to cart');
    }
  }

  /**
   * Actualizar cantidad de un producto en el carrito
   */
  static async updateCartItem(
    userId: string,
    productId: number,
    newQty: number
  ): Promise<CartItemWithProduct | null> {
    if (newQty < 0) {
      throw new ValidationError('Quantity cannot be negative', 'qty');
    }

    try {
      const cart = await this.getOrCreateCart(userId);

      // Si la cantidad es 0, eliminar el item
      if (newQty === 0) {
        await this.removeFromCart(userId, productId);
        return null;
      }

      // Verificar que el producto existe y está activo
      const productExists = await this.validateProductExists(productId);
      if (!productExists.exists) {
        throw new NotFoundError('Product', productId);
      }
      if (!productExists.isActive) {
        throw new ValidationError('Product is not available', 'product_id');
      }

      // Validar stock
      const stockValidation = await this.validateStock(productId, newQty);
      if (!stockValidation.is_valid) {
        throw new ValidationError(
          `Insufficient stock. Requested: ${newQty}, Available: ${stockValidation.available_stock}`,
          'qty'
        );
      }

      // Actualizar item
      const { error } = await supabaseAdmin
        .from('cart_items')
        .update({ qty: newQty })
        .eq('cart_id', cart.id)
        .eq('product_id', productId);

      if (error) {
        logger.error(
          { error, cartId: cart.id, productId },
          'Error updating cart item'
        );
        throw new InternalServerError('Failed to update cart item');
      }

      // Obtener item actualizado
      const updatedItem = await this.getCartItemWithProduct(cart.id, productId);
      if (!updatedItem) {
        throw new NotFoundError('Cart item', `${cart.id}-${productId}`);
      }

      logger.info(
        { userId, cartId: cart.id, productId, newQty },
        'Cart item updated successfully'
      );

      return updatedItem;
    } catch (error: any) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof InternalServerError
      ) {
        throw error;
      }
      logger.error(
        { error: error.message, userId, productId, newQty },
        'Error in updateCartItem'
      );
      throw new InternalServerError('Failed to update cart item');
    }
  }

  /**
   * Eliminar producto del carrito
   */
  static async removeFromCart(
    userId: string,
    productId: number
  ): Promise<void> {
    try {
      const cart = await this.getOrCreateCart(userId);

      const { error } = await supabaseAdmin
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id)
        .eq('product_id', productId);

      if (error) {
        logger.error(
          { error, cartId: cart.id, productId },
          'Error removing cart item'
        );
        throw new InternalServerError('Failed to remove item from cart');
      }

      logger.info(
        { userId, cartId: cart.id, productId },
        'Item removed from cart successfully'
      );
    } catch (error: any) {
      if (error instanceof InternalServerError) {
        throw error;
      }
      logger.error(
        { error: error.message, userId, productId },
        'Error in removeFromCart'
      );
      throw new InternalServerError('Failed to remove item from cart');
    }
  }

  /**
   * Limpiar todo el carrito
   */
  static async clearCart(userId: string): Promise<void> {
    try {
      const cart = await this.getOrCreateCart(userId);

      const { error } = await supabaseAdmin
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id);

      if (error) {
        logger.error({ error, cartId: cart.id }, 'Error clearing cart');
        throw new InternalServerError('Failed to clear cart');
      }

      logger.info({ userId, cartId: cart.id }, 'Cart cleared successfully');
    } catch (error: any) {
      if (error instanceof InternalServerError) {
        throw error;
      }
      logger.error({ error: error.message, userId }, 'Error in clearCart');
      throw new InternalServerError('Failed to clear cart');
    }
  }

  /**
   * Obtener items del carrito con información de productos
   */
  private static async getCartItemsWithProducts(
    cartId: string
  ): Promise<CartItemWithProduct[]> {
    const { data, error } = await supabaseAdmin
      .from('cart_items')
      .select(
        `
        *,
        product:products!inner(
          id,
          sku,
          name,
          description,
          category_id,
          retail_price,
          distributor_price,
          active,
          created_at,
          updated_at
        )
      `
      )
      .eq('cart_id', cartId)
      .eq('product.active', true);

    if (error) {
      logger.error(
        { error, cartId },
        'Error fetching cart items with products'
      );
      throw new InternalServerError('Failed to fetch cart items');
    }

    return data || [];
  }

  /**
   * Obtener un item específico del carrito con información del producto
   */
  private static async getCartItemWithProduct(
    cartId: string,
    productId: number
  ): Promise<CartItemWithProduct | null> {
    const { data, error } = await supabaseAdmin
      .from('cart_items')
      .select(
        `
        *,
        product:products!inner(
          id,
          sku,
          name,
          description,
          category_id,
          retail_price,
          distributor_price,
          active,
          created_at,
          updated_at
        )
      `
      )
      .eq('cart_id', cartId)
      .eq('product_id', productId)
      .eq('product.active', true)
      .maybeSingle();

    if (error) {
      logger.error(
        { error, cartId, productId },
        'Error fetching cart item with product'
      );
      throw new InternalServerError('Failed to fetch cart item');
    }

    return data;
  }

  /**
   * Validar que el producto existe y está activo
   */
  private static async validateProductExists(productId: number): Promise<{
    exists: boolean;
    isActive: boolean;
  }> {
    try {
      const { data: product, error } = await supabaseAdmin
        .from('products')
        .select('id, active')
        .eq('id', productId)
        .maybeSingle();

      if (error) {
        logger.error({ error, productId }, 'Error checking product existence');
        throw new InternalServerError('Failed to check product existence');
      }

      return {
        exists: !!product,
        isActive: product?.active || false,
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, productId },
        'Error in validateProductExists'
      );
      // En caso de error, asumir que no existe por seguridad
      return {
        exists: false,
        isActive: false,
      };
    }
  }

  /**
   * Validar stock disponible para un producto
   */
  private static async validateStock(
    productId: number,
    requestedQty: number
  ): Promise<StockValidation> {
    try {
      const stockCheck = await InventoryService.checkStockAvailability(
        productId,
        requestedQty
      );

      return {
        product_id: productId,
        requested_qty: requestedQty,
        available_stock: stockCheck.currentStock,
        is_valid: stockCheck.available,
      };
    } catch (error: any) {
      logger.error(
        { error: error.message, productId },
        'Error validating stock'
      );
      // En caso de error, asumir stock no disponible por seguridad
      return {
        product_id: productId,
        requested_qty: requestedQty,
        available_stock: 0,
        is_valid: false,
      };
    }
  }
}
