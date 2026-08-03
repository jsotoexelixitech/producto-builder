# Products Builder — Brief para Backend

**Para:** Desarrollador backend  
**De:** Equipo Products Builder / Exelixi Tech  
**Proyecto:** Configurador de productos de seguros (SUDEASEG)  
**Repo:** https://github.com/jsotoexelixitech/products-builder  
**Fecha:** Julio 2026  

---

## 1. Contexto

El **frontend ya está hecho** (React + TypeScript). Necesitamos una **API REST** que guarde y devuelva la configuración de productos de seguros.

El frontend llama a la API en cada paso de un wizard de 7 pantallas. Si los endpoints responden como se describe aquí, la integración funciona sin cambios en el UI.

**Stack sugerido:** NestJS + Prisma + PostgreSQL  
**URL base (desarrollo):** `http://localhost:3001/api`  
**Frontend (desarrollo):** `http://localhost:5173`  
**CORS:** habilitar origen `http://localhost:5173`

---

## 2. Endpoints requeridos

| # | Método | Ruta | Uso |
|---|--------|------|-----|
| 1 | GET | `/products` | Listado (dashboard) |
| 2 | GET | `/products/:id` | Cargar producto completo |
| 3 | POST | `/products` | Crear producto |
| 4 | PATCH | `/products/:id` | Actualizar datos core |
| 5 | PUT | `/products/:id/coverages` | Guardar coberturas |
| 6 | PUT | `/products/:id/plans` | Guardar planes comerciales |
| 7 | PUT | `/products/:id/actuarial` | Guardar actuarial |
| 8 | PUT | `/products/:id/legal` | Guardar legal |
| 9 | GET | `/products/:id/emission-config` | Cargar flujo de emisión |
| 10 | PUT | `/products/:id/emission-config` | Guardar flujo de emisión |
| 11 | GET | `/products/:id/workflow/validate-submission` | Validar guardrails |
| 12 | POST | `/products/:id/workflow/transition` | Cambiar estado |
| 13 | POST | `/products/:id/workflow/approve` | Aprobar con providencia SUDEASEG |

**Opcional (referencia SISIP):** `GET/PUT /products/:id/sisip`

---

## 3. Datos que envía el frontend (por paso del wizard)

### Paso 0 — Producto

**POST /products** (crear) o **PATCH /products/:id** (editar)

```json
{
  "commercialName": "RCV Demo",
  "internalCode": "RCV-DEMO-001",
  "branch": "PATRIMONIAL",
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

**Enums importantes:**
- `branch`: AUTOMOVIL | SALUD | VIDA | PATRIMONIAL | INCLUSIVO | RCV_OBLIGATORIO
- `currency`: VES | USD | INDEXADO
- `emissionType`: EMISION_GARANTIZADA | REQUIERE_DECLARACION_SALUD | REQUIERE_INSPECCION

**Validaciones:** nombre ≥ 3 chars; código interno único, solo A-Z, 0-9, `_` y `-`.

**Respuesta:** producto con `id` (UUID). Estado inicial: `DRAFT`.

---

### Paso 1 — Coberturas

**PUT /products/:id/coverages**

```json
{
  "coverages": [
    {
      "name": "Daños a terceros",
      "description": "Cobertura básica",
      "sortOrder": 0,
      "isBasicMandatory": true,
      "insuredSumFixed": 50000,
      "deductibleType": "MONTO_FIJO",
      "deductibleValue": 0,
      "waitingPeriodDays": 0
    }
  ]
}
```

**Importante:** reemplazo total. Devolver cada cobertura con su **`id`** — los planes los usan después.

---

### Paso 2 — Planes comerciales

**PUT /products/:id/plans**

```json
{
  "plans": [
    {
      "name": "Plan Estándar",
      "description": "Plan recomendado",
      "badge": "Recomendado",
      "priceFactor": 1,
      "isRecommended": true,
      "coverageIds": ["uuid-cobertura-1", "uuid-cobertura-2"],
      "sortOrder": 0
    }
  ]
}
```

**Regla:** cada `coverageId` debe existir en el producto. Si no → HTTP 400: *"La cobertura {uuid} no pertenece a este producto."*

**GET /products/:id/plans** debe devolver:

```json
{
  "productId": "...",
  "branch": "PATRIMONIAL",
  "coverages": [{ "id": "...", "name": "..." }],
  "plans": [ ... ]
}
```

---

### Paso 3 — Actuarial

**PUT /products/:id/actuarial**

```json
{
  "purePremium": 120,
  "administrativeExpenses": 10,
  "commissions": 8,
  "profitMargin": 5,
  "actuaryName": "Juan Pérez",
  "actuaryCedula": "V-12345678",
  "actuarySudeasegNumber": "ACT-2024-001",
  "technicalNoteUrl": "https://...",
  "ratingVariables": [
    {
      "name": "edad",
      "label": "Edad del asegurado",
      "variableType": "NUMBER",
      "required": true,
      "sortOrder": 0
    }
  ]
}
```

**El backend calcula** `commercialPremium`:

> commercialPremium = purePremium ÷ (1 − admin/100 − comisiones/100 − utilidad/100)

**Validación:** admin + comisiones + utilidad **< 100%**.

---

### Paso 4 — Legal

**PUT /products/:id/legal**

```json
{
  "exclusions": [
    {
      "text": "Quedan excluidos los daños por guerra...",
      "sortOrder": 0,
      "typographyHighlight": true
    }
  ],
  "documents": [
    {
      "documentType": "CONDICIONES_GENERALES",
      "title": "Condiciones Generales",
      "content": "...",
      "isLocked": false,
      "isSimplifiedTemplate": false
    },
    {
      "documentType": "CONDICIONES_PARTICULARES",
      "title": "Condiciones Particulares",
      "content": "..."
    }
  ],
  "commercialChannels": [
    { "name": "Red Comunitaria", "channelType": "ALTERNATIVO" }
  ],
  "requiredDocuments": [
    {
      "documentKey": "CEDULA",
      "label": "Cédula de identidad",
      "required": true,
      "sortOrder": 0
    }
  ]
}
```

**Nota:** `commercialChannels` solo aplica en ramo INCLUSIVO (en otros ramos llega `[]`).

---

### Paso 5 — Flujo de emisión

**PUT /products/:id/emission-config**

```json
{
  "flowSteps": [
    {
      "stepKey": "CLIENT_DATA",
      "label": "Datos cliente",
      "shortLabel": "Cliente",
      "description": "Información del tomador",
      "enabled": true,
      "formEnabled": true,
      "sortOrder": 0
    },
    {
      "stepKey": "RISK_DATA",
      "label": "Datos del riesgo",
      "shortLabel": "Riesgo",
      "description": "...",
      "enabled": true,
      "formEnabled": false,
      "sortOrder": 1
    }
  ],
  "formFields": [
    {
      "label": "Placa",
      "fieldType": "TEXT",
      "required": true,
      "stepKey": "RISK_DATA",
      "sortOrder": 0
    }
  ]
}
```

**stepKey posibles:** CLIENT_DATA, RISK_DATA, PLANS_COVERAGES, DOCUMENTS_OCR, DIGITAL_SIGNATURE, AI_INSPECTION, TECHNICAL_APPROVAL, PAYMENT, FINISHED.

Solo CLIENT_DATA y RISK_DATA usan formulario personalizado (`formEnabled`).

**GET** debe devolver defaults por ramo si aún no hay config guardada.

---

### Paso 6 — Workflow / SUDEASEG

**Validar:** GET `/products/:id/workflow/validate-submission`

```json
{ "valid": true, "violations": [] }
```

**Cambiar estado:** POST `/products/:id/workflow/transition`

```json
{ "toStatus": "SUBMITTED_TO_SUDEASEG", "comment": "Envío a revisión" }
```

**Transiciones permitidas:**

| Desde | Hacia |
|-------|-------|
| DRAFT | ACTUARIAL_REVIEW |
| ACTUARIAL_REVIEW | SUBMITTED_TO_SUDEASEG, DRAFT |
| SUBMITTED_TO_SUDEASEG | APPROVED_ACTIVE, REJECTED |
| REJECTED | DRAFT |

**Aprobar:** POST `/products/:id/workflow/approve`

```json
{
  "numeroProvidenciaSudeaseg": "PROV-2026/001",
  "fechaGacetaAprobacion": "2026-01-15"
}
```

---

## 4. Respuesta de GET /products/:id (producto completo)

El frontend necesita **todo anidado** para reabrir el wizard:

- Datos core del producto (`id`, `status`, `branch`, etc.)
- `coverages[]` con `id`
- `actuarialData` + `ratingVariables[]`
- `exclusions[]`, `legalDocuments[]`, `requiredDocuments[]`, `commercialChannels[]`
- `productPlans[]`, `flowStepConfigs[]`, `formFields[]`
- `stateHistory[]`

---

## 5. Guardrails SUDEASEG (obligatorios al enviar)

Al transicionar a **SUBMITTED_TO_SUDEASEG**, validar:

1. Actuario con número de registro SUDEASEG
2. Exclusiones con resalte tipográfico (Art. 68)
3. Al menos 1 cobertura con `isBasicMandatory = true`
4. Gastos + comisiones + utilidad < 100%
5. Si ramo INCLUSIVO: canal alternativo + plantilla simplificada

Si falla → HTTP 400 con:

```json
{
  "message": "Guardrails SUDEASEG: no se puede enviar a revisión",
  "violations": [{ "code": "ACTUARY_REQUIRED", "message": "..." }]
}
```

La lógica ya está en el repo: `packages/shared/src/validators/submission-guardrails.ts`

---

## 6. Errores que parsea el frontend

- Validación: `{ "message": ["texto del error"] }` o `{ "message": "texto" }`
- Guardrails: incluir array `violations`
- Códigos HTTP: 400 (validación), 404 (no encontrado)

---

## 7. Base de datos y recursos en el repo

| Recurso | Ubicación |
|---------|-----------|
| Modelo Prisma | `backend/prisma/schema.prisma` |
| Migración inicial | `backend/prisma/migrations/` |
| Schemas Zod compartidos | `packages/shared/src/schemas/` |
| Guardrails | `packages/shared/src/validators/` |
| Referencia NestJS | `backend/src/` (implementación actual) |
| Cliente API frontend | `frontend/src/lib/api.ts` |
| Tipos TypeScript | `frontend/src/types/product.ts` |

**Variables de entorno:**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/insurance_product_builder?schema=public
PORT=3001
```

**Levantar PostgreSQL:** `docker compose up -d` (incluido en el repo)

---

## 8. Checklist — backend listo para integrar

- [ ] PostgreSQL + migraciones aplicadas
- [ ] Los 13 endpoints responden según este documento
- [ ] GET /products/:id trae todas las relaciones
- [ ] Coberturas devuelven `id` al guardar
- [ ] Planes validan coverageIds del producto
- [ ] Actuarial calcula commercialPremium
- [ ] Guardrails en SUBMITTED_TO_SUDEASEG
- [ ] CORS habilitado para localhost:5173

---

## 9. Contacto / dudas

Ante dudas sobre payloads o comportamiento del UI, revisar:
- `frontend/src/lib/api.ts` — todas las llamadas
- `frontend/src/pages/ProductWizardPage.tsx` — qué se envía al guardar cada paso

**Repositorio:** https://github.com/jsotoexelixitech/products-builder

---

*Documento generado para handoff backend — Products Builder v0.1.0*
