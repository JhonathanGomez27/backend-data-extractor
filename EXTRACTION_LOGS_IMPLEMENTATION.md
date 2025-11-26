# Sistema de Logs para Extracción de Modelos

## 📋 Descripción

Se ha implementado un sistema completo de logging para el endpoint `POST /api/models/client/extract` que registra cada operación de extracción en la base de datos.

## 🗂️ Archivos Creados

### 1. **Entidad de Logs**
- `src/extraction-logs/extraction-log.entity.ts`
  - Almacena información detallada de cada extracción
  - Campos: `id`, `clientId`, `modelsUsed`, `transcriptionSize`, `durationMs`, `status`, `errorMessage`, `metadata`, `createdAt`

### 2. **Servicio de Logs**
- `src/extraction-logs/extraction-logs.service.ts`
  - `createLog()`: Crea un nuevo registro de log
  - `findByClient()`: Obtiene logs por cliente
  - `getStats()`: Calcula estadísticas de uso

### 3. **Módulo de Logs**
- `src/extraction-logs/extraction-logs.module.ts`
  - Exporta el servicio para ser usado en otros módulos

### 4. **Controlador de Logs** (Opcional)
- `src/extraction-logs/extraction-logs.controller.ts`
  - Endpoints para consultar logs y estadísticas
  - Protegido con JWT (admin) y Basic Auth (client)

### 5. **Archivo de Pruebas HTTP**
- `test/extraction-logs/extraction-logs.http`
  - Ejemplos de peticiones para consultar logs

## 🔧 Archivos Modificados

### 1. **ModelsService**
- `src/models/models.service.ts`
  - Añadido `Logger` de NestJS
  - Inyectado `ExtractionLogsService`
  - Método `extractModelForClient()` actualizado con:
    - Logs de inicio y fin
    - Medición de tiempo de ejecución
    - Cálculo de tamaño de transcripción
    - Manejo de errores con logging
    - Guardado automático en BD (éxito o error)

### 2. **ModelsModule**
- `src/models/models.module.ts`
  - Importado `ExtractionLogsModule`

### 3. **AppModule**
- `src/app.module.ts`
  - Registrado `ExtractionLogsModule` globalmente

## 📊 Información Registrada

### Logs Exitosos
```json
{
  "clientId": "uuid",
  "modelsUsed": [
    {
      "id": "model-uuid",
      "name": "Model Name",
      "description": "Model description"
    }
  ],
  "transcriptionSize": 1234,
  "durationMs": 567,
  "status": "success",
  "metadata": {
    "modelCount": 3,
    "responseKeys": ["sentiment", "entities"]
  },
  "createdAt": "2025-11-24T..."
}
```

### Logs de Error
```json
{
  "clientId": "uuid",
  "modelsUsed": [...],
  "transcriptionSize": 1234,
  "durationMs": 123,
  "status": "error",
  "errorMessage": "Error description",
  "metadata": {
    "errorStack": "...",
    "errorName": "NotFoundException"
  },
  "createdAt": "2025-11-24T..."
}
```

## 🚀 Endpoints Disponibles

### Admin Endpoints (JWT)
```http
GET /api/extraction-logs/admin?clientId={uuid}&limit=50
GET /api/extraction-logs/admin/stats?clientId={uuid}
```

### Client Endpoints (Basic Auth)
```http
GET /api/extraction-logs/client/logs?limit=20
GET /api/extraction-logs/client/stats
```

## 📈 Estadísticas Disponibles

```typescript
{
  totalExtractions: number,
  successCount: number,
  errorCount: number,
  avgDurationMs: number
}
```

## 💡 Logs en Consola

El sistema también registra logs en consola con diferentes niveles:

- **LOG**: Inicio y fin exitoso de extracción
- **DEBUG**: Procesamiento de cada modelo individual
- **ERROR**: Errores con stack trace completo
- **WARN**: Advertencias durante el proceso

### Ejemplos de Logs en Consola:
```
[ModelsService] Starting extraction for client: abc-123
[ModelsService] Found 3 active models for client abc-123
[ModelsService] Processing model: Sentiment Analysis (model-uuid-1)
[ModelsService] Processing model: Entity Detection (model-uuid-2)
[ModelsService] Extraction completed successfully for client abc-123 in 2345ms
```

## 🔍 Casos de Uso

### 1. **Monitoreo de Rendimiento**
- Ver tiempo promedio de extracción
- Identificar extracciones lentas
- Detectar patrones de uso

### 2. **Debugging**
- Ver errores históricos
- Analizar qué modelos fallaron
- Revisar tamaño de transcripciones problemáticas

### 3. **Auditoría**
- Rastrear uso por cliente
- Verificar qué modelos se utilizaron
- Análisis de frecuencia de uso

### 4. **Facturación/Métricas**
- Contar extracciones por cliente
- Calcular uso de recursos
- Generar reportes de actividad

## 🔐 Seguridad

- Los logs de admin requieren autenticación JWT
- Los logs de cliente requieren Basic Auth
- Cada cliente solo puede ver sus propios logs
- Stack traces solo se guardan en metadata (no se exponen por defecto)

## 🗄️ Migración de Base de Datos

Después de estos cambios, TypeORM creará automáticamente la tabla `extraction_logs` con la siguiente estructura:

```sql
CREATE TABLE extraction_logs (
  id UUID PRIMARY KEY,
  clientId UUID NOT NULL,
  modelsUsed JSONB,
  transcriptionSize INT,
  durationMs INT,
  status VARCHAR(50) DEFAULT 'success',
  errorMessage TEXT,
  metadata JSONB,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clientId) REFERENCES clients(id)
);
```

## 🎯 Próximos Pasos Recomendados

1. ✅ Implementar limpieza automática de logs antiguos (>90 días)
2. ✅ Agregar índices en la BD para mejorar consultas
3. ✅ Crear dashboard de visualización de estadísticas
4. ✅ Implementar alertas para extracciones fallidas
5. ✅ Agregar exportación de logs a CSV/Excel
6. ✅ Implementar paginación en consulta de logs

## 📝 Notas Importantes

- Los logs se guardan **de forma asíncrona** para no bloquear la respuesta
- Si falla el guardado del log, **no afecta** la operación de extracción
- Los errores en el logging se registran en consola pero no lanzan excepciones
- El campo `metadata` permite extender la información sin modificar el schema
