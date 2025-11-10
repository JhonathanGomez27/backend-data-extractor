# Implementación de Refresh Token

## Descripción

Se ha implementado un sistema completo de autenticación con **refresh tokens** que permite:

- Generar tokens de acceso de corta duración (1 hora por defecto)
- Generar refresh tokens de larga duración (7 días por defecto)
- Refrescar el access token sin necesidad de re-autenticarse
- Revocar tokens mediante logout

## Cambios Realizados

### 1. Base de Datos
- **UserEntity**: Agregado campo `refreshToken` (nullable) para almacenar el hash del refresh token

### 2. Configuración
- **configuration.ts**: Agregados los parámetros:
  - `jwt.refreshSecret`: Secret para firmar refresh tokens
  - `jwt.refreshExpiresIn`: Tiempo de expiración del refresh token (7d por defecto)

### 3. Variables de Entorno Necesarias

Agregar al archivo `.env`:

```env
# JWT Access Token
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=1h

# JWT Refresh Token
JWT_REFRESH_SECRET=your_refresh_secret_key_here
JWT_REFRESH_EXPIRES_IN=7d
```

### 4. Servicios Actualizados

#### **UsersService**
- `findById(id: string)`: Buscar usuario por ID
- `updateRefreshToken(userId: string, refreshToken: string | null)`: Actualizar/revocar refresh token

#### **AuthService**
- `issueJwt(user)`: Ahora retorna `{ access_token, refresh_token, user }`
- `refreshTokens(userId, refreshToken)`: Valida y genera nuevos tokens
- `logout(userId)`: Revoca el refresh token del usuario

### 5. Nuevos Endpoints

#### **POST /api/auth/login**
Login del administrador - retorna access y refresh token

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

#### **POST /api/auth/refresh**
Obtener nuevos tokens usando el refresh token

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### **POST /api/auth/logout**
Cerrar sesión y revocar refresh token

**Request:**
```
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "message": "Logout successful"
}
```

## Flujo de Autenticación

### 1. Login Inicial
```
Cliente → POST /auth/login
       ← { access_token, refresh_token, user }
```

### 2. Uso del Access Token
```
Cliente → GET /api/admin/clients (Authorization: Bearer access_token)
       ← { data }
```

### 3. Cuando el Access Token Expira
```
Cliente → POST /auth/refresh (body: { refresh_token })
       ← { access_token, refresh_token }
```

### 4. Logout
```
Cliente → POST /auth/logout (Authorization: Bearer access_token)
       ← { message: "Logout successful" }
```

## Seguridad

1. **Refresh tokens hasheados**: Los refresh tokens se almacenan hasheados en la base de datos usando bcrypt
2. **Diferentes secrets**: Access y refresh tokens usan diferentes secrets para mayor seguridad
3. **Rotación de tokens**: Cada vez que se usa un refresh token, se genera uno nuevo
4. **Revocación**: El logout invalida el refresh token almacenado

## Testing con HTTP Files

Actualiza el archivo `test/auth/auth.http`:

```http
### 1. Login
POST {{API_URL}}/api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}

### 2. Copiar los tokens de la respuesta y usarlos aquí:
@ACCESS_TOKEN = paste_access_token_here
@REFRESH_TOKEN = paste_refresh_token_here

### 3. Refresh Token
POST {{API_URL}}/api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "{{REFRESH_TOKEN}}"
}

### 4. Logout
POST {{API_URL}}/api/auth/logout
Authorization: Bearer {{ACCESS_TOKEN}}
```

## Migración de Base de Datos

Después de estos cambios, necesitas ejecutar la migración o sincronización de la base de datos:

```bash
# Si usas TypeORM sync (desarrollo)
# Se sincronizará automáticamente al iniciar la app

# Si usas migraciones (producción)
npm run migration:generate -- -n AddRefreshTokenToUser
npm run migration:run
```

## Estrategia JWT Refresh

Se ha creado `JwtRefreshStrategy` que:
- Extrae el refresh token del body de la petición
- Valida el token usando el `jwt.refreshSecret`
- Pasa el refresh token al request para su validación adicional

## Próximos Pasos Recomendados

1. ✅ Implementar refresh token rotation
2. ⚠️ Agregar rate limiting en el endpoint de refresh
3. ⚠️ Implementar blacklist de tokens revocados (opcional, usando Redis)
4. ⚠️ Agregar logging de eventos de autenticación
5. ⚠️ Implementar refresh token families para detectar token theft
