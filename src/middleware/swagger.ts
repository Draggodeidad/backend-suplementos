import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger';

export const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Back Suplementos API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  },
};

export const swaggerUiHandler = swaggerUi.setup(swaggerSpec, swaggerOptions);
