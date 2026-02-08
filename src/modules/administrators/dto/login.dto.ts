import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'diproachtests@gmail.com' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'diproach' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
