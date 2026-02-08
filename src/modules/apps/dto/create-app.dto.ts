import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppDto {
  @ApiProperty({ example: 'Mi Aplicación' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Configuración de Firebase (contenido del archivo JSON de cuenta de servicio)',
    example: {
      type: 'service_account',
      project_id: 'my-project',
      private_key_id: '...',
      private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
      client_email: '...',
      client_id: '...',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    },
  })
  @IsObject()
  @IsNotEmpty()
  firebaseConfig: Record<string, any>;
}
