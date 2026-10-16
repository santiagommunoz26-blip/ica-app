import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  GrupoProductivo,
  SistemaProduccion,
} from '../../metodologia/metodologia.tipos.js';
import { MAXIMO_PUNTOS } from '../fase2.reglas.js';

/** Un galpón registrado en la Fase I (RF16). */
export class DatosGalponDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 99 })
  @Type(() => Number)
  @IsInt({ message: 'El número de galpón debe ser un entero.' })
  @Min(1, { message: 'El número de galpón debe ser al menos 1.' })
  @Max(99, { message: 'El número de galpón no puede ser mayor que 99.' })
  numero: number;

  @ApiPropertyOptional({ example: 62, description: 'Edad de las aves.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La edad de las aves debe ser un entero (semanas).' })
  @Min(0, { message: 'La edad de las aves no puede ser negativa.' })
  @Max(10000, { message: 'La edad de las aves no puede ser mayor que 10000.' })
  edadSemanas?: number;

  @ApiPropertyOptional({ example: 62000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad de aves del galpón debe ser un entero.' })
  @Min(0, { message: 'La cantidad de aves del galpón no puede ser negativa.' })
  @Max(10000000, {
    message: 'La cantidad de aves del galpón no puede ser mayor que 10000000.',
  })
  aves?: number;

  @ApiPropertyOptional({ description: 'Si se va a inspeccionar (RF16).' })
  @IsOptional()
  @IsBoolean()
  seleccionado?: boolean;
}

/**
 * Un punto de muestreo del borrador de la Fase II (RF18–RF21).
 *
 * Los rangos finos (15–30 aves en piso, 3–5 jaulas y 10–20 aves en jaula) los
 * valida el servicio contra la metodología, porque dependen del grupo
 * productivo y del tipo de predio; aquí solo se comprueba que los números sean
 * enteros y no sean absurdos.
 */
export class PuntoFase2Dto {
  @ApiProperty({ example: 1, minimum: 1, maximum: MAXIMO_PUNTOS })
  @Type(() => Number)
  @IsInt({ message: 'El número del punto debe ser un entero.' })
  @Min(1, { message: 'El número del punto debe ser al menos 1.' })
  @Max(MAXIMO_PUNTOS, {
    message: `El número del punto no puede ser mayor que ${MAXIMO_PUNTOS}.`,
  })
  numero: number;

  @ApiPropertyOptional({
    example: 2,
    minimum: 0,
    maximum: 2,
    nullable: true,
    description: 'Calificación del punto: 0, 1 o 2 (RF19).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El puntaje debe ser 0, 1 o 2.' })
  @Min(0, { message: 'El puntaje debe ser 0, 1 o 2.' })
  @Max(2, { message: 'El puntaje debe ser 0, 1 o 2.' })
  puntaje?: number | null;

  @ApiPropertyOptional({
    example: 20,
    nullable: true,
    description: 'Aves evaluadas en el punto (RF20, RF21).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de aves debe ser un entero.' })
  @Min(0, { message: 'El número de aves no puede ser negativo.' })
  @Max(1000000, {
    message: 'El número de aves no puede ser mayor que 1000000.',
  })
  aves?: number | null;

  @ApiPropertyOptional({
    example: 4,
    nullable: true,
    description: 'Jaulas muestreadas en el punto (RF20); solo en jaula.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de jaulas debe ser un entero.' })
  @Min(0, { message: 'El número de jaulas no puede ser negativo.' })
  @Max(1000, { message: 'El número de jaulas no puede ser mayor que 1000.' })
  jaulas?: number | null;
}

/** Evaluación de un indicador en un galpón, Fase II (RF18–RF26). */
export class EvaluacionFase2Dto {
  @ApiProperty({ example: 1, description: 'Número del galpón (RF16).' })
  @Type(() => Number)
  @IsInt({ message: 'El número de galpón debe ser un entero.' })
  @Min(1, { message: 'El número de galpón debe ser al menos 1.' })
  @Max(99, { message: 'El número de galpón no puede ser mayor que 99.' })
  galponNumero: number;

  @ApiProperty({ example: 'MBR-01', description: 'Código del indicador.' })
  @IsString()
  @Length(1, 20)
  indicadorCodigo: string;

  @ApiPropertyOptional({ description: 'El indicador se excluye (RF25).' })
  @IsOptional()
  @IsBoolean()
  noAplica?: boolean;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300, {
    message: 'El motivo del «No aplica» no puede pasar de 300 caracteres.',
  })
  motivoNoAplica?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @ApiPropertyOptional({ type: [PuntoFase2Dto], maxItems: MAXIMO_PUNTOS })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAXIMO_PUNTOS)
  @ValidateNested({ each: true })
  @Type(() => PuntoFase2Dto)
  puntos?: PuntoFase2Dto[];
}

/**
 * Verificación de un documento de la Fase III (M5 · RF27–RF31).
 *
 * Los campos van sueltos porque el borrador se guarda por partes (RF26): lo
 * que llegue se aplica. Las reglas finas (el 0 automático del documento no
 * presentado, los rangos de mortalidad) las valida el servicio contra la
 * metodología, porque dependen del grupo productivo y del catálogo.
 */
export class DocumentoFase3Dto {
  @ApiProperty({
    example: 'MBG-04',
    description: 'Código del indicador (RF27).',
  })
  @IsString()
  @Length(1, 20)
  indicadorCodigo: string;

  @ApiPropertyOptional({
    nullable: true,
    description: '¿Se presentó el documento? Nulo mientras no se revise.',
  })
  @IsOptional()
  @IsBoolean()
  presentado?: boolean | null;

  @ApiPropertyOptional({ description: 'Legible y sin correcciones (RF28).' })
  @IsOptional()
  @IsBoolean()
  legible?: boolean;

  @ApiPropertyOptional({ description: 'Firmado por el responsable (RF28).' })
  @IsOptional()
  @IsBoolean()
  firmadoResponsable?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Firma de MV/MVZ con matrícula vigente, si se exige (RF28).',
  })
  @IsOptional()
  @IsBoolean()
  firmadoProfesional?: boolean | null;

  @ApiPropertyOptional({
    example: 7.5,
    minimum: 0,
    maximum: 100,
    nullable: true,
    description: 'Tasa de mortalidad acumulada en % (RF30).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    {
      message:
        'La tasa de mortalidad debe ser un número con máximo dos decimales.',
    },
  )
  @Min(0, { message: 'La tasa de mortalidad debe estar entre 0 % y 100 %.' })
  @Max(100, { message: 'La tasa de mortalidad debe estar entre 0 % y 100 %.' })
  mortalidad?: number | null;

  @ApiPropertyOptional({
    example: 2,
    minimum: 0,
    maximum: 2,
    nullable: true,
    description: 'Puntaje del documento: 0, 1 o 2 (RF19).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El puntaje debe ser 0, 1 o 2.' })
  @Min(0, { message: 'El puntaje debe ser 0, 1 o 2.' })
  @Max(2, { message: 'El puntaje debe ser 0, 1 o 2.' })
  puntaje?: number | null;

  @ApiPropertyOptional({ description: 'Pendiente de entrega (RF31).' })
  @IsOptional()
  @IsBoolean()
  pendiente?: boolean;
}

/**
 * Guardado de la ficha general del predio y de la Fase I (RF13–RF17).
 *
 * Todos los campos son opcionales porque el borrador se puede guardar por
 * partes; lo que llegue se aplica. El equipo puede reenviar el mismo guardado
 * sin duplicar nada (RF12): la inspección se identifica por la visita.
 */
export class GuardarInspeccionDto {
  @ApiPropertyOptional({ example: 'Granja La Esperanza' })
  @IsOptional()
  @IsString()
  @Length(3, 150)
  nombrePredio?: string;

  @ApiPropertyOptional({ example: 'Fusagasugá' })
  @IsOptional()
  @IsString()
  @Length(3, 120)
  municipio?: string;

  @ApiPropertyOptional({ example: 'El Placer' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  vereda?: string;

  @ApiPropertyOptional({ example: 'Carlos Rojas' })
  @IsOptional()
  @IsString()
  @Length(3, 150)
  responsable?: string;

  @ApiPropertyOptional({
    example: 62000,
    description: 'Número total de aves (capacidad instalada), RF13.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de aves debe ser un entero.' })
  @Min(0, { message: 'El número de aves no puede ser negativo.' })
  @Max(10000000, {
    message: 'El número de aves no puede ser mayor que 10000000.',
  })
  numeroAves?: number;

  @ApiPropertyOptional({
    enum: SistemaProduccion,
    enumName: 'SistemaProduccion',
  })
  @IsOptional()
  @IsEnum(SistemaProduccion)
  sistemaProduccion?: SistemaProduccion;

  @ApiPropertyOptional({ example: '2026-10-09T09:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  fechaHora?: string;

  @ApiPropertyOptional({
    enum: GrupoProductivo,
    enumName: 'GrupoProductivo',
  })
  @IsOptional()
  @IsEnum(GrupoProductivo)
  grupoProductivo?: GrupoProductivo;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @ApiPropertyOptional({ type: [DatosGalponDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DatosGalponDto)
  galpones?: DatosGalponDto[];

  @ApiPropertyOptional({
    type: [EvaluacionFase2Dto],
    maxItems: 400,
    description: 'Evaluaciones de la Fase II por galpón e indicador (M4).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => EvaluacionFase2Dto)
  evaluaciones?: EvaluacionFase2Dto[];

  @ApiPropertyOptional({
    type: [DocumentoFase3Dto],
    maxItems: 50,
    description: 'Documentos verificados de la Fase III (M5 · RF27–RF31).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DocumentoFase3Dto)
  documentos?: DocumentoFase3Dto[];
}
