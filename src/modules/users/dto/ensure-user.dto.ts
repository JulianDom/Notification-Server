import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OsTypeDto {
  android = 'android',
  ios = 'ios',
  web = 'web',
}

export class EnsureUserDto {
  @ApiProperty({ description: 'Identificador único del usuario en tu sistema' })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty({ enum: OsTypeDto, description: 'Sistema operativo del dispositivo' })
  @IsEnum(OsTypeDto)
  osType: OsTypeDto;

  @ApiProperty({ description: 'Token del dispositivo generado por Firebase' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
