import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { CategoryService } from '../services/categoryService';
import { logger } from '../utils/logger';
import { getHttpStatusCode, formatErrorResponse } from '../types/errors';

/**
 * @swagger
 * /admin/categories:
 *   post:
 *     summary: Crear nueva categoría (solo admins)
 *     description: Crea una nueva categoría de productos
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre de la categoría
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: Categoría creada exitosamente
 *       400:
 *         description: Nombre requerido o ya existe
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const createCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Category name is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const category = await CategoryService.createCategory(name.trim());

    res.status(201).json({
      message: 'Category created successfully',
      category,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      { adminId: req.user?.id, categoryId: category.id, name: category.name },
      'Admin created category'
    );
  } catch (error: any) {
    logger.error(
      { error: error.message, adminId: req.user?.id },
      'Error creating category'
    );

    const statusCode = getHttpStatusCode(error);
    const errorResponse = formatErrorResponse(error);

    res.status(statusCode).json(errorResponse);
  }
};

/**
 * @swagger
 * /admin/categories/{id}:
 *   put:
 *     summary: Actualizar categoría (solo admins)
 *     description: Actualiza el nombre de una categoría existente
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la categoría
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nuevo nombre de la categoría
 *             required:
 *               - name
 *     responses:
 *       200:
 *         description: Categoría actualizada exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Categoría no encontrada
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const updateCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const categoryId = parseInt(req.params.id);
    const { name } = req.body;

    if (isNaN(categoryId)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid category ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!name || !name.trim()) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Category name is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verificar que la categoría existe
    const existingCategory = await CategoryService.getCategoryById(categoryId);
    if (!existingCategory) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Category not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updatedCategory = await CategoryService.updateCategory(
      categoryId,
      name.trim()
    );

    res.status(200).json({
      message: 'Category updated successfully',
      category: updatedCategory,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      { adminId: req.user?.id, categoryId, newName: name },
      'Admin updated category'
    );
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        adminId: req.user?.id,
        categoryId: req.params.id,
      },
      'Error updating category'
    );

    const statusCode = getHttpStatusCode(error);
    const errorResponse = formatErrorResponse(error);

    res.status(statusCode).json(errorResponse);
  }
};

/**
 * @swagger
 * /admin/categories/{id}:
 *   delete:
 *     summary: Eliminar categoría (solo admins)
 *     description: Elimina una categoría. Los productos asociados quedarán sin categoría.
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la categoría
 *     responses:
 *       200:
 *         description: Categoría eliminada exitosamente
 *       404:
 *         description: Categoría no encontrada
 *       403:
 *         description: Privilegios de administrador requeridos
 */
export const deleteCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const categoryId = parseInt(req.params.id);

    if (isNaN(categoryId)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid category ID',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verificar que la categoría existe
    const existingCategory = await CategoryService.getCategoryById(categoryId);
    if (!existingCategory) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Category not found',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await CategoryService.deleteCategory(categoryId);

    res.status(200).json({
      message: 'Category deleted successfully',
      timestamp: new Date().toISOString(),
    });

    logger.info(
      {
        adminId: req.user?.id,
        categoryId,
        categoryName: existingCategory.name,
      },
      'Admin deleted category'
    );
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        adminId: req.user?.id,
        categoryId: req.params.id,
      },
      'Error deleting category'
    );

    const statusCode = getHttpStatusCode(error);
    const errorResponse = formatErrorResponse(error);

    res.status(statusCode).json(errorResponse);
  }
};
