# Spike S0 · Motor de formularios dinámicos (US-08)

**Pregunta del spike:** ¿cómo almacenar y versionar checklists anidados con ponderaciones que
sumen 100 en cada nivel, y cómo calcular el resultado?

**Tiempo máximo:** 4 horas (caja de tiempo del Sprint 0).
**Entregable:** este prototipo + la decisión registrada en [ADR-001](../adr/ADR-001-modelo-datos-formularios.md).

---

## 1. Hipótesis

Si el catálogo de la metodología (grupos, indicadores, escalas y pesos) vive **como datos
versionados** y no en el código, y cada visita guarda un **snapshot de la versión usada**, entonces:

1. el administrador puede editar el catálogo y validar que los pesos suman 100;
2. una visita **cerrada** conserva su resultado aunque la metodología cambie;
3. el cálculo (indicador → grupo → final → clasificación) es aritmético, reproducible y rápido.

## 2. Qué se construyó

| Archivo                                    | Qué es                                                                |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `catalogo.ejemplo.json`                    | Catálogo versionado e **ilustrativo** de una metodología (v2.0, 2024) |
| `respuestas.ejemplo.json`                  | Una visita de ejemplo, con un indicador marcado «No aplica»           |
| `validar.mjs`                              | Validador + motor de cálculo + comprobaciones automáticas (sin dependencias) |

Se ejecuta con:

```bash
node docs/spike-form-engine/validar.mjs
```

> **Aviso:** los nombres de indicadores y los tamaños de muestra son **marcadores de posición**. El
> catálogo real debe cargarse desde el documento de la metodología ICA v2.0 (2024), que todavía
> **no** tenemos. Los pesos (corral 35/35/30; traspatio 60/40), las fórmulas y la clasificación
> **sí** provienen de los documentos fuente.

## 3. Qué se comprobó

| Comprobación                                                                    | Resultado |
| ------------------------------------------------------------------------------- | --------- |
| El catálogo de ejemplo es válido (códigos únicos, escalas, tipos de pregunta)    | ✔         |
| Un catálogo con pesos que **no** suman 100 (40+40+19) es **rechazado**           | ✔         |
| Todo en 2 → **100,00 · Excelente**; todo en 0 → **0,00 · Bajo**                  | ✔         |
| «No aplica» **excluye** el indicador y el grupo promedia solo los aplicables      | ✔         |
| Cálculo verificado a mano: $75{,}21$ · **Alto**                                   | ✔         |
| Perfil **traspatio** (60 % MBA + 40 % MBR; MBG fuera del cálculo)                 | ✔         |
| **Inmutabilidad**: la visita cerrada no cambia al editar el catálogo (v2.1 → otra visita) | ✔   |
| Clasificación automática del predio por número de aves (≥200 corral / ≤199 traspatio) | ✔     |

Salida del prototipo con la visita de ejemplo:

```
Grupos
  Grupo                             Promedio   Peso    Aporte
  MBA (2/2 ind.)                     79.17    35 % 27.71
  MBR (1/2 ind.)                     50.00    35 % 17.50
  MBG (1/1 ind.)                    100.00    30 % 30.00
  FINAL                                              75.21
  Clasificación: Alto
```

## 4. Conclusiones (respuesta a la pregunta)

1. **El modelo híbrido funciona.** Catálogo relacional y versionado + respuestas de la visita con
   snapshot de la versión cubre los tres objetivos: edición validada, inmutabilidad de lo cerrado y
   cálculo reproducible.
2. **La restricción «suma 100» es verificable como validación**, y además es **por perfil de
   predio** (corral / traspatio), no por nivel arbitrario: los documentos fuente la exigen para los
   pesos de los grupos de medidas (RF48).
3. **El cálculo es estable y barato**: son promedios ponderados; el recálculo completo del ejemplo
   es instantáneo (holgado frente a RNF04, «menos de 1 segundo»).
4. **La jerarquía real de los documentos es**
   `metodología (versión) → grupo de medidas (MBA/MBR/MBG) → indicador → puntajes/muestreo (+
   pregunta)`.
   La jerarquía que enunciaba el spike (`Dimensión → Criterio → Subcriterio → Indicador → Pregunta`)
   **no aparece** en los documentos fuente: queda **por confirmar con el docente** si existe un nivel
   intermedio de criterios.
5. El prototipo soporta los **tipos de pregunta** exigidos (sí/no, única, múltiple, escala, numérica,
   textual y evidencia); solo los de tipo escala/numérica puntúan.

## 5. Limitaciones y pendientes

- No se probó el **almacenamiento real** (PostgreSQL/JSONB) ni la concurrencia: es un prototipo de
  lógica.
- Falta definir el **catálogo real** (indicadores, escalas y tamaños de muestra) desde el manual ICA.
- Falta definir cómo **convierte a puntaje** cada tipo de pregunta no numérico (sí/no, selección) y
  qué ocurre si se excluye **todo** un grupo (¿se redistribuye el peso?). No está en los documentos
  fuente.
- Falta el comportamiento **sin conexión** (guardar respuestas localmente y sincronizar), que es un
  requisito aparte (RF12) y se trabajará en M2.
