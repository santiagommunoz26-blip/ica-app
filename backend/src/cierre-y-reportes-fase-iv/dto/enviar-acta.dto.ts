import { IsEmail, IsOptional } from 'class-validator';

export class EnviarActaDto {
  @IsOptional()
  @IsEmail()
  correo?: string;
}
