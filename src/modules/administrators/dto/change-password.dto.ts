import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Contraseña actual' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'Nueva contraseña' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  passwordNew: string;

  @ApiProperty({ description: 'Verificación de nueva contraseña' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  passwordNewVerify: string;
}
