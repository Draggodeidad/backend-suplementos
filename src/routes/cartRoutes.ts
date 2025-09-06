// ==========================================
// RUTAS DEL CARRITO
// ==========================================

import { Router } from 'express';
import { CartController } from '../controllers/cartController';
import { authGuard } from '../middleware/auth';

const router = Router();

// Aplicar autenticación a todas las rutas del carrito
router.use(authGuard);

// ==========================================
// RUTAS PRINCIPALES DEL CARRITO
// ==========================================

/**
 * GET /cart - Obtener carrito del usuario
 */
router.get('/', CartController.getCart);

/**
 * POST /cart/items - Agregar producto al carrito
 */
router.post('/items', CartController.addToCart);

/**
 * PATCH /cart/items/:productId - Actualizar cantidad de producto
 */
router.patch('/items/:productId', CartController.updateCartItem);

/**
 * DELETE /cart/items/:productId - Eliminar producto del carrito
 */
router.delete('/items/:productId', CartController.removeFromCart);

/**
 * DELETE /cart/clear - Limpiar carrito completo
 */
router.delete('/clear', CartController.clearCart);

/**
 * GET /cart/pricing-info - Obtener información de reglas de pricing
 */
router.get('/pricing-info', CartController.getPricingInfo);

export { router as cartRoutes };
