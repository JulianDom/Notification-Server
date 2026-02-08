import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnEnsureUserDto {
  @ApiProperty({ description: 'Identificador único del usuario en tu sistema' })
  @IsString()
  @IsNotEmpty()
  reference: string;
}
