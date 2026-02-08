import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'x-access-token',
      'x-refresh-token',
      'x-api-key',
      'x-signature',
      'x-timestamp',
    ],
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Notifications Server')
      .setDescription('API para gestión centralizada de notificaciones push')
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', name: 'x-access-token', in: 'header' }, 'admin-token')
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'app-api-key')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || 3010;
  await app.listen(port);
  console.log(`🚀 Notifications Server running on port ${port}`);
  console.log(`📚 API Docs: http://localhost:${port}/docs`);
}

bootstrap();
