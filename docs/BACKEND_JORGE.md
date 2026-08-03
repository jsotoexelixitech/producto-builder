# Products Builder — Guía completa Backend (Jorge Durán)

**Para:** Jorge Durán — [JorgeDuranAlcala/product-builder](https://github.com/JorgeDuranAlcala/product-builder)  
**De:** Javier / Exelixi Tech — [jsotoexelixitech/products-builder](https://github.com/jsotoexelixitech/products-builder)  
**Versión:** 0.2.0 · Julio 2026  

**Documento único** para ajustar el backend: setup, auth, **ajustes obligatorios**, checklist, contrato API completo y cambios del frontend.

---

## Tabla de contenidos

**Parte A — Handoff**
- [A.1 Resumen](#a1-resumen)
- [A.2 Setup local](#a2-setup-local)
- [A.3 Autenticación JWT](#a3-autenticación-jwt)
- [A.4 Endpoints requeridos (checklist)](#a4-endpoints-requeridos-checklist)
- [A.5 Ajustes obligatorios del backend](#a5-ajustes-obligatorios-del-backend)
- [A.6 Cambios recientes del frontend (UI)](#a6-cambios-recientes-del-frontend-ui)
- [A.7 Cómo probar integración](#a7-cómo-probar-integración)
- [A.8 Recursos en el repo frontend](#a8-recursos-en-el-repo-frontend)
- [A.9 Pendientes / fuera de scope](#a9-pendientes--fuera-de-scope)

**Parte B — Contrato API**
- [B.1 Convenciones generales](#b1-convenciones-generales)
- [B.2 Enums y constantes](#b2-enums-y-constantes)
- [B.3 Mapa wizard → endpoints](#b3-mapa-wizard--endpoints)
- [B.4 Productos](#b4-productos)
- [B.5 Coberturas](#b5-coberturas)
- [B.6 Planes comerciales](#b6-planes-comerciales)
- [B.7 Actuarial](#b7-actuarial)
- [B.8 Legal](#b8-legal)
- [B.9 Flujo de emisión](#b9-flujo-de-emisión)
- [B.10 Workflow / Activación](#b10-workflow--activación)
- [B.11 SISIP (opcional)](#b11-sisip-opcional)
- [B.12 Objeto Product completo](#b12-objeto-product-completo)
- [B.13 Errores](#b13-errores)
- [B.14 Reglas de negocio transversales](#b14-reglas-de-negocio-transversales)
- [B.15 Referencias en el código](#b15-referencias-en-el-código)
- [B.16 Checklist final de integración](#b16-checklist-final-de-integración)

---

# Parte A — Handoff

## A.1 Resumen

El **frontend del wizard está listo** (React + Vite, 7 pasos). Incluye **login JWT** y envía `Authorization: Bearer` en todas las llamadas a `/api/products/*`.

Tu backend debe:
1. Correr en **`http://localhost:3001`** (prefijo `/api`).
2. Implementar los endpoints de la **Parte B** tal cual.
3. Exigir JWT en rutas de productos (excepto auth pública).

Si el contrato se cumple, la integración funciona **sin cambios en el UI**.

---

## A.2 Setup local

```bash
git clone https://github.com/JorgeDuranAlcala/product-builder.git
cd product-builder
git switch main
npm install

# .env
# DATABASE_URL=postgresql://...
# PORT=3001
# JWT_SECRET=...
# FRONTEND_URL=http://localhost:5173

npx prisma db push --accept-data-loss   # solo si migras schema nuevo
npm run prisma:seed
npm run start:dev
```

| Recurso | URL |
|---------|-----|
| API | `http://localhost:3001/api` |
| Swagger | `http://localhost:3001/api/docs` |
| Health | `GET /api/health` |
| Frontend (Javier) | `http://localhost:5173` |

**Credenciales seed (desarrollo):**
- Email: `admin@local.test`
- Password: `admin123`

**Importante:** el puerto **3001** debe estar libre. Si corre otro backend en ese puerto, Nest fallará con `EADDRINUSE`.

---

## A.3 Autenticación JWT

El frontend ya implementa login en `/login`. **Todas las rutas `/api/products/*` exigen Bearer token.**

| Método | Ruta | Auth | Uso |
|--------|------|------|-----|
| POST | `/api/auth/login` | Pública | Login |
| POST | `/api/auth/signup` | Pública | Registro (opcional) |
| GET | `/api/auth/me` | Bearer | Usuario actual |
| GET/POST/PUT/PATCH/DELETE | `/api/products/*` | Bearer | Wizard |

**Request login:**
```json
{ "email": "admin@local.test", "password": "admin123" }
```

**Response login:**
```json
{
  "accessToken": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "admin@local.test",
    "fullName": "Administrador",
    "role": "ADMIN"
  }
}
```

**401** → el front redirige a `/login` y limpia sesión.

**CORS:** origen `http://localhost:5173`, métodos `GET,POST,PUT,PATCH,DELETE,OPTIONS`, header `Authorization`.

---

## A.4 Endpoints requeridos (checklist)

Marca probando con el front o el script de integración:

- [ ] `POST /api/auth/login`
- [ ] `GET /api/auth/me`
- [ ] `GET /api/products` — listado dashboard
- [ ] `POST /api/products` — crear (`status: DRAFT`, UUID)
- [ ] `PATCH /api/products/:id`
- [ ] `GET /api/products/:id` — producto **completo** con relaciones
- [ ] `PUT /api/products/:id/coverages` — devuelve `id`; persiste **`insuredSumMin`**
- [ ] `GET /api/products/:id/plans`
- [ ] `PUT /api/products/:id/plans` — `priceFactor` = suma primas; `description` con `__INACTIVE__`
- [ ] `PUT /api/products/:id/actuarial` — calcula `commercialPremium`; **`ratingVariables` nunca `null`**
- [ ] `PUT /api/products/:id/legal`
- [ ] `GET /api/products/:id/emission-config` — defaults por ramo si vacío
- [ ] `PUT /api/products/:id/emission-config`
- [ ] `GET /api/products/:id/workflow/validate-submission`
- [ ] `POST /api/products/:id/workflow/transition`
- [ ] `POST /api/products/:id/workflow/approve` (opcional en UI)
- [ ] `GET /api/health`

**Opcional:** `GET/PUT /api/products/:id/sisip`

---

## A.5 Ajustes obligatorios del backend

Implementa esto **antes** de probar el wizard completo. Detalle ampliado en [B.5 Coberturas](#b5-coberturas), [B.6 Planes](#b6-planes-comerciales) y [B.7 Actuarial](#b7-actuarial).

### A.5.1 Bloqueante: `ratingVariables` (actuarial)

**Síntoma en el front:** `ratingVariables: Expected array, received null` al guardar paso Actuarial.

| Acción | Regla |
|--------|--------|
| **PUT** `/api/products/:id/actuarial` | `ratingVariables` es **array** (vacío `[]` válido). Si falta en el body → `[]`. **Nunca** `null`. |
| **GET** `/api/products/:id` | `actuarialData.ratingVariables` siempre **array** (`[]` si no hay filas). |
| **Respuesta PUT** | Igual: mínimo `ratingVariables: []`. |

```json
{
  "purePremium": 100,
  "administrativeExpenses": 10,
  "commissions": 8,
  "profitMargin": 5,
  "actuaryName": "María González",
  "actuaryCedula": "V-12345678",
  "actuarySudeasegNumber": "ACT-2024-001",
  "ratingVariables": []
}
```

NestJS sugerido: en el DTO `@Transform(({ value }) => value ?? [])` o `ratingVariables = dto.ratingVariables ?? []`.

### A.5.2 Coberturas: `insuredSumMin`

El wizard envía **suma asegurada mínima** además de la suma fija:

```json
{
  "coverages": [{
    "name": "Cobertura 1",
    "insuredSumMin": 500,
    "insuredSumFixed": 1000,
    "tariffPremium": 1,
    "isBasicMandatory": true,
    "waitingPeriodDays": 0
  }]
}
```

Persistir y devolver `insuredSumMin` en PUT/GET.

### A.5.3 Planes comerciales

**`priceFactor`:** el front envía la **suma de primas** del plan (no multiplicador × prima actuarial). Persistir el número tal cual.

**Plan inactivo (convención hasta tener campo en BD):**

| Estado | Campo `description` |
|--------|---------------------|
| Activo | Texto normal o vacío |
| Inactivo | Prefijo `__INACTIVE__` + texto opcional |

Ejemplo: `"__INACTIVE__Plan solo interno"`. Devolver `description` sin alterar en GET.

**Futuro (opcional):** JSON `coverageTariffs: { "uuid-cobertura": 12.5 }` por plan para tarifas distintas por cobertura (hoy el front solo persiste la suma en `priceFactor`).

### A.5.4 Cédula del actuario

El front valida formato **`V-12345678`** (V, E, J, G o P + guion + 6–9 dígitos). El backend puede aceptar string 5–20 chars; alinear regex es opcional.

### A.5.5 Checklist de ajustes

- [ ] Actuarial: `ratingVariables` nunca `null` en GET/PUT
- [ ] Coberturas: `insuredSumMin` persistido
- [ ] Planes: `description` con `__INACTIVE__` para inactivos
- [ ] Planes: `priceFactor` como suma de primas
- [ ] Legal: claves custom en `requiredDocuments` (`^[A-Z0-9_-]+$`)
- [ ] JWT + CORS + wizard 7 pasos sin error 400 inesperado

---

## A.6 Cambios recientes del frontend (UI)

Comportamiento del SPA (no siempre implica cambio de API):

### Planes — formulario + tabla

Mismo payload `PUT /plans`; el UI agrupa planes en tabla con activar/desactivar.

### Coberturas — formulario + tabla

Mismo `PUT /coverages`; crítico devolver **`id` UUID** por cobertura.

### Documentos requeridos — claves personalizadas

```json
{ "documentKey": "CARTA_SOLVENCIA", "label": "Carta de solvencia", "required": true, "sortOrder": 0 }
```

### Paso 7 — Activación

Botón **"Activar producto"** → `POST /workflow/transition` con `toStatus: "SUBMITTED_TO_SUDEASEG"`.

### Actuarial — validaciones en front

Actuario ≥3 chars; cédula con formato V-/E-/etc.; SUDEASEG `^[A-Z0-9-]+$`.

### Flujo de emisión — pestañas (solo UI)

Configuración por tabs; el payload de `PUT /emission-config` no cambia.

---

## A.7 Cómo probar integración

**Terminal 1 — Backend (Jorge):**
```bash
cd product-builder && npm run start:dev
```

**Terminal 2 — Frontend (repo Javier):**
```bash
git clone https://github.com/jsotoexelixitech/products-builder.git
cd products-builder && npm install && npm run dev -w frontend
```

1. Abrir `http://localhost:5173/login`
2. Login: `admin@local.test` / `admin123`
3. Crear producto → recorrer 7 pasos → guardar en cada uno
4. Verificar dashboard y recarga de datos

**Proxy Vite:** `/api` → `http://localhost:3001`

---

## A.8 Recursos en el repo frontend

| Recurso | Ubicación en `products-builder` |
|---------|-----------------------------------|
| Cliente HTTP + auth | `frontend/src/lib/api.ts` |
| Payloads wizard | `frontend/src/pages/ProductWizardPage.tsx` |
| Tipos | `frontend/src/types/product.ts` |
| Schemas Zod | `packages/shared/src/schemas/` |
| Guardrails SUDEASEG | `packages/shared/src/validators/submission-guardrails.ts` |
| Modelo Prisma (referencia) | `backend/prisma/schema.prisma` |
| Implementación Nest (referencia) | `backend/src/` |

**Variables de entorno backend:**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/insurance_product_builder?schema=public
PORT=3001
JWT_SECRET=tu-secreto
FRONTEND_URL=http://localhost:5173
```

**PostgreSQL:** `docker compose up -d` en el repo frontend (referencia).

---

## A.9 Pendientes / fuera de scope

| Tema | Estado |
|------|--------|
| Auth JWT en productos | ✅ Requerido |
| 13+ endpoints wizard | ✅ En tu `main` |
| Formas de pago configurables | ❌ Futuro (paso PAYMENT sin métodos) |
| API runtime para terceros | ❌ Futuro |
| SISIP | Opcional, wizard no lo usa hoy |

**Flujo de trabajo:** cualquier desvío del contrato → issue con request/response de ejemplo.

---

# Parte B — Contrato API

## B1. Convenciones generales

| Concepto | Valor |
|----------|-------|
| Base URL (dev) | `http://localhost:3001/api` |
| Prefijo global | `/api` |
| Content-Type | `application/json` |
| CORS (dev) | Origen `http://localhost:5173` |
| Proxy Vite (dev) | `/api` → `http://localhost:3001` |
| IDs | UUID v4 |
| Fechas en request | `YYYY-MM-DD` o ISO 8601; el front a veces envía `null` |
| Decimales en response | Números JSON (Prisma Decimal serializado) |
| Autenticación | JWT Bearer en `/api/products/*` (ver [A.3](#a3-autenticación-jwt)) |

**Cliente HTTP del frontend:** `frontend/src/lib/api.ts`

**Patrón de escritura:** casi todos los módulos (coberturas, legal, planes, emisión) hacen **reemplazo total** del recurso hijo al guardar (`DELETE` implícito + `CREATE`).

**Inmutabilidad:** cuando `isImmutable === true` o `status` es `SUBMITTED_TO_SUDEASEG` / `APPROVED_ACTIVE`, los endpoints mutables deben responder **403 Forbidden** con mensaje legible.

---

## B2. Enums y constantes

### ProductBranch
```
AUTOMOVIL | SALUD | VIDA | PATRIMONIAL | INCLUSIVO | RCV_OBLIGATORIO
```

### ContractCurrency
```
VES | USD | INDEXADO
```

### EmissionType
```
EMISION_GARANTIZADA | REQUIERE_DECLARACION_SALUD | REQUIERE_INSPECCION
```

### ProductStatus
```
DRAFT | ACTUARIAL_REVIEW | SUBMITTED_TO_SUDEASEG | APPROVED_ACTIVE | REJECTED
```

### RenewalFrequency
```
ANUAL | SEMESTRAL | TRIMESTRAL | MENSUAL
```

### RenewalType
```
NORMAL | TACITA | CON_AVISO
```

### DeductibleType
```
MONTO_FIJO | PORCENTAJE_SINIESTRO | PORCENTAJE_SUMA_ASEGURADA
```

### DocumentType (legal)
```
CONDICIONES_GENERALES | CONDICIONES_PARTICULARES | NOTA_TECNICA_ACTUARIAL | POLIZA | CUADRO_RECIBO
```

### FormFieldType
```
TEXT | NUMBER | SELECT | DATE | BOOLEAN
```

### Flow stepKey (emisión)
```
CLIENT_DATA | RISK_DATA | PLANS_COVERAGES | DOCUMENTS_OCR | DIGITAL_SIGNATURE |
AI_INSPECTION | TECHNICAL_APPROVAL | PAYMENT | FINISHED
```

Solo `CLIENT_DATA` y `RISK_DATA` admiten formulario personalizado (`formEnabled`).

### documentKey (recaudos OCR — catálogo usado por el front)

```
CEDULA | RIF | LICENCIA_CONDUCIR | CARNET_CIRCULACION | CERTIFICADO_ORIGEN |
FOTOS_VEHICULO | PARTIDA_NACIMIENTO | ACTA_MATRIMONIO | INFORME_MEDICO |
CONSTANCIA_TRABAJO | COMPROBANTE_DOMICILIO | CONTRATO_SERVICIO_FUNERARIO
```

El front precarga documentos por ramo (`DEFAULT_DOCUMENTS_BY_BRANCH` en `frontend/src/lib/constants.ts`).

---

## B3. Mapa wizard → endpoints

| Paso UI | Nombre | Al guardar (PUT/POST/PATCH) | Al cargar (GET) |
|---------|--------|----------------------------|-----------------|
| 0 | Datos del producto | `POST /products` o `PATCH /products/:id` | `GET /products/:id` |
| 1 | Coberturas | `PUT /products/:id/coverages` | `GET /products/:id` |
| 2 | Planes comerciales | `PUT /products/:id/plans` | `GET /products/:id/plans` + `GET /products/:id` |
| 3 | Actuarial | `PUT /products/:id/actuarial` | `GET /products/:id` |
| 4 | Legal | `PUT /products/:id/legal` | `GET /products/:id` |
| 5 | Flujo de emisión | `PUT /products/:id/emission-config` | `GET /products/:id/emission-config` |
| 6 | Activación | `GET .../validate-submission` + `POST .../transition` | `GET /products/:id` |

**Dashboard:** `GET /products`  
**Vista previa flujo:** `GET /products/:id`

---

## B4. Productos

### B4.1 Listar productos

```
GET /products
```

**Request:** sin body.

**Response:** `200` — array de productos (resumen).

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "commercialName": "RCV Obligatorio Demo",
    "internalCode": "RCV-DEMO-001",
    "branch": "RCV_OBLIGATORIO",
    "currency": "VES",
    "emissionType": "EMISION_GARANTIZADA",
    "status": "DRAFT",
    "simplifiedContract": true,
    "uniformConditions": true,
    "lockedGeneralConditions": true,
    "isImmutable": false,
    "subPlanCode": null,
    "vigenciaInicio": null,
    "vigenciaFin": null,
    "allowsQuickEmission": false,
    "renewalFrequency": "ANUAL",
    "renewalType": "NORMAL",
    "premiumGuaranteeDays": 30,
    "annualClosingMonth": 12,
    "createdAt": "2026-07-18T12:00:00.000Z",
    "updatedAt": "2026-07-18T12:00:00.000Z",
    "coverages": [ { "id": "...", "name": "...", "isBasicMandatory": true } ],
    "actuarialData": { "commercialPremium": 163.64, "purePremium": 120 },
    "sisipConfig": null,
    "_count": { "exclusions": 1, "stateHistory": 1 }
  }
]
```

---

### B4.2 Obtener producto completo

```
GET /products/:id
```

**Request:** sin body.

**Response:** `200` — objeto `Product` completo (ver [B.12](#b12-objeto-product-completo)).

**Errores:** `404` si no existe.

---

### B4.3 Crear producto (wizard paso 0 — primera vez)

```
POST /products
```

**Cuándo:** usuario nuevo en `/products/new`, guarda paso 0 sin `productId`.

**Body exacto que envía el frontend:**

```json
{
  "commercialName": "Nuevo producto",
  "internalCode": "PROD-K7X2AB",
  "branch": "PATRIMONIAL",
  "currency": "VES",
  "emissionType": "EMISION_GARANTIZADA",
  "subPlanCode": "",
  "vigenciaInicio": null,
  "vigenciaFin": null,
  "allowsQuickEmission": false,
  "renewalFrequency": "ANUAL",
  "renewalType": "NORMAL",
  "premiumGuaranteeDays": 30,
  "annualClosingMonth": 12
}
```

**Notas del frontend:**
- `commercialName` se normaliza (trim, espacios colapsados), mín. 3 caracteres.
- `internalCode` se normaliza a `A-Z0-9_-`, máx. 50 chars, único en BD.
- `subPlanCode` vacío se envía como `""` en create; en update como `null`.
- **`vigenciaInicio` y `vigenciaFin` siempre se envían como `null`** en el flujo actual del wizard (aunque el formulario tenga fechas por defecto).

**Validaciones backend (Zod: `createProductSchema`):**

| Campo | Regla |
|-------|-------|
| commercialName | string, 3–200 |
| internalCode | string, 2–50, regex `^[A-Z0-9_-]+$`, único |
| branch | enum ProductBranch |
| currency | enum ContractCurrency |
| emissionType | enum EmissionType |
| subPlanCode | opcional, máx. 50 |
| allowsQuickEmission | boolean opcional |
| renewalFrequency | enum opcional |
| renewalType | enum opcional |
| premiumGuaranteeDays | int 0–365 opcional |
| annualClosingMonth | int 1–12 opcional |

**Side effects al crear:**

| Condición | Acción backend |
|-----------|----------------|
| Siempre | `status = DRAFT`, `isImmutable = false` |
| Siempre | Crear registro en `stateHistory`: `toStatus: DRAFT` |
| `branch ∈ {RCV_OBLIGATORIO, INCLUSIVO}` | `simplifiedContract = true`, `uniformConditions = true` |
| `branch = RCV_OBLIGATORIO` | `lockedGeneralConditions = true` |

**Response:** `201` — producto creado **con `id`**.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "commercialName": "Nuevo producto",
  "internalCode": "PROD-K7X2AB",
  "branch": "PATRIMONIAL",
  "status": "DRAFT",
  "isImmutable": false,
  "simplifiedContract": false,
  "uniformConditions": false,
  "lockedGeneralConditions": false,
  "coverages": [],
  "actuarialData": null,
  "stateHistory": [
    { "toStatus": "DRAFT", "comment": "Producto creado", "changedAt": "..." }
  ]
}
```

**Errores:** `400` si validación falla; `409` si `internalCode` duplicado (recomendado).

---

### B4.4 Actualizar producto (wizard paso 0 — edición)

```
PATCH /products/:id
```

**Guard:** `ProductMutableGuard` (403 si inmutable).

**Body exacto que envía el frontend:**

```json
{
  "commercialName": "Nuevo producto",
  "currency": "VES",
  "emissionType": "EMISION_GARANTIZADA",
  "subPlanCode": null,
  "vigenciaInicio": null,
  "vigenciaFin": null,
  "allowsQuickEmission": false,
  "renewalFrequency": "ANUAL",
  "renewalType": "NORMAL",
  "premiumGuaranteeDays": 30,
  "annualClosingMonth": 12
}
```

**Campos que NO envía en PATCH:** `branch`, `internalCode` (no se editan tras crear).

**Response:** `200` — producto actualizado (puede incluir `coverages`, `actuarialData`, `sisipConfig`).

---

### B4.5 Eliminar producto

```
DELETE /products/:id
```

**Uso frontend:** no expuesto en UI actual, pero existe en API.

**Regla:** no permitir si `status ∈ {SUBMITTED_TO_SUDEASEG, APPROVED_ACTIVE}`.

---

## B5. Coberturas

### B5.1 Reemplazar todas las coberturas (wizard paso 1)

```
PUT /products/:id/coverages
```

**Guard:** `ProductMutableGuard`

**Body exacto:**

```json
{
  "coverages": [
    {
      "name": "Cobertura Básica",
      "description": "Descripción opcional",
      "sortOrder": 0,
      "isBasicMandatory": true,
      "insuredSumMin": 5000,
      "insuredSumFixed": 10000,
      "deductibleType": "MONTO_FIJO",
      "deductibleValue": 0,
      "waitingPeriodDays": 0,
      "tariffPremium": 50.5,
      "dependsOnCoverageName": "Otra cobertura",
      "reinsuranceContractCode": "RC-001",
      "reinsuranceContractName": "Contrato reaseguro",
      "reinsuranceBranchCode": "BR-01"
    }
  ]
}
```

**Campos opcionales / legacy** (el DTO puede aceptarlos):

- `insuredSumMax`, `vigenciaDesde`, `vigenciaHasta`
- `coberturaInternaCode`, `tarifaInternaCode`, `treatmentType`, `calculationService`

**Obligatorio en UI actual:** persistir **`insuredSumMin`** y **`insuredSumFixed`** cuando el front los envía.

**Lógica frontend al sanitizar:**
- Si no hay `insuredSumFixed`, usa `insuredSumMin` como fallback.
- `deductibleValue`, `tariffPremium` se convierten a `Number`.
- Strings vacíos en campos opcionales → `undefined` (omitidos).

**Comportamiento backend requerido:**
1. Borrar todas las coberturas del producto.
2. Crear las nuevas.
3. **Devolver array con `id` generado por cada cobertura** — crítico para el paso de planes.

**Response:** `200`

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "productId": "550e8400-...",
    "name": "Cobertura Básica",
    "description": "Descripción opcional",
    "sortOrder": 0,
    "isBasicMandatory": true,
    "insuredSumFixed": 10000,
    "deductibleType": "MONTO_FIJO",
    "deductibleValue": 0,
    "waitingPeriodDays": 0,
    "tariffPremium": 50.5,
    "dependsOnCoverageName": "Otra cobertura",
    "reinsuranceContractCode": "RC-001",
    "reinsuranceContractName": "Contrato reaseguro",
    "reinsuranceBranchCode": "BR-01",
    "vigenciaDesde": null,
    "vigenciaHasta": null
  }
]
```

**Después de guardar**, el frontend llama `GET /products/:id` para refrescar IDs.

**Validaciones:**
- Mínimo 1 cobertura (`coverageListSchema` en shared).
- `name` mín. 2 caracteres.

---

### B5.2 Listar / crear / eliminar cobertura individual

```
GET    /products/:id/coverages
POST   /products/:id/coverages
DELETE /products/:id/coverages/:coverageId
```

**Uso frontend:** no usados directamente; el wizard solo usa `PUT` replace. Implementar por completitud de API.

---

## B6. Planes comerciales

### B6.1 Obtener planes (wizard paso 2 — al entrar)

```
GET /products/:id/plans
```

**Response:** `200`

```json
{
  "productId": "550e8400-e29b-41d4-a716-446655440000",
  "branch": "PATRIMONIAL",
  "coverages": [
    { "id": "a1b2c3d4-...", "name": "Cobertura Básica" },
    { "id": "b2c3d4e5-...", "name": "Incendio" }
  ],
  "plans": [
    {
      "name": "Plan Estándar",
      "description": "Plan comercial configurable",
      "badge": "Recomendado",
      "priceFactor": 125.50,
      "isRecommended": true,
      "coverageIds": ["a1b2c3d4-...", "b2c3d4e5-..."],
      "coverageLabels": ["Cobertura Básica", "Incendio"],
      "sortOrder": 0
    }
  ]
}
```

**Si no hay planes guardados:** devolver planes default por ramo (3 planes; RCV solo 1) con coberturas precargadas del producto.

---

### B6.2 Guardar planes (wizard paso 2)

```
PUT /products/:id/plans
```

**Guard:** `ProductMutableGuard`

**Body exacto:**

```json
{
  "plans": [
    {
      "name": "Plan Estándar",
      "description": "Plan recomendado para edificios",
      "badge": "Recomendado",
      "priceFactor": 125.50,
      "isRecommended": true,
      "coverageIds": [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "b2c3d4e5-f6a7-8901-bcde-f12345678901"
      ],
      "sortOrder": 0
    },
    {
      "name": "Plan Básico",
      "description": null,
      "badge": "Esencial",
      "priceFactor": 75.25,
      "isRecommended": false,
      "coverageIds": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
      "sortOrder": 1
    }
  ]
}
```

**Notas frontend:**
- Antes de enviar, filtra `coverageIds` inválidos (`sanitizePlansForSave`).
- **No envía `coverageLabels`** en el PUT; el backend debe calcularlas y persistirlas.

**Validaciones backend:**
- Cada `coverageId` debe ser UUID v4 y existir en las coberturas del producto.
- Error: `400` — `"La cobertura {uuid} no pertenece a este producto."`

**Comportamiento backend:**
1. Borrar planes existentes del producto.
2. Crear nuevos.
3. Persistir `coverageIds` (JSON array) y `coverageLabels` (nombres derivados).

**Response:** `200` — mismo shape que `GET /plans`.

---

## B7. Actuarial

### B7.1 Guardar actuarial (wizard paso 3)

```
PUT /products/:id/actuarial
```

**Guard:** `ProductMutableGuard`

**Body exacto:**

```json
{
  "purePremium": 100,
  "administrativeExpenses": 10,
  "commissions": 8,
  "profitMargin": 5,
  "actuaryName": "María González",
  "actuaryCedula": "V-12345678",
  "actuarySudeasegNumber": "ACT-2024-001",
  "technicalNoteUrl": "https://storage.example.com/nota-tecnica.pdf",
  "ratingVariables": [
    {
      "name": "edad",
      "label": "Edad del asegurado",
      "variableType": "NUMBER",
      "required": true,
      "sortOrder": 0,
      "options": []
    },
    {
      "name": "zona",
      "label": "Zona geográfica",
      "variableType": "SELECT",
      "required": true,
      "sortOrder": 1,
      "options": ["Zona 1", "Zona 2", "Zona 3"]
    }
  ]
}
```

**Notas frontend:**
- Todos los numéricos se envían con `Number(...)`.
- `technicalNoteUrl` vacío → `undefined` (omitido).
- **`commercialPremium` NO se envía** — el backend debe calcularlo.
- **`ratingVariables` siempre se envía como array** (puede ser `[]`). El backend **no debe** responder `null` en GET/PUT.

**Fórmula obligatoria (`packages/shared`):**

```
commercialPremium = purePremium / (1 - admin/100 - commissions/100 - profitMargin/100)
```

**Validaciones:**

| Campo | Regla |
|-------|-------|
| purePremium | > 0 |
| administrativeExpenses | 0–99.99 |
| commissions | 0–99.99 |
| profitMargin | 0–99.99 |
| Suma admin+comisiones+utilidad | **< 100** |
| actuaryName | mín. 3 chars |
| actuaryCedula | mín. 5 chars |
| actuarySudeasegNumber | regex `^[A-Z0-9-]+$` |
| ratingVariables[].name | regex `^[a-z][a-z0-9_]*$` |
| technicalNoteUrl | URL válida si presente |

**Response:** `200`

```json
{
  "id": "...",
  "productId": "...",
  "purePremium": 100,
  "administrativeExpenses": 10,
  "commissions": 8,
  "profitMargin": 5,
  "commercialPremium": 121.95,
  "actuaryName": "María González",
  "actuaryCedula": "V-12345678",
  "actuarySudeasegNumber": "ACT-2024-001",
  "technicalNoteUrl": "https://...",
  "ratingVariables": [
    {
      "id": "...",
      "name": "edad",
      "label": "Edad del asegurado",
      "variableType": "NUMBER",
      "required": true,
      "sortOrder": 0,
      "options": null
    }
  ]
}
```

---

## B8. Legal

### B8.1 Guardar bundle legal (wizard paso 4)

```
PUT /products/:id/legal
```

**Guard:** `ProductMutableGuard`

**Body exacto (ejemplo ramo PATRIMONIAL):**

```json
{
  "exclusions": [
    {
      "text": "SE EXCLUYEN DAÑOS CAUSADOS POR ACTOS INTENCIONALES DEL ASEGURADO.",
      "sortOrder": 0,
      "typographyHighlight": true
    }
  ],
  "documents": [
    {
      "documentType": "CONDICIONES_GENERALES",
      "title": "Condiciones Generales",
      "content": "Condiciones generales del producto.",
      "isLocked": false,
      "isSimplifiedTemplate": false
    },
    {
      "documentType": "CONDICIONES_PARTICULARES",
      "title": "Condiciones Particulares",
      "content": "Cláusulas particulares configurables."
    }
  ],
  "commercialChannels": [],
  "requiredDocuments": [
    {
      "documentKey": "CEDULA",
      "label": "Cédula de identidad",
      "required": true,
      "sortOrder": 0
    },
    {
      "documentKey": "RIF",
      "label": "RIF",
      "required": true,
      "sortOrder": 1
    },
    {
      "documentKey": "COMPROBANTE_DOMICILIO",
      "label": "Comprobante de domicilio",
      "required": true,
      "sortOrder": 2
    }
  ]
}
```

**Variante ramo RCV_OBLIGATORIO / INCLUSIVO (`isUniform = true`):**

```json
{
  "documents": [
    {
      "documentType": "CONDICIONES_GENERALES",
      "title": "Condiciones Generales",
      "content": "Texto uniforme bloqueado — personalización solo vía Anexos.",
      "isLocked": true,
      "isSimplifiedTemplate": true
    },
    {
      "documentType": "CONDICIONES_PARTICULARES",
      "title": "Condiciones Particulares",
      "content": "Cláusulas particulares configurables."
    }
  ]
}
```

**Variante ramo INCLUSIVO — además:**

```json
{
  "commercialChannels": [
    { "name": "Red Comunitaria", "channelType": "ALTERNATIVO" }
  ]
}
```

**Validaciones backend:**
- Mínimo 1 exclusión; texto mín. 10 caracteres.
- **Todas las exclusiones deben tener `typographyHighlight: true`** — si alguna es `false` → `400` Art. 68.
- Si `lockedGeneralConditions` y doc CG con `isLocked: false` → `403`.
- Reemplazo total: exclusions, documents, channels, requiredDocuments.
- `requiredDocuments[].documentKey` puede ser del catálogo fijo **o clave custom** (regex `^[A-Z0-9_-]+$`, 2–60 chars).

**Response:** `200` — producto con relaciones legal (mismo shape que `GET /products/:id` con `exclusions`, `legalDocuments`, `commercialChannels`, `requiredDocuments`).

**Nota:** el DTO backend acepta `formFields` opcional en legal, pero **el frontend NO los envía** (formularios van en emission-config).

---

## B9. Flujo de emisión

### B9.1 Obtener config (wizard paso 5 — al entrar)

```
GET /products/:id/emission-config
```

**Response:** `200`

```json
{
  "productId": "550e8400-...",
  "branch": "PATRIMONIAL",
  "flowSteps": [
    {
      "stepKey": "CLIENT_DATA",
      "label": "Datos cliente",
      "shortLabel": "Cliente",
      "description": "Información legal del tomador.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 0
    },
    {
      "stepKey": "RISK_DATA",
      "label": "Datos del riesgo",
      "shortLabel": "Riesgo",
      "description": "Variables específicas del producto.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 1
    },
    {
      "stepKey": "PLANS_COVERAGES",
      "label": "Planes y coberturas",
      "shortLabel": "Planes",
      "description": "Selección de plan comercial.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 2
    },
    {
      "stepKey": "DOCUMENTS_OCR",
      "label": "Documentos OCR",
      "shortLabel": "Documentos",
      "description": "Recaudos con lectura automática.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 3
    },
    {
      "stepKey": "DIGITAL_SIGNATURE",
      "label": "Firma digital",
      "shortLabel": "Firma",
      "description": "Consentimiento y firma.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 4
    },
    {
      "stepKey": "AI_INSPECTION",
      "label": "Inspección IA",
      "shortLabel": "Inspección",
      "description": "Evidencia fotográfica.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 5
    },
    {
      "stepKey": "TECHNICAL_APPROVAL",
      "label": "Aprobación técnica",
      "shortLabel": "Aprobación",
      "description": "Revisión interna.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 6
    },
    {
      "stepKey": "PAYMENT",
      "label": "Pago habilitado",
      "shortLabel": "Pago",
      "description": "Forma de pago.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 7
    },
    {
      "stepKey": "FINISHED",
      "label": "Finalizado",
      "shortLabel": "Listo",
      "description": "Póliza emitida.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 8
    }
  ],
  "formFields": [
    {
      "label": "Razón social / Tomador",
      "fieldType": "TEXT",
      "required": true,
      "stepKey": "CLIENT_DATA",
      "sortOrder": 0
    }
  ]
}
```

**Si no hay config guardada:** devolver **defaults por ramo**:
- 9 pasos base con `enabled` según ramo (firma off en RCV; inspección on en AUTO/RCV/PATRIMONIAL; aprobación técnica según ramo).
- Campos default cliente (6) + campos riesgo según ramo.

---

### B9.2 Guardar config (wizard paso 5)

```
PUT /products/:id/emission-config
```

**Guard:** `ProductMutableGuard`

**Body exacto:**

```json
{
  "flowSteps": [
    {
      "stepKey": "CLIENT_DATA",
      "label": "Datos cliente",
      "shortLabel": "Cliente",
      "description": "Información legal del tomador y representante.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 0
    },
    {
      "stepKey": "RISK_DATA",
      "label": "Datos del edificio",
      "shortLabel": "Riesgo",
      "description": "Información del riesgo patrimonial.",
      "enabled": true,
      "formEnabled": false,
      "sortOrder": 1
    },
    {
      "stepKey": "PLANS_COVERAGES",
      "label": "Planes y coberturas",
      "shortLabel": "Planes",
      "description": "Comparación de planes comerciales.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 2
    },
    {
      "stepKey": "DOCUMENTS_OCR",
      "label": "Documentos OCR",
      "shortLabel": "Docs",
      "description": "Recaudos obligatorios.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 3
    },
    {
      "stepKey": "DIGITAL_SIGNATURE",
      "label": "Firma digital",
      "shortLabel": "Firma",
      "description": "Consentimiento y firma.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 4
    },
    {
      "stepKey": "AI_INSPECTION",
      "label": "Inspección IA",
      "shortLabel": "Inspección",
      "description": "Evidencia fotográfica.",
      "enabled": false,
      "formEnabled": true,
      "sortOrder": 5
    },
    {
      "stepKey": "TECHNICAL_APPROVAL",
      "label": "Aprobación técnica",
      "shortLabel": "Aprobación",
      "description": "Revisión interna.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 6
    },
    {
      "stepKey": "PAYMENT",
      "label": "Pago habilitado",
      "shortLabel": "Pago",
      "description": "Forma de pago.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 7
    },
    {
      "stepKey": "FINISHED",
      "label": "Finalizado",
      "shortLabel": "Listo",
      "description": "Póliza emitida.",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 8
    }
  ],
  "formFields": [
    {
      "label": "Nombre del edificio",
      "fieldType": "TEXT",
      "required": true,
      "options": [],
      "stepKey": "RISK_DATA",
      "sortOrder": 0
    },
    {
      "label": "Cantidad de apartamentos",
      "fieldType": "NUMBER",
      "required": true,
      "stepKey": "RISK_DATA",
      "sortOrder": 1
    }
  ]
}
```

**Notas frontend:**
- `formEnabled: false` → el paso no muestra editor de campos personalizados; usa defaults del ramo en preview.
- `stepKey` default en campos sin valor: `RISK_DATA`.
- `options` solo relevante si `fieldType = SELECT`.
- Array `formFields` puede estar **vacío** si no hay formulario personalizado.

**Comportamiento backend:**
1. Borrar `flowStepConfigs` y `formFields` del producto.
2. Crear nuevos registros.
3. Devolver mismo shape que GET.

**Defaults si `shortLabel` omitido:** última palabra del `label`.

---

## B10. Workflow / Activación

### B10.1 Validar envío (wizard paso 7 (Activación) — al guardar)

```
GET /products/:id/workflow/validate-submission
```

**Request:** sin body.

**Response:** `200`

```json
{
  "valid": false,
  "violations": [
    {
      "code": "ACTUARY_REQUIRED",
      "message": "El producto debe tener un actuario con número de registro SUDEASEG válido asignado."
    },
    {
      "code": "MANDATORY_COVERAGE",
      "message": "Debe existir al menos una cobertura con is_basic_mandatory = true."
    }
  ]
}
```

**Códigos de violación (`packages/shared`):**

| code | Condición |
|------|-----------|
| ACTUARY_REQUIRED | Sin `actuarySudeasegNumber` |
| EXCLUSIONS_HIGHLIGHT | Sin exclusiones o alguna sin `typographyHighlight` |
| MANDATORY_COVERAGE | Ninguna cobertura `isBasicMandatory` |
| LOAD_FACTOR_INVALID | admin + comisiones + utilidad ≥ 100% |
| INCLUSIVO_CHANNEL | Ramo INCLUSIVO sin canales comerciales |
| INCLUSIVO_TEMPLATE | Ramo INCLUSIVO sin plantilla simplificada |

---

### B10.2 Transición de estado

```
POST /products/:id/workflow/transition
```

**Body — enviar a revisión actuarial:**

```json
{
  "toStatus": "ACTUARIAL_REVIEW",
  "comment": "Envío a revisión actuarial"
}
```

**Body — enviar a SUDEASEG:**

```json
{
  "toStatus": "SUBMITTED_TO_SUDEASEG"
}
```

(`comment` es opcional, máx. 500 chars)

**Transiciones permitidas:**

```
DRAFT                  → ACTUARIAL_REVIEW
ACTUARIAL_REVIEW       → SUBMITTED_TO_SUDEASEG | DRAFT
SUBMITTED_TO_SUDEASEG  → APPROVED_ACTIVE | REJECTED
REJECTED               → DRAFT
APPROVED_ACTIVE        → (ninguna)
```

**Al transicionar a `SUBMITTED_TO_SUDEASEG`:**
- Ejecutar guardrails; si fallan → `400` con `{ message, violations[] }`.
- Setear `isImmutable = true`.

**Response:** `200` — producto actualizado con nuevo `status`.

---

### B10.3 Aprobar producto

```
POST /products/:id/workflow/approve
```

**Body:**

```json
{
  "numeroProvidenciaSudeaseg": "PROV-2026/001",
  "fechaGacetaAprobacion": "2026-01-15"
}
```

**Reglas:**
- Solo desde `SUBMITTED_TO_SUDEASEG`.
- `numeroProvidenciaSudeaseg`: regex `^[A-Z0-9/-]+$`, mín. 5 chars.
- `fechaGacetaAprobacion`: fecha ISO o `YYYY-MM-DD`.

**Side effects:**
- `status = APPROVED_ACTIVE`
- `isImmutable = true`
- Guardar providencia y fecha gaceta en producto.
- Registrar en `stateHistory`.

**Uso frontend:** endpoint disponible; botón de aprobación puede añadirse en UI futura.

---

## B11. SISIP (opcional)

El wizard principal **no llama** estos endpoints hoy. Existen para integración futura.

```
GET /products/:id/sisip
PUT /products/:id/sisip
```

**Body PUT (ejemplo):**

```json
{
  "ramoInternoCode": "01",
  "ramoInternoName": "Patrimonial",
  "branchAlias1": "PAT",
  "branchAlias2": null,
  "producerCode": "PROD-001",
  "producerName": "Productor demo",
  "assignToAllProducers": false,
  "counterCotizacion": "COTIZACION",
  "counterPoliza": "POLIZA",
  "counterRecibo": "RECIBO",
  "counterSiniestro": "SINIESTRO",
  "maskPoliza": "POL-{YYYY}-{SEQ}",
  "maskRecibo": null,
  "maskSiniestro": null
}
```

---

## B12. Objeto Product completo

Respuesta esperada de `GET /products/:id` (todos los campos que consume el frontend):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "commercialName": "RCV Obligatorio Demo",
  "internalCode": "RCV-DEMO-001",
  "branch": "RCV_OBLIGATORIO",
  "currency": "VES",
  "emissionType": "EMISION_GARANTIZADA",
  "status": "DRAFT",
  "simplifiedContract": true,
  "uniformConditions": true,
  "lockedGeneralConditions": true,
  "numeroProvidenciaSudeaseg": null,
  "fechaGacetaAprobacion": null,
  "isImmutable": false,
  "subPlanCode": null,
  "vigenciaInicio": null,
  "vigenciaFin": null,
  "allowsQuickEmission": false,
  "renewalFrequency": "ANUAL",
  "renewalType": "NORMAL",
  "premiumGuaranteeDays": 30,
  "annualClosingMonth": 12,
  "createdAt": "2026-07-18T12:00:00.000Z",
  "updatedAt": "2026-07-18T12:00:00.000Z",

  "coverages": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Daños a Terceros",
      "description": null,
      "sortOrder": 0,
      "isBasicMandatory": true,
      "insuredSumMin": null,
      "insuredSumMax": null,
      "insuredSumFixed": 50000,
      "deductibleType": "MONTO_FIJO",
      "deductibleValue": 0,
      "waitingPeriodDays": 0,
      "tariffPremium": null,
      "vigenciaDesde": null,
      "vigenciaHasta": null,
      "dependsOnCoverageName": null,
      "coberturaInternaCode": null,
      "tarifaInternaCode": null,
      "treatmentType": null,
      "calculationService": null,
      "reinsuranceContractCode": null,
      "reinsuranceContractName": null,
      "reinsuranceBranchCode": null
    }
  ],

  "actuarialData": {
    "id": "...",
    "purePremium": 120,
    "administrativeExpenses": 10,
    "commissions": 8,
    "profitMargin": 5,
    "commercialPremium": 163.64,
    "actuaryName": "María González",
    "actuaryCedula": "V-12345678",
    "actuarySudeasegNumber": "ACT-2024-001",
    "technicalNoteUrl": null,
    "ratingVariables": [
      {
        "id": "...",
        "name": "edad",
        "label": "Edad del asegurado",
        "variableType": "NUMBER",
        "required": true,
        "sortOrder": 0,
        "options": null
      }
    ]
  },

  "exclusions": [
    {
      "id": "...",
      "text": "SE EXCLUYEN DAÑOS CAUSADOS POR ACTOS INTENCIONALES DEL ASEGURADO.",
      "sortOrder": 0,
      "typographyHighlight": true
    }
  ],

  "legalDocuments": [
    {
      "id": "...",
      "documentType": "CONDICIONES_GENERALES",
      "title": "Condiciones Generales",
      "content": "...",
      "isLocked": true,
      "isSimplifiedTemplate": true
    }
  ],

  "commercialChannels": [],

  "requiredDocuments": [
    {
      "id": "...",
      "documentKey": "CEDULA",
      "label": "Cédula de identidad",
      "required": true,
      "sortOrder": 0
    }
  ],

  "productPlans": [
    {
      "name": "Plan Estándar",
      "description": "Plan comercial configurable",
      "badge": "Recomendado",
      "priceFactor": 125.50,
      "isRecommended": true,
      "coverageIds": ["a1b2c3d4-..."],
      "coverageLabels": ["Daños a Terceros"],
      "sortOrder": 0
    }
  ],

  "flowStepConfigs": [
    {
      "stepKey": "CLIENT_DATA",
      "label": "Datos cliente",
      "shortLabel": "Cliente",
      "description": "...",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 0
    }
  ],

  "formFields": [
    {
      "id": "...",
      "label": "Placa",
      "fieldType": "TEXT",
      "required": true,
      "options": null,
      "sortOrder": 0,
      "stepKey": "RISK_DATA"
    }
  ],

  "stateHistory": [
    {
      "fromStatus": null,
      "toStatus": "DRAFT",
      "comment": "Producto creado",
      "changedAt": "2026-07-18T12:00:00.000Z"
    }
  ],

  "sisipConfig": null
}
```

---

## B13. Errores

### Formato que parsea el frontend

**Validación (400):**
```json
{ "message": ["commercialName must be longer than or equal to 3 characters"] }
```
o
```json
{ "message": "Texto de error legible" }
```

**Guardrails (400):**
```json
{
  "message": "Guardrails SUDEASEG: no se puede enviar a revisión",
  "violations": [
    { "code": "ACTUARY_REQUIRED", "message": "..." }
  ]
}
```

**Inmutable (403):**
```json
{
  "message": "El producto está inmutable: no se pueden modificar tasas, coberturas ni textos en este estado.",
  "statusCode": 403
}
```

**No encontrado (404):**
```json
{ "message": "Producto no encontrado", "statusCode": 404 }
```

---

## B14. Reglas de negocio transversales

1. **Prefijo API:** todas las rutas bajo `/api`.
2. **Reemplazo total** en: coberturas, planes, legal, emission-config.
3. **IDs de cobertura** deben sobrevivir al PUT y devolverse al front — crítico para planes.
4. **Prima comercial** solo la calcula el backend, nunca el front en persistencia.
5. **Producto inmutable** tras `SUBMITTED_TO_SUDEASEG` o `APPROVED_ACTIVE`.
6. **Guardrails** obligatorios al pasar a `SUBMITTED_TO_SUDEASEG`.
7. **Exclusiones** siempre con `typographyHighlight: true` al guardar legal.
8. **Emission GET** devuelve defaults si no hay datos guardados.
9. **Plans GET** devuelve defaults si no hay planes guardados.
10. Tras **cualquier guardado** de paso, el front llama `GET /products/:id` para refrescar estado.

---

## B15. Referencias en el código

| Qué | Archivo |
|-----|---------|
| Todas las llamadas HTTP | `frontend/src/lib/api.ts` |
| Payloads al guardar wizard | `frontend/src/pages/ProductWizardPage.tsx` → `saveStep()` |
| Tipos TypeScript | `frontend/src/types/product.ts` |
| Validación Zod compartida | `packages/shared/src/schemas/` |
| Guardrails SUDEASEG | `packages/shared/src/validators/submission-guardrails.ts` |
| Modelo de BD | `backend/prisma/schema.prisma` |
| DTOs NestJS (referencia) | `backend/src/**/dto/*.dto.ts` |
| Implementación referencia | `backend/src/**/` |

---

## B16. Checklist final de integración

- [ ] `POST /products` crea con `id` y `status: DRAFT`
- [ ] `PATCH /products/:id` actualiza campos core
- [ ] `PUT /coverages` devuelve array con `id`; persiste `insuredSumMin`
- [ ] `GET/PUT /plans` valida `coverageIds`; acepta `__INACTIVE__` en `description`
- [ ] `PUT /actuarial` calcula `commercialPremium`; `ratingVariables` nunca `null`
- [ ] `PUT /legal` reemplaza bundle completo
- [ ] `GET/PUT /emission-config` con defaults por ramo
- [ ] `GET /validate-submission` retorna violations
- [ ] `POST /transition` respeta máquina de estados + guardrails
- [ ] `GET /products/:id` incluye **todas** las relaciones
- [ ] CORS + JSON + errores en formato documentado
- [ ] `POST /api/auth/login` y Bearer en productos
- [ ] `priceFactor` persistido como prima total del plan
- [ ] Claves custom en `requiredDocuments`

---

*Guía completa backend v0.2.0 — Products Builder / Exelixi Tech — Documento único para Jorge Durán*
