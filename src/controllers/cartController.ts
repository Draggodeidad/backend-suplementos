// ==========================================
// CONTROLADOR DEL CARRITO
// ==========================================

import { Request, Response } from 'express';
import { CartService } from '../services/cartService';
import { PricingService } from '../services/pricingService';
import {
  AddToCartRequest,
  UpdateCartItemRequest,
  AddToCartResponse,
  CartResponse,
  UpdateCartItemResponse,
  RemoveFromCartResponse,
} from '../types/cart';
import { AuthRequest } from '../types/auth';
import {
  ValidationError,
  NotFoundError,
  InternalServerError,
} from '../types/errors';
import { logger } from '../utils/logger';

export class CartController {
  /**
   * @swagger
   * /api/v1/cart:
   *   get:
   *     summary: Obtener carrito del usuario
   *     description: Retorna el carrito completo con items, precios y reglas comerciales aplicadas
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Carrito obtenido exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 cart_summary:
   *                   $ref: '#/components/schemas/CartSummary'
   *                 pricing_info:
   *                   type: object
   *                   properties:
   *                     distributor_threshold:
   *                       type: number
   *                       example: 5000
   *                     minimum_items:
   *                       type: number
   *                       example: 7
   *       401:
   *         description: Token de autenticación requerido
   *       500:
   *         description: Error interno del servidor
   */
  static async getCart(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;

      logger.info({ userId }, 'Getting cart for user');

      const cartSummary = await CartService.getCartSummary(userId);
      const pricingConfig = PricingService.getPricingConfig();

      const response: CartResponse & { pricing_info: any } = {
        success: true,
        cart_summary: cartSummary,
        pricing_info: {
          distributor_threshold: pricingConfig.DISTRIBUTOR_THRESHOLD,
          minimum_items: pricingConfig.MINIMUM_ORDER_ITEMS,
        },
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in getCart');

      if (error instanceof InternalServerError) {
        res.status(500).json({
          success: false,
          error: 'Failed to get cart',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  /**
   * @swagger
   * /api/v1/cart/items:
   *   post:
   *     summary: Agregar producto al carrito
   *     description: Agrega un producto al carrito o incrementa la cantidad si ya existe
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - product_id
   *               - qty
   *             properties:
   *               product_id:
   *                 type: integer
   *                 example: 1
   *               qty:
   *                 type: integer
   *                 minimum: 1
   *                 example: 2
   *     responses:
   *       200:
   *         description: Producto agregado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AddToCartResponse'
   *       400:
   *         description: Datos de entrada inválidos
   *       401:
   *         description: Token de autenticación requerido
   *       404:
   *         description: Producto no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  static async addToCart(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const { product_id, qty }: AddToCartRequest = req.body;

      // Validación de entrada
      if (!product_id || typeof product_id !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Product ID is required and must be a number',
        });
        return;
      }

      if (!qty || typeof qty !== 'number' || qty <= 0) {
        res.status(400).json({
          success: false,
          error: 'Quantity is required and must be a positive number',
        });
        return;
      }

      logger.info({ userId, product_id, qty }, 'Adding item to cart');

      const item = await CartService.addToCart(userId, product_id, qty);
      const cartSummary = await CartService.getCartSummary(userId);

      const response: AddToCartResponse = {
        success: true,
        item,
        cart_summary: cartSummary,
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in addToCart');

      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      } else if (error instanceof InternalServerError) {
        res.status(500).json({
          success: false,
          error: 'Failed to add item to cart',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  /**
   * @swagger
   * /api/v1/cart/items/{productId}:
   *   patch:
   *     summary: Actualizar cantidad de producto en carrito
   *     description: Actualiza la cantidad de un producto específico en el carrito
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID del producto a actualizar
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - qty
   *             properties:
   *               qty:
   *                 type: integer
   *                 minimum: 0
   *                 example: 3
   *                 description: Nueva cantidad (0 para eliminar)
   *     responses:
   *       200:
   *         description: Cantidad actualizada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UpdateCartItemResponse'
   *       400:
   *         description: Datos de entrada inválidos
   *       401:
   *         description: Token de autenticación requerido
   *       404:
   *         description: Producto no encontrado en el carrito
   *       500:
   *         description: Error interno del servidor
   */
  static async updateCartItem(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const productId = parseInt(req.params.productId);
      const { qty }: UpdateCartItemRequest = req.body;

      // Validación de entrada
      if (isNaN(productId)) {
        res.status(400).json({
          success: false,
          error: 'Product ID must be a valid number',
        });
        return;
      }

      if (typeof qty !== 'number' || qty < 0) {
        res.status(400).json({
          success: false,
          error: 'Quantity must be a non-negative number',
        });
        return;
      }

      logger.info({ userId, productId, qty }, 'Updating cart item');

      const item = await CartService.updateCartItem(userId, productId, qty);
      const cartSummary = await CartService.getCartSummary(userId);

      const response: UpdateCartItemResponse = {
        success: true,
        item: item || undefined,
        cart_summary: cartSummary,
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in updateCartItem');

      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      } else if (error instanceof InternalServerError) {
        res.status(500).json({
          success: false,
          error: 'Failed to update cart item',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  /**
   * @swagger
   * /api/v1/cart/items/{productId}:
   *   delete:
   *     summary: Eliminar producto del carrito
   *     description: Elimina completamente un producto del carrito
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID del producto a eliminar
   *     responses:
   *       200:
   *         description: Producto eliminado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RemoveFromCartResponse'
   *       400:
   *         description: ID de producto inválido
   *       401:
   *         description: Token de autenticación requerido
   *       500:
   *         description: Error interno del servidor
   */
  static async removeFromCart(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const productId = parseInt(req.params.productId);

      // Validación de entrada
      if (isNaN(productId)) {
        res.status(400).json({
          success: false,
          error: 'Product ID must be a valid number',
        });
        return;
      }

      logger.info({ userId, productId }, 'Removing item from cart');

      await CartService.removeFromCart(userId, productId);
      const cartSummary = await CartService.getCartSummary(userId);

      const response: RemoveFromCartResponse = {
        success: true,
        cart_summary: cartSummary,
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in removeFromCart');

      if (error instanceof InternalServerError) {
        res.status(500).json({
          success: false,
          error: 'Failed to remove item from cart',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  /**
   * @swagger
   * /api/v1/cart/clear:
   *   delete:
   *     summary: Limpiar carrito completo
   *     description: Elimina todos los productos del carrito del usuario
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Carrito limpiado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Cart cleared successfully"
   *       401:
   *         description: Token de autenticación requerido
   *       500:
   *         description: Error interno del servidor
   */
  static async clearCart(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;

      logger.info({ userId }, 'Clearing cart');

      await CartService.clearCart(userId);

      res.status(200).json({
        success: true,
        message: 'Cart cleared successfully',
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in clearCart');

      if (error instanceof InternalServerError) {
        res.status(500).json({
          success: false,
          error: 'Failed to clear cart',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  /**
   * @swagger
   * /api/v1/cart/pricing-info:
   *   get:
   *     summary: Obtener información de reglas de pricing
   *     description: Retorna las reglas comerciales y umbrales para pricing
   *     tags: [Cart]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Información de pricing obtenida exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 pricing_config:
   *                   type: object
   *                   properties:
   *                     distributor_threshold:
   *                       type: number
   *                       example: 5000
   *                       description: Monto mínimo para precios de distribuidor
   *                     minimum_items:
   *                       type: number
   *                       example: 7
   *                       description: Cantidad mínima de artículos para checkout
   *       401:
   *         description: Token de autenticación requerido
   */
  static async getPricingInfo(req: Request, res: Response): Promise<void> {
    try {
      const pricingConfig = PricingService.getPricingConfig();

      res.status(200).json({
        success: true,
        pricing_config: {
          distributor_threshold: pricingConfig.DISTRIBUTOR_THRESHOLD,
          minimum_items: pricingConfig.MINIMUM_ORDER_ITEMS,
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error in getPricingInfo');
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}
