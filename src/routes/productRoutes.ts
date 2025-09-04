// ==========================================
// RUTAS PÚBLICAS PARA PRODUCTOS
// ==========================================

import { Router } from 'express';
import {
  getProducts,
  getProductById,
  getCategories,
  getProductsByCategory,
} from '../controllers/productController';

const router = Router();

// ==========================================
// RUTAS PÚBLICAS DE PRODUCTOS
// ==========================================

/**
 * GET /products
 * Obtener lista de productos con filtros y paginación
 * Query params: page, limit, category_id, search, sort, order
 */
router.get('/products', getProducts);

/**
 * GET /products/:id
 * Obtener producto específico por ID
 */
router.get('/products/:id', getProductById);

/**
 * GET /products/category/:categoryId
 * Obtener productos de una categoría específica
 */
router.get('/products/category/:categoryId', getProductsByCategory);

// ==========================================
// RUTAS PÚBLICAS DE CATEGORÍAS
// ==========================================

/**
 * GET /categories
 * Obtener lista de todas las categorías
 */
router.get('/categories', getCategories);

export default router;
