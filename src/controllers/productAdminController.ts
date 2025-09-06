// ==========================================
// CONTROLADORES ADMIN PARA PRODUCTOS
// ==========================================

import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { ProductService } from '../services/productService';
import { ImageService } from '../services/imageService';
import { InventoryService } from '../services/inventoryService';
import {
  CreateProductRequest,
  UpdateProductRequest,
  ImageUploadRequest,
  AddImageRequest,
  UpdateInventoryRequest,
} from '../types/catalog';
import { logger } from '../utils/logger';
import {
  isDomainError,
  getHttpStatusCode,
  formatErrorResponse,
} from '../types/errors';

/**
 * @swagger
 * /admin/products:
 *   post:
 *     summary: Crear producto (solo admins)
 *     description: Crea un nuevo producto con inventario inicial
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sku:
 *                 type: string
 *                 description: Código único del producto
 *               name:
 *                 type: string
 *                 description: Nombre del producto
 *               description:
 *                 type: string
 *                 description: Descripción del producto
 *               category_id:
 *                 type: integer
 *                 description: ID de la categoría
 *               retail_price:
 *                 type: number
 *                 description: Precio de venta al público
 *               distributor_price:
 *                 type: number
 *                 description: Precio para distribuidores
 *               active:
 *                 type: boolean
 *                 default: true
 *               initial_stock:
 *                 type: integer
 *                 default: 0
 *               low_stock_threshold:
 *                 type: integer
 *                 default: 5
 *             required:
 *               - sku
 *               - name
 *               - retail_price
 *               - distributor_price
 *     responses:
 *       201:
 *         description: Producto creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Privilegios de administrador requeridos
 *       409:
 *         description: SKU ya existe
 */
export const createProduct = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const productData: CreateProductRequest = req.body;

    // Validaciones básicas
    if (
      !productData.sku ||
      !productData.name ||
      productData.retail_price === undefined ||
      productData.distributor_price === undefined
    ) {
      res.status(400).json({
        error: 'Bad Request',
        message:
          'Missing required fields: sku, name, retail_price, distributor_price',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (productData.retail_price < 0 || productData.distributor_price < 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Prices cannot be negative',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const product = await ProductService.createProduct(productData);

    res.status(201).json({
      message: 'Product created successfully',
      product,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      { adminId: req.user?.id, productId: product.id, sku: product.sku },
      'Admin created product'
    );
  } catch (error: any) {
    logger.error(
      { error: error.message, adminId: req.user?.id, productData: req.body },
      'Error creating product'
    );

    const statusCode = getHttpStatusCode(error);
    const errorResponse = formatErrorResponse(error);

    res.status(statusCode).json(errorResponse);
  }
};

/**
 * @swagger
 * /admin/products/{id}:
 *   put:
 *     summary: Actualizar producto (solo admins)
 *     description: Actualiza los datos de un producto existente
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sku:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category_id:
 *                 type: integer
 *               retail_price:
 *                 type: number
 *               distributor_price:
 *                 type: number
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Producto actualizado exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Producto no encontrado
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const updateProduct = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const productId = parseInt(req.params.id);
    const updates: UpdateProductRequest = req.body;

    if (isNaN(productId)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid product ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Validaciones
    if (updates.retail_price !== undefined && updates.retail_price < 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Retail price cannot be negative',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (
      updates.distributor_price !== undefined &&
      updates.distributor_price < 0
    ) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Distributor price cannot be negative',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const product = await ProductService.updateProduct(productId, updates);

    res.status(200).json({
      message: 'Product updated successfully',
      product,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      { adminId: req.user?.id, productId, updates },
      'Admin updated product'
    );
  } catch (error: any) {
    logger.error(
      { error: error.message, adminId: req.user?.id, productId: req.params.id },
      'Error updating product'
    );

    const statusCode = getHttpStatusCode(error);
    const errorResponse = formatErrorResponse(error);

    res.status(statusCode).json(errorResponse);
  }
};

/**
 * @swagger
 * /admin/products/{id}:
 *   delete:
 *     summary: Eliminar producto (solo admins)
 *     description: Elimina un producto y todos sus datos relacionados
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto
 *     responses:
 *       200:
 *         description: Producto eliminado exitosamente
 *       400:
 *         description: ID inválido
 *       404:
 *         description: Producto no encontrado
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const deleteProduct = async (
  req: AuthRequest,
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

    await ProductService.deleteProduct(productId);

    res.status(200).json({
      message: 'Product deleted successfully',
      timestamp: new Date().toISOString(),
    });

    logger.info({ adminId: req.user?.id, productId }, 'Admin deleted product');
  } catch (error: any) {
    logger.error(
      { error: error.message, adminId: req.user?.id, productId: req.params.id },
      'Error deleting product'
    );

    const statusCode = getHttpStatusCode(error);
    const errorResponse = formatErrorResponse(error);

    res.status(statusCode).json(errorResponse);
  }
};

/**
 * @swagger
 * /admin/products/{id}/images/upload:
 *   post:
 *     summary: Generar URL firmada para subir imagen (solo admins)
 *     description: Genera una URL firmada temporal para subir imagen a Supabase Storage
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *                 description: Nombre del archivo
 *               contentType:
 *                 type: string
 *                 description: Tipo MIME del archivo
 *               is_primary:
 *                 type: boolean
 *                 default: false
 *             required:
 *               - filename
 *               - contentType
 *     responses:
 *       200:
 *         description: URL firmada generada exitosamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const generateImageUploadUrl = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const productId = parseInt(req.params.id);
    const uploadRequest: ImageUploadRequest = req.body;

    if (isNaN(productId)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid product ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!uploadRequest.filename || !uploadRequest.contentType) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: filename, contentType',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verificar que el producto existe
    const product = await ProductService.getProductById(productId);
    if (!product) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Product not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const uploadData = await ImageService.generateUploadUrl(
      productId,
      uploadRequest
    );

    res.status(200).json({
      message: 'Upload URL generated successfully',
      ...uploadData,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      { adminId: req.user?.id, productId, filename: uploadRequest.filename },
      'Admin generated image upload URL'
    );
  } catch (error: any) {
    logger.error(
      { error: error.message, adminId: req.user?.id, productId: req.params.id },
      'Error generating upload URL'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate upload URL',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * @swagger
 * /admin/products/{id}/images:
 *   post:
 *     summary: Agregar imagen a producto (solo admins)
 *     description: Registra una imagen subida en la base de datos
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               publicUrl:
 *                 type: string
 *                 description: URL pública de la imagen subida
 *               is_primary:
 *                 type: boolean
 *                 default: false
 *             required:
 *               - publicUrl
 *     responses:
 *       201:
 *         description: Imagen agregada exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Producto no encontrado
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const addImageToProduct = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const productId = parseInt(req.params.id);
    const imageRequest: AddImageRequest = req.body;

    if (isNaN(productId)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid product ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!imageRequest.publicUrl) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required field: publicUrl',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verificar que el producto existe
    const product = await ProductService.getProductById(productId);
    if (!product) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Product not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const image = await ImageService.addImageToProduct(productId, imageRequest);

    res.status(201).json({
      message: 'Image added to product successfully',
      image,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      {
        adminId: req.user?.id,
        productId,
        imageId: image.id,
        isPrimary: image.is_primary,
      },
      'Admin added image to product'
    );
  } catch (error: any) {
    logger.error(
      { error: error.message, adminId: req.user?.id, productId: req.params.id },
      'Error adding image to product'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to add image to product',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * @swagger
 * /admin/inventory/{productId}:
 *   put:
 *     summary: Actualizar inventario (solo admins)
 *     description: Actualiza el stock y umbral de stock bajo de un producto
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del producto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stock:
 *                 type: integer
 *                 minimum: 0
 *                 description: Nueva cantidad en stock
 *               low_stock_threshold:
 *                 type: integer
 *                 minimum: 0
 *                 description: Nuevo umbral de stock bajo
 *             required:
 *               - stock
 *     responses:
 *       200:
 *         description: Inventario actualizado exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Producto no encontrado
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const updateInventory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const productId = parseInt(req.params.productId);
    const updates: UpdateInventoryRequest = req.body;

    if (isNaN(productId)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid product ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (updates.stock === undefined) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Stock is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (updates.stock < 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Stock cannot be negative',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await InventoryService.updateInventory(productId, updates);

    res.status(200).json({
      message: 'Inventory updated successfully',
      ...result,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      {
        adminId: req.user?.id,
        productId,
        newStock: result.inventory.stock,
        lowStockThreshold: result.inventory.low_stock_threshold,
      },
      'Admin updated inventory'
    );
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        adminId: req.user?.id,
        productId: req.params.productId,
      },
      'Error updating inventory'
    );

    const statusCode = getHttpStatusCode(error);
    const errorResponse = formatErrorResponse(error);

    res.status(statusCode).json(errorResponse);
  }
};
