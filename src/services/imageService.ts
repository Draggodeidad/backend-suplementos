// ==========================================
// SERVICIO PARA GESTIÓN DE IMÁGENES
// ==========================================

import { supabaseAdmin } from '../config/supabase';
import {
  ProductImage,
  ImageUploadRequest,
  ImageUploadResponse,
  AddImageRequest,
} from '../types/catalog';
import {
  STORAGE_CONFIG,
  generateProductImagePath,
  isAllowedMimeType,
  isAllowedExtension,
  extractPathFromUrl,
} from '../config/storage';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  ValidationError,
  InternalServerError,
} from '../types/errors';

export class ImageService {
  /**
   * Generar URL firmada para subir imagen
   */
  static async generateUploadUrl(
    productId: number,
    uploadRequest: ImageUploadRequest
  ): Promise<ImageUploadResponse> {
    const { filename, contentType, is_primary = false } = uploadRequest;

    // Validar tipo de archivo
    if (!isAllowedMimeType(contentType)) {
      throw new ValidationError(
        `Content type ${contentType} not allowed`,
        'contentType'
      );
    }

    if (!isAllowedExtension(filename)) {
      throw new ValidationError(
        `File extension not allowed for ${filename}`,
        'filename'
      );
    }

    // Generar path único
    const filePath = generateProductImagePath(productId, filename);

    try {
      // Generar URL firmada para upload
      const { data: uploadData, error: uploadError } =
        await supabaseAdmin.storage
          .from(STORAGE_CONFIG.PRODUCT_IMAGES_BUCKET)
          .createSignedUploadUrl(filePath);

      if (uploadError) {
        logger.error(
          { error: uploadError, productId, filename },
          'Error generating upload URL'
        );
        throw new InternalServerError('Failed to generate upload URL');
      }

      // Generar URL pública
      const { data: publicData } = supabaseAdmin.storage
        .from(STORAGE_CONFIG.PRODUCT_IMAGES_BUCKET)
        .getPublicUrl(filePath);

      const response: ImageUploadResponse = {
        uploadUrl: uploadData.signedUrl,
        publicUrl: publicData.publicUrl,
        filename: filePath,
        expiresIn: STORAGE_CONFIG.UPLOAD_CONFIG.SIGNED_URL_EXPIRES_IN,
      };

      logger.info(
        { productId, filename: filePath },
        'Upload URL generated successfully'
      );

      return response;
    } catch (error: any) {
      logger.error(
        { error: error.message, productId, filename },
        'Error in generateUploadUrl'
      );
      // Si ya es un error de dominio, re-lanzarlo
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new InternalServerError('Failed to generate upload URL');
    }
  }

  /**
   * Agregar imagen a producto (después de subir a Storage)
   */
  static async addImageToProduct(
    productId: number,
    imageRequest: AddImageRequest
  ): Promise<ProductImage> {
    const { publicUrl, is_primary = false } = imageRequest;

    // Validar que la URL es del bucket correcto
    const filePath = extractPathFromUrl(publicUrl);
    if (!filePath) {
      throw new ValidationError('Invalid public URL format', 'publicUrl');
    }

    try {
      // Si es imagen primaria, desmarcar otras imágenes primarias
      if (is_primary) {
        await this.clearPrimaryImages(productId);
      }

      // Insertar registro de imagen
      const { data, error } = await supabaseAdmin
        .from('product_images')
        .insert([
          {
            product_id: productId,
            url: publicUrl,
            is_primary,
          },
        ])
        .select()
        .single();

      if (error) {
        logger.error(
          { error, productId, publicUrl },
          'Error adding image to product'
        );
        throw new InternalServerError('Failed to add image to product');
      }

      logger.info(
        { productId, imageId: data.id, isPrimary: is_primary },
        'Image added to product successfully'
      );

      return data;
    } catch (error: any) {
      logger.error(
        { error: error.message, productId, publicUrl },
        'Error in addImageToProduct'
      );
      // Si ya es un error de dominio, re-lanzarlo
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new InternalServerError('Failed to add image to product');
    }
  }

  /**
   * Obtener imágenes de un producto
   */
  static async getProductImages(productId: number): Promise<ProductImage[]> {
    const { data, error } = await supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('is_primary', { ascending: false })
      .order('id', { ascending: true });

    if (error) {
      logger.error({ error, productId }, 'Error fetching product images');
      throw new InternalServerError('Failed to fetch product images');
    }

    return data || [];
  }

  /**
   * Actualizar imagen (marcar como primaria o secundaria)
   */
  static async updateImage(
    imageId: number,
    updates: Partial<Pick<ProductImage, 'is_primary'>>
  ): Promise<ProductImage> {
    // Si se marca como primaria, obtener el product_id primero
    if (updates.is_primary) {
      const currentImage = await this.getImageById(imageId);
      if (currentImage) {
        await this.clearPrimaryImages(currentImage.product_id);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('product_images')
      .update(updates)
      .eq('id', imageId)
      .select()
      .single();

    if (error) {
      logger.error({ error, imageId, updates }, 'Error updating image');
      throw new InternalServerError('Failed to update image');
    }

    logger.info({ imageId, updates }, 'Image updated successfully');
    return data;
  }

  /**
   * Eliminar imagen
   */
  static async deleteImage(imageId: number): Promise<void> {
    // Obtener información de la imagen
    const image = await this.getImageById(imageId);
    if (!image) {
      throw new NotFoundError('Image', imageId);
    }

    try {
      // Eliminar de Storage
      const filePath = extractPathFromUrl(image.url);
      if (filePath) {
        const { error: storageError } = await supabaseAdmin.storage
          .from(STORAGE_CONFIG.PRODUCT_IMAGES_BUCKET)
          .remove([filePath]);

        if (storageError) {
          logger.warn(
            { error: storageError, filePath },
            'Warning: Could not delete file from storage'
          );
        }
      }

      // Eliminar registro de BD
      const { error } = await supabaseAdmin
        .from('product_images')
        .delete()
        .eq('id', imageId);

      if (error) {
        logger.error({ error, imageId }, 'Error deleting image record');
        throw new InternalServerError('Failed to delete image');
      }

      logger.info(
        { imageId, productId: image.product_id },
        'Image deleted successfully'
      );
    } catch (error: any) {
      logger.error({ error: error.message, imageId }, 'Error in deleteImage');
      // Si ya es un error de dominio, re-lanzarlo
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError('Failed to delete image');
    }
  }

  /**
   * Limpiar todas las imágenes primarias de un producto
   */
  private static async clearPrimaryImages(productId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('product_images')
      .update({ is_primary: false })
      .eq('product_id', productId)
      .eq('is_primary', true);

    if (error) {
      logger.error({ error, productId }, 'Error clearing primary images');
      throw new InternalServerError('Failed to clear primary images');
    }
  }

  /**
   * Obtener imagen por ID
   */
  private static async getImageById(
    imageId: number
  ): Promise<ProductImage | null> {
    const { data, error } = await supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .maybeSingle();

    if (error) {
      logger.error({ error, imageId }, 'Error fetching image by ID');
      throw new InternalServerError('Failed to fetch image');
    }

    return data;
  }

  /**
   * Eliminar todas las imágenes de un producto
   */
  static async deleteAllProductImages(productId: number): Promise<void> {
    const images = await this.getProductImages(productId);

    // Eliminar archivos de Storage
    const filePaths = images
      .map((img) => extractPathFromUrl(img.url))
      .filter((path) => path !== null) as string[];

    if (filePaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(STORAGE_CONFIG.PRODUCT_IMAGES_BUCKET)
        .remove(filePaths);

      if (storageError) {
        logger.warn(
          { error: storageError, productId, fileCount: filePaths.length },
          'Warning: Could not delete some files from storage'
        );
      }
    }

    // Eliminar registros de BD
    const { error } = await supabaseAdmin
      .from('product_images')
      .delete()
      .eq('product_id', productId);

    if (error) {
      logger.error({ error, productId }, 'Error deleting product images');
      throw new InternalServerError('Failed to delete product images');
    }

    logger.info(
      { productId, deletedCount: images.length },
      'All product images deleted successfully'
    );
  }
}
