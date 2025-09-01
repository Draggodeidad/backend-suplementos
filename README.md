# Back Suplementos API

API REST para catálogo de suplementos, carrito, checkout, pagos, órdenes y notificaciones.

## 🚀 Fase 0 - Bootstrap Completada

### ✅ Características Implementadas

- **Node.js + Express + TypeScript** con configuración completa
- **Estructura de proyecto** organizada en capas
- **Health Check** endpoint: `GET /api/v1/health`
- **Documentación API** con Swagger UI en `/api/docs`
- **Middleware de seguridad**: CORS, Helmet, Rate Limiting
- **Logging** con Pino (estructurado y performante)
- **Docker** configurado y listo para producción
- **Linting y Formatting** con ESLint y Prettier

### 📁 Estructura del Proyecto

```
src/
├── config/          # Configuración de la aplicación
├── controllers/     # Controladores de rutas
├── middleware/      # Middleware personalizado
├── routes/          # Definición de rutas
├── services/        # Lógica de negocio (futuras fases)
├── utils/           # Utilidades y helpers
├── db/              # Configuración de base de datos (futuras fases)
└── index.ts         # Punto de entrada de la aplicación
```

### 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor con nodemon

# Producción
npm run build        # Compila TypeScript
npm start           # Inicia servidor compilado

# Calidad de código
npm run lint        # Ejecuta ESLint
npm run lint:fix    # Corrige errores de ESLint
npm run format      # Formatea código con Prettier
npm run format:check # Verifica formato

# Testing
npm test            # Ejecuta tests
npm run test:watch  # Tests en modo watch

# Limpieza
npm run clean       # Elimina directorio dist
```

### 🌐 Endpoints Disponibles

- `GET /` - Información de la API
- `GET /api/v1/health` - Health check
- `GET /api/docs` - Documentación Swagger UI

### 🔧 Variables de Entorno

Copia `.env.example` a `.env` y configura:

```env
PORT=3000
NODE_ENV=development
API_VERSION=v1
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

### 🐳 Docker

```bash
# Construir imagen
docker build -t back-suplementos .

# Ejecutar contenedor
docker run -p 3000:3000 back-suplementos
```

### 📋 Criterios de Aceptación - Fase 0

- ✅ Lint/format CI verde
- ✅ Docker build OK
- ✅ `/health` accesible
- ✅ `/docs` accesible
- ✅ Estructura base implementada
- ✅ Middleware de seguridad configurado
- ✅ Logging estructurado
- ✅ Documentación OpenAPI

### 🗺️ Roadmap

- **Fase 1**: Autenticación y autorización
- **Fase 2**: Catálogo de productos
- **Fase 3**: Carrito de compras
- **Fase 4**: Checkout y pagos
- **Fase 5**: Gestión de órdenes
- **Fase 6**: Sistema de notificaciones

### 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar en desarrollo
npm run dev

# Verificar health check
curl http://localhost:3000/api/v1/health

# Ver documentación
# Abrir http://localhost:3000/api/docs
```

## 📝 Licencia

MIT
