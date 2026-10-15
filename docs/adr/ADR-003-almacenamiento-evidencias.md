# ADR-003 · Almacenamiento de evidencias (fotos, documentos y videos)

- **Estado:** Aceptada
- **Fecha:** 15 de octubre de 2026
- **Decide:** desarrollador del proyecto (Santiago Muñoz)
- **Requisitos relacionados:** RF19, RF23, RNF22, RNFG02, RNFG06, RNF26, RNF02

## Contexto

- «El sistema debe permitir adjuntar evidencias como **fotografías, documentos o videos cortos**
  asociados a preguntas o criterios» (RF19) y «adjuntar fotos y escribir observaciones por
  indicador» (RF23).
- «Las fotos y los archivos adjuntos deben almacenarse de forma **segura y persistente**, y poder
  consultarse desde el historial» (RNF22).
- «Las evidencias deben almacenarse en un **servicio cloud escalable y seguro**» (RNFG02) y el
  docente indica «Archivos: **Cloud Storage**».
- En desarrollo local ya se dispone de **MinIO** (compatible con la API S3) para no depender de la
  nube durante la construcción, y se exige portabilidad entre ambientes (RNF26).
- Las evidencias se generan en campo, a veces **sin conexión** (RNF02), y los videos pueden pesar
  decenas de MB.

## Opciones evaluadas

1. **Subida/descarga directa** entre el navegador y el almacenamiento, usando **URLs firmadas**
   emitidas por el backend.
2. **Proxy por el backend**: los archivos pasan siempre por la API NestJS.
3. Guardar los binarios en la base de datos (descartada de entrada).

## Decisión

Se adopta la **opción 1 (URLs firmadas)**:

- El backend **autoriza y registra metadatos** (tabla `evidencia`: id, visita, indicador/pregunta,
  tipo, mime, tamaño, hash, ruta en el bucket, autor, fecha), y emite **URLs firmadas de vida
  corta** para subir y para consultar.
- El navegador sube el archivo **directamente** al bucket; el backend nunca almacena el binario.
- Local: **MinIO**; producción: **Cloud Storage**, con el **mismo código** (API S3 en local, SDK de
  GCS en producción) encapsulado en un único servicio de almacenamiento.
- Acceso a evidencias siempre **mediante URL firmada** (nunca bucket público), coherente con RNF22
  y con la protección de datos personales (RNF24).

## Justificación

- Evita que la API cargue en memoria archivos grandes (videos): menos coste, menos riesgo de
  timeouts y mejor rendimiento (RNF05).
- El backend conserva el control de **quién puede subir/ver qué**, que es el requisito real
  (RNF08, RNF22); las URLs firmadas son el mecanismo estándar para esto en GCS.
- MinIO es compatible con S3, lo que permite desarrollar y probar **sin gastar en la nube** y
  mantener la portabilidad exigida (RNF26).

## Consecuencias

- **Positivas:** subidas rápidas y baratas; metadatos consultables en PostgreSQL para el historial
  y los reportes; bucket privado por defecto.
- **Negativas:** hay que configurar **CORS** en el bucket y gestionar caducidad de URLs; la
  validación del archivo ocurre antes de firmar (tipo y tamaño) y no se puede inspeccionar el
  contenido subido (mitigable con validación posterior o antivirus en producción).
- **Pendientes:**
  - Diseñar la **cola de subida offline**: guardar los archivos en el dispositivo (IndexedDB) y
    subirlos al recuperar la conexión, informando cuántos quedan pendientes (RF12).
  - Definir **tamaño máximo** y duración de los videos cortos, y política de retención/borrado.
  - En producción, credenciales del bucket vía **cuenta de servicio + Secret Manager** (RNFG06).
