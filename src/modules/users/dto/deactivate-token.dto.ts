import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeactivateTokenDto {
  @ApiProperty({ description: 'Identificador único del usuario en tu sistema' })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty({ description: 'Token del dispositivo a desregistrar' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
