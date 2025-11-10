import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(
    {
      origin: '*',
    }
  );

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const cfg = app.get(ConfigService);

  const swaggerCfg = new DocumentBuilder()
    .setTitle('IA Models API')
    .setDescription('Api para el manejo de modelos de IA')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup('api/docs', app, document);

  console.log(cfg.get('environment'));

  await app.listen(cfg.get<number>('port') || 3000);

  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
