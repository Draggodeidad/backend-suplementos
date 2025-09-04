import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Back Suplementos API',
      version: config.apiVersion,
      description:
        'API REST para catálogo de suplementos, carrito, checkout, pagos, órdenes y notificaciones',
      contact: {
        name: 'API Support',
        email: 'support@suplementos.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}${config.apiPrefix}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            uptime: {
              type: 'number',
              description: 'Server uptime in seconds',
            },
            environment: {
              type: 'string',
              example: 'development',
            },
            version: {
              type: 'string',
              example: 'v1',
            },
            service: {
              type: 'string',
              example: 'back-suplementos',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
            },
            message: {
              type: 'string',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'Proteínas',
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            sku: {
              type: 'string',
              example: 'PROT-001',
            },
            name: {
              type: 'string',
              example: 'Proteína Whey Premium',
            },
            description: {
              type: 'string',
              nullable: true,
              example: 'Proteína de suero de alta calidad',
            },
            category_id: {
              type: 'integer',
              nullable: true,
              example: 1,
            },
            retail_price: {
              type: 'number',
              format: 'float',
              example: 899.99,
            },
            distributor_price: {
              type: 'number',
              format: 'float',
              example: 699.99,
            },
            active: {
              type: 'boolean',
              example: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
            category: {
              $ref: '#/components/schemas/Category',
            },
            images: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ProductImage',
              },
            },
            inventory: {
              $ref: '#/components/schemas/Inventory',
            },
          },
        },
        ProductImage: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            product_id: {
              type: 'integer',
              example: 1,
            },
            url: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/image.jpg',
            },
            is_primary: {
              type: 'boolean',
              example: true,
            },
          },
        },
        Inventory: {
          type: 'object',
          properties: {
            product_id: {
              type: 'integer',
              example: 1,
            },
            stock: {
              type: 'integer',
              example: 50,
            },
            low_stock_threshold: {
              type: 'integer',
              example: 10,
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Authentication',
        description: 'Authentication and user profile endpoints',
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints',
      },
      {
        name: 'Products',
        description: 'Product catalog endpoints (public)',
      },
      {
        name: 'Categories',
        description: 'Product categories endpoints',
      },
      {
        name: 'Inventory',
        description: 'Product inventory management (admin)',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // paths to files containing OpenAPI definitions
};

export const swaggerSpec = swaggerJsdoc(options);
