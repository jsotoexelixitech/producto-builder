# Products Builder

Monorepo de configuración de productos de seguros. Repositorio: [jsotoexelixitech/producto-builder](https://github.com/jsotoexelixitech/producto-builder).

Proyecto con **ECC** (Everything Claude Code) instalado para Cursor. La fuente vive en `./ECC/` (no versionada); la configuración activa está en `./.cursor/`.

## Stack

- **TypeScript / JavaScript** (reglas ECC en `.cursor/rules/typescript-*.mdc`)
- Reglas comunes siempre activas: estilo, seguridad, testing, rendimiento, agentes, git

## Modelos (Composer 2.5 + Claude)

Estrategia de ahorro de tokens alineada con ECC (`the-longform-guide.md`, `common-performance`):

| Tarea | Modelo recomendado | Motivo |
|-------|-------------------|--------|
| Búsqueda, exploración, edits de 1 archivo | **Composer 2.5 Fast** | Rápido y barato; equivalente a Haiku en ECC |
| Implementación multi-archivo, features | **Claude Sonnet** | Mejor balance código/reasoning |
| Arquitectura, seguridad, bugs complejos | **Claude Opus / thinking** | Máximo razonamiento |
| Subagentes (explore, shell, tareas acotadas) | **Composer 2.5** | Delegar lo barato; orquestador en Sonnet |

### Reglas de contexto

1. **MCPs**: mantener &lt;10 activos; desactivar los no usados (cada MCP consume ventana de contexto).
2. **Subagentes en paralelo** para tareas independientes (ver `common-agents.mdc`).
3. **Compactar** tras planificar: ejecutar desde el plan, no arrastrar exploración vieja.
4. **Hooks ECC**: memoria en `~/.cursor/ecc` (aislado de `~/.claude`).
5. **Perfil hooks**: `ECC_HOOK_PROFILE=minimal` si quieres menos overhead; `standard` por defecto.

## Reglas Cursor (perfil mínimo de tokens)

Solo **1 regla alwaysApply** activa: `product-builder-model-routing.mdc`.

Las reglas **TypeScript** (`typescript-*.mdc`) se cargan por glob al editar `**/*.{ts,tsx,js,jsx}` — no en cada mensaje.

Las reglas ECC `common-*` están desactivadas de alwaysApply; úsalas bajo demanda mencionando la skill/regla.

## Comandos

```bash
npm install
npm run build -w packages/shared
npm run db:generate && npm run db:migrate
npm run dev
```

## ECC útil

- Guías: `ECC/the-shortform-guide.md`, `ECC/the-longform-guide.md`
- Reinstalar: `.\ECC\install.ps1 --target cursor typescript`
- Auditoría: `node .cursor/scripts/harness-audit.js` (si está instalado)

## Idioma

Responder en **español** salvo que el usuario pida otro idioma.
