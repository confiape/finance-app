# Finance App

Aplicación de administración de finanzas personales con soporte para importación de archivos Excel e imágenes de estados de cuenta.

## Stack Tecnológico

- **Frontend**: Angular 17+ (PWA)
- **Backend**: Go (Gin framework)
- **Base de datos**: PostgreSQL 16
- **OCR**: Tesseract

## Estructura del Proyecto

```
finance-app/
├── backend/           # API en Go
├── frontend/          # Angular PWA
├── database/          # Migraciones SQL
└── docker-compose.yml # PostgreSQL
```

## Requisitos

- [Go 1.21+](https://golang.org/dl/)
- [Node.js 18+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (para PostgreSQL)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) (para procesamiento de imágenes)

## Instalación

### 1. Clonar e instalar dependencias

```bash
# Backend
cd backend
go mod tidy

# Frontend
cd ../frontend
npm install
```

### 2. Iniciar PostgreSQL

```bash
docker-compose up -d
```

Esto creará la base de datos con las tablas necesarias.

### 3. Instalar Tesseract (para OCR)

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-spa
```

**macOS:**
```bash
brew install tesseract tesseract-lang
```

**Windows:**
Descargar desde: https://github.com/UB-Mannheim/tesseract/wiki

### 4. Configurar variables de entorno (opcional)

El backend usa valores por defecto, pero puedes configurar:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=finance_user
export DB_PASSWORD=finance_pass_2024
export DB_NAME=finance_app
export JWT_SECRET=tu-clave-secreta-aqui
export PORT=8080
```

## Ejecutar

### Backend

```bash
cd backend
go run cmd/api/main.go
```

El API estará disponible en `http://localhost:8080`

### Frontend

```bash
cd frontend
npm start
```

La aplicación estará en `http://localhost:4200`

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Inicio de sesión
- `GET /api/auth/me` - Usuario actual (auth)

### Categorías
- `GET /api/categories` - Listar categorías
- `POST /api/categories` - Crear categoría
- `PUT /api/categories/:id` - Actualizar categoría
- `DELETE /api/categories/:id` - Eliminar categoría

### Transacciones
- `GET /api/transactions` - Listar transacciones (filtros: start_date, end_date, type, category_id)
- `POST /api/transactions` - Crear transacción
- `PUT /api/transactions/:id` - Actualizar transacción
- `DELETE /api/transactions/:id` - Eliminar transacción
- `PATCH /api/transactions/:id/category` - Actualizar categoría de transacción

### Dashboard
- `GET /api/dashboard` - Resumen de finanzas (params: start_date, end_date)

### Importación
- `POST /api/import/upload` - Subir archivo (Excel o imagen)
- `POST /api/import/confirm` - Confirmar importación con categorías
- `GET /api/imports` - Historial de importaciones

## Funcionalidades

1. **Dashboard**: Resumen de ingresos, gastos y balance con gráficos por categoría
2. **Transacciones**: CRUD completo con filtros por tipo, categoría y fecha
3. **Categorías**: Gestión de categorías personalizadas con colores e iconos
4. **Importación**:
   - Excel/CSV: Detecta automáticamente columnas de fecha, descripción y monto
   - Imágenes: OCR para extraer transacciones de estados de cuenta
5. **PWA**: Instalable como app en móviles

## Producción

### Build Frontend
```bash
cd frontend
npm run build
```

### Build Backend
```bash
cd backend
go build -o finance-api cmd/api/main.go
```

## Credenciales por defecto de PostgreSQL

- **Host**: localhost
- **Puerto**: 5432
- **Usuario**: finance_user
- **Contraseña**: finance_pass_2024
- **Base de datos**: finance_app
# finance-app
