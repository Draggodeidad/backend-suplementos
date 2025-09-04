// ==========================================
// CONTROLADORES PÚBLICOS PARA PRODUCTOS
// ==========================================

import { Request, Response } from 'express';
import { ProductService } from '../services/productService';
import { CategoryService } from '../services/categoryService';
import { ProductQueryParams } from '../types/catalog';
import { logger } from '../utils/logger';

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Obtener lista de productos (público)
 *     description: Devuelve una lista paginada de productos activos con filtros opcionales
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Productos por página
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *         description: Filtrar por categoría
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar en nombre, descripción o SKU
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, price, created_at]
 *           default: created_at
 *         description: Campo para ordenar
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Dirección del ordenamiento
 *     responses:
 *       200:
 *         description: Lista de productos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *       400:
 *         description: Parámetros de consulta inválidos
 *       500:
 *         description: Error interno del servidor
 */
export const getProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const queryParams: ProductQueryParams = {
      page: req.query.page as string,
      limit: req.query.limit as string,
      category_id: req.query.category_id as string,
      search: req.query.search as string,
      active: 'true', // Solo productos activos en la API pública
      sort: req.query.sort as 'name' | 'price' | 'created_at',
      order: req.query.order as 'asc' | 'desc',
    };

    const result = await ProductService.getProducts(queryParams);

    res.status(200).json({
      message: 'Products retrieved successfully',
      ...result,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      {
        filters: result.filters,
        page: result.pagination.page,
        total: result.pagination.total,
      },
      'Products list retrieved'
    );
  } catch (error: any) {
    logger.error(
      { error: error.message, query: req.query },
      'Error getting products'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve products',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Obtener producto por ID (público)
 *     description: Devuelve los detalles completos de un producto específico
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto
 *     responses:
 *       200:
 *         description: Producto obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: ID de producto inválido
 *       404:
 *         description: Producto no encontrado
 *       500:
 *         description: Error interno del servidor
 */
export const getProductById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid product ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const product = await ProductService.getProductById(productId);

    if (!product) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Product not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Solo mostrar productos activos en la API pública
    if (!product.active) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Product not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      message: 'Product retrieved successfully',
      product,
      timestamp: new Date().toISOString(),
    });

    logger.info({ productId, sku: product.sku }, 'Product detail retrieved');
  } catch (error: any) {
    logger.error(
      { error: error.message, productId: req.params.id },
      'Error getting product'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve product',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Obtener lista de categorías (público)
 *     description: Devuelve todas las categorías disponibles
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Categorías obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 categories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Error interno del servidor
 */
export const getCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const categories = await CategoryService.getAllCategories();

    res.status(200).json({
      message: 'Categories retrieved successfully',
      categories,
      timestamp: new Date().toISOString(),
    });

    logger.info({ count: categories.length }, 'Categories list retrieved');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error getting categories');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve categories',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * @swagger
 * /products/category/{categoryId}:
 *   get:
 *     summary: Obtener productos por categoría (público)
 *     description: Devuelve todos los productos activos de una categoría específica
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la categoría
 *     responses:
 *       200:
 *         description: Productos de la categoría obtenidos exitosamente
 *       400:
 *         description: ID de categoría inválido
 *       404:
 *         description: Categoría no encontrada
 *       500:
 *         description: Error interno del servidor
 */
export const getProductsByCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const categoryId = parseInt(req.params.categoryId);

    if (isNaN(categoryId)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid category ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verificar que la categoría existe
    const category = await CategoryService.getCategoryById(categoryId);
    if (!category) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Category not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const products = await ProductService.getProductsByCategory(categoryId);

    res.status(200).json({
      message: 'Products by category retrieved successfully',
      category,
      products,
      count: products.length,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      {
        categoryId,
        categoryName: category.name,
        productCount: products.length,
      },
      'Products by category retrieved'
    );
  } catch (error: any) {
    logger.error(
      { error: error.message, categoryId: req.params.categoryId },
      'Error getting products by category'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve products by category',
      timestamp: new Date().toISOString(),
    });
  }
};
