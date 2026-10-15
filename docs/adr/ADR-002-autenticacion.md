# ADR-002 · Autenticación y manejo de sesión

- **Estado:** Aceptada
- **Fecha:** 15 de octubre de 2026
- **Decide:** desarrollador del proyecto (Santiago Muñoz)
- **Requisitos relacionados:** RF01–RF07, RNF07, RNF08, RNF02, RNFG06

## Contexto

- «El sistema debe permitir el inicio de sesión de los usuarios mediante **correo electrónico y
  contraseña**» (RF01) y la **recuperación de contraseña** por correo (RF02).
- «El sistema debe permitir **acceder sin conexión con un PIN**» (RF03) y «obligar a cambiar la
  contraseña temporal en el primer acceso» (RF07).
- «Las contraseñas deben almacenarse cifradas, y la sesión debe manejarse con **tokens que
  expiren**» (RNF07). Control de acceso por roles (RNF08): Administrador, Inspector, Productor y
  un rol de Consulta (propuesto).
- La inspección en campo puede ocurrir **sin conexión** (RNF02): el usuario debe poder entrar y
  trabajar offline y sincronizar después (RF12).
- El docente indica: «Autenticación: **Firebase Auth o backend con JWT**» (documento del curso) y
  «las credenciales y llaves de acceso a servicios cloud deben almacenarse de forma segura y no
  embebidas en el código» (RNFG06).

## Opciones evaluadas

1. **Firebase Authentication** (Google Identity Platform).
2. **JWT propio** con NestJS + Passport y hash de contraseñas (argon2id).
3. Híbrida (Firebase como IdP y tokens propios para la sesión offline).

## Decisión

Se adopta la **opción 2: autenticación propia con JWT**:

- Contraseñas con **hash argon2id** (nunca en claro, nunca reversibles) en PostgreSQL.
- **Access token JWT de vida corta** + **refresh token** revocable almacenado en la base de datos.
- Autorización por **roles y permisos** en el backend (guardas de NestJS), no solo en la interfaz.
- Para el trabajo **sin conexión**: PIN de 6 dígitos derivado de forma local (no es la contraseña),
  con verificación en el dispositivo y **bloqueo tras N intentos**; al recuperar la conexión, la
  sesión se revalida contra el backend y se sincronizan los registros pendientes (RF12).
- Recuperación de contraseña por correo con **token de un solo uso y caducidad**; en el primer
  acceso, contraseña temporal + cambio obligatorio (RF07).

## Justificación

- El requisito fuerte de **trabajo sin conexión (RNF02, RF03)** es el factor decisivo: con JWT
  propio el backend define el contrato de sesión y el PIN offline; Firebase Auth está pensado para
  validación en línea y complica el flujo offline.
- El docente admite explícitamente ambas opciones, y RNFG06 pide no embeber credenciales: con JWT
  propio las llaves son variables de entorno/Secret Manager.
- Los roles y permisos son **específicos de la metodología** (quién diligencia, quién verifica,
  quién firma) y se expresan mejor en el propio dominio.
- Mantener la autenticación dentro del backend **no añade un proveedor externo** al entorno
  académico ni costos asociados, y facilita probar el flujo completo en local (CI incluido).

## Consecuencias

- **Positivas:** control total del flujo offline; sin dependencia de un proveedor externo de
  identidad; pruebas automatizadas del login/roles en CI.
- **Negativas:** hay que implementar y mantener cosas que un IdP daría hechas (recuperación de
  contraseña, bloqueo de cuentas, rotación de tokens, verificación de correo).
- **Pendientes:**
  - Definir el **tiempo de inactividad** que cierra la sesión: figura como punto **por definir**
    en los requisitos (RF02).
  - Definir si habrá verificación de correo y política de complejidad de contraseñas.
  - En producción, las llaves (JWT secret, SMTP) van a **Secret Manager** (RNFG06).
