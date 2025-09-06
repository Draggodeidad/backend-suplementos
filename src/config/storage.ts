// ==========================================
// CONFIGURACIÓN DE SUPABASE STORAGE
// ==========================================

import { logger } from '../utils/logger';

export const STORAGE_CONFIG = {
  // Bucket para imágenes de productos
  PRODUCT_IMAGES_BUCKET: 'product-images',

  // Configuración de upload
  UPLOAD_CONFIG: {
    // Tiempo de expiración para URLs firmadas (1 hora)
    SIGNED_URL_EXPIRES_IN: 3600,

    // Tamaño máximo de archivo (5MB)
    MAX_FILE_SIZE: 5 * 1024 * 1024,

    // Tipos de archivo permitidos
    ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

    // Extensiones permitidas
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  },

  // Configuración de directorios
  DIRECTORIES: {
    // Directorio base para productos
    PRODUCTS: 'products',

    // Directorio temporal para uploads
    TEMP: 'temp',
  },
} as const;

/**
 * Valida si un tipo MIME está permitido
 */
export const isAllowedMimeType = (mimeType: string): boolean => {
  return STORAGE_CONFIG.UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(
    mimeType as any
  );
};

/**
 * Valida si una extensión de archivo está permitida
 */
export const isAllowedExtension = (filename: string): boolean => {
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!extension) return false;

  return STORAGE_CONFIG.UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(
    extension as any
  );
};

/**
 * Genera un nombre de archivo único para un producto
 */
export const generateProductImagePath = (
  productId: number,
  originalFilename: string
): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension =
    originalFilename.toLowerCase().match(/\.[^.]+$/)?.[0] || '.jpg';

  return `${STORAGE_CONFIG.DIRECTORIES.PRODUCTS}/${productId}/${timestamp}_${randomString}${extension}`;
};

/**
 * Extrae el path público desde una URL completa de Supabase
 */
export const extractPathFromUrl = (publicUrl: string): string | null => {
  try {
    const url = new URL(publicUrl);
    const pathMatch = url.pathname.match(
      /\/object\/public\/product-images\/(.+)$/
    );
    return pathMatch ? pathMatch[1] : null;
  } catch (error) {
    logger.error({ error, publicUrl }, 'Error extracting path from URL');
    return null;
  }
};

/**
 * Valida el tamaño de archivo basado en Content-Length
 */
export const validateFileSize = (contentLength: number): boolean => {
  return contentLength <= STORAGE_CONFIG.UPLOAD_CONFIG.MAX_FILE_SIZE;
};

/**
 * Obtiene la URL pública para un archivo en el bucket
 */
export const getPublicUrl = (filePath: string): string => {
  // Validar que filePath sea una cadena no vacía
  if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('filePath must be a non-empty string');
  }

  // Validar que el bucket esté definido
  if (!STORAGE_CONFIG.PRODUCT_IMAGES_BUCKET) {
    throw new Error('PRODUCT_IMAGES_BUCKET is not defined in storage config');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required');
  }

  // Normalizar URL base (remover barras al final)
  const baseUrl = supabaseUrl.replace(/\/+$/, '');

  // Normalizar ruta del archivo (remover barras al inicio y espacios)
  const normalizedPath = filePath.trim().replace(/^\/+/, '');

  // Validar que la ruta normalizada no esté vacía
  if (!normalizedPath) {
    throw new Error('filePath cannot be empty after normalization');
  }

  return `${baseUrl}/storage/v1/object/public/${STORAGE_CONFIG.PRODUCT_IMAGES_BUCKET}/${normalizedPath}`;
};

/**
 * Configuración de CORS para el bucket
 */
export const BUCKET_CORS_CONFIG = {
  allowedOrigins: ['*'],
  allowedMethods: ['GET', 'PUT', 'POST'],
  allowedHeaders: ['*'],
  maxAgeSeconds: 3600,
} as const;
