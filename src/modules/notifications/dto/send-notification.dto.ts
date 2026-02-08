import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum NotificationType {
  send = 'send',
  sendEach = 'sendEach',
  sendEachForMulticast = 'sendEachForMulticast',
}

export class NotificationData {
  @ApiPropertyOptional({ description: 'Título de la notificación' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Cuerpo de la notificación' })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional({ description: 'URL de imagen' })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class BaseMessage {
  @ApiPropertyOptional({ type: () => NotificationData })
  @ValidateNested()
  @Type(() => NotificationData)
  @IsOptional()
  notification?: NotificationData;

  @ApiPropertyOptional({
    description: 'Datos adicionales (key-value strings)',
    example: { orderId: '12345', type: 'new_order' },
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, string>;
}

export class SendNotificationDto {
  @ApiProperty({
    enum: NotificationType,
    description: 'Tipo de notificación',
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiPropertyOptional({
    description:
      'Enviar a todos los usuarios habilitados (solo para sendEachForMulticast)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  forAll?: boolean;

  @ApiPropertyOptional({
    description: 'Referencias de usuarios (string o array)',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  @IsOptional()
  references?: string | string[];

  @ApiProperty({
    description: 'Datos de la notificación (BaseMessage o array de BaseMessage)',
    oneOf: [
      { $ref: '#/components/schemas/BaseMessage' },
      { type: 'array', items: { $ref: '#/components/schemas/BaseMessage' } },
    ],
  })
  @IsNotEmpty()
  firebaseData: BaseMessage | BaseMessage[];
}

export class AdminSendNotificationDto extends SendNotificationDto {
  @ApiProperty({ description: 'ID de la aplicación' })
  @IsString()
  @IsNotEmpty()
  appId: string;
}
