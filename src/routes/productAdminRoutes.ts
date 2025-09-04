// ==========================================
// RUTAS ADMIN PARA PRODUCTOS Y CATEGORÍAS
// ==========================================

import { Router } from 'express';
import { authGuard } from '../middleware/auth';
import { adminGuard } from '../middleware/adminGuard';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  generateImageUploadUrl,
  addImageToProduct,
  updateInventory,
} from '../controllers/productAdminController';
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryAdminController';

const router = Router();

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN Y AUTORIZACIÓN
// ==========================================

// Todas las rutas admin requieren autenticación Y permisos de admin
router.use(authGuard);
router.use(adminGuard);

// ==========================================
// GESTIÓN DE CATEGORÍAS (ADMIN)
// ==========================================

/**
 * POST /admin/categories
 * Crear nueva categoría
 */
router.post('/categories', createCategory);

/**
 * PUT /admin/categories/:id
 * Actualizar categoría existente
 */
router.put('/categories/:id', updateCategory);

/**
 * DELETE /admin/categories/:id
 * Eliminar categoría
 */
router.delete('/categories/:id', deleteCategory);

// ==========================================
// GESTIÓN DE PRODUCTOS (ADMIN)
// ==========================================

/**
 * POST /admin/products
 * Crear nuevo producto
 */
router.post('/products', createProduct);

/**
 * PUT /admin/products/:id
 * Actualizar producto existente
 */
router.put('/products/:id', updateProduct);

/**
 * DELETE /admin/products/:id
 * Eliminar producto
 */
router.delete('/products/:id', deleteProduct);

// ==========================================
// GESTIÓN DE IMÁGENES (ADMIN)
// ==========================================

/**
 * POST /admin/products/:id/images/upload
 * Generar URL firmada para subir imagen
 *
 * PASO 1 del flujo de imágenes:
 * - Genera URL firmada temporal
 * - Retorna uploadUrl y publicUrl
 * - Cliente usa uploadUrl para subir archivo a Supabase Storage
 */
router.post('/products/:id/images/upload', generateImageUploadUrl);

/**
 * POST /admin/products/:id/images
 * Agregar imagen a producto
 *
 * PASO 2 del flujo de imágenes:
 * - Registra la imagen en la base de datos
 * - Usa la publicUrl obtenida en el paso 1
 * - Marca como primaria si es necesario
 */
router.post('/products/:id/images', addImageToProduct);

// ==========================================
// GESTIÓN DE INVENTARIO (ADMIN)
// ==========================================

/**
 * PUT /admin/inventory/:productId
 * Actualizar stock e inventario
 */
router.put('/inventory/:productId', updateInventory);

export default router;
