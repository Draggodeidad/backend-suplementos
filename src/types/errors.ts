// ==========================================
// SISTEMA DE ERRORES DE DOMINIO
// ==========================================

/**
 * Clase base para errores de dominio
 */
export abstract class DomainError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Mantener el stack trace correcto
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error para recursos no encontrados (404)
 */
export class NotFoundError extends DomainError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;

    super(message, 'NOT_FOUND', 404);
  }
}

/**
 * Error para conflictos de recursos (409)
 */
export class ConflictError extends DomainError {
  constructor(resource: string, field: string, value: string) {
    const message = `${resource} with ${field} '${value}' already exists`;
    super(message, 'CONFLICT', 409);
  }
}

/**
 * Error para validación de datos (400)
 */
export class ValidationError extends DomainError {
  constructor(message: string, field?: string) {
    const fullMessage = field ? `${field}: ${message}` : message;
    super(fullMessage, 'VALIDATION_ERROR', 400);
  }
}

/**
 * Error para operaciones no autorizadas (401)
 */
export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/**
 * Error para operaciones prohibidas (403)
 */
export class ForbiddenError extends DomainError {
  constructor(message: string = 'Forbidden operation') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * Error para datos insuficientes (422)
 */
export class InsufficientDataError extends DomainError {
  constructor(resource: string, available: number, requested: number) {
    const message = `Insufficient ${resource}. Available: ${available}, Requested: ${requested}`;
    super(message, 'INSUFFICIENT_DATA', 422);
  }
}

/**
 * Error para operaciones no permitidas (422)
 */
export class BusinessRuleError extends DomainError {
  constructor(message: string) {
    super(message, 'BUSINESS_RULE_VIOLATION', 422);
  }
}

/**
 * Error interno del servidor (500)
 */
export class InternalServerError extends DomainError {
  constructor(message: string = 'Internal server error') {
    super(message, 'INTERNAL_ERROR', 500, false);
  }
}

/**
 * Mapeo de errores a códigos HTTP para respuestas consistentes
 */
export const ERROR_MAPPINGS = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INSUFFICIENT_DATA: 422,
  BUSINESS_RULE_VIOLATION: 422,
  INTERNAL_ERROR: 500,
} as const;

/**
 * Función helper para determinar si un error es de dominio
 */
export function isDomainError(error: any): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Función helper para obtener el código HTTP correcto de un error
 */
export function getHttpStatusCode(error: any): number {
  if (isDomainError(error)) {
    return error.statusCode;
  }

  // Fallback para errores no controlados
  return 500;
}

/**
 * Función helper para formatear respuesta de error consistente
 */
export function formatErrorResponse(error: any) {
  if (isDomainError(error)) {
    return {
      error: error.code,
      message: error.message,
      timestamp: new Date().toISOString(),
    };
  }

  // Para errores no controlados, no exponer detalles internos
  return {
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  };
}
