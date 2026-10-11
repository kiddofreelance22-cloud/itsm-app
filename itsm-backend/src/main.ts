import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import { AppModule } from './app.module';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Department } from './modules/departments/entities/department.entity';
import { DEPARTMENTS_SEED_DATA } from './modules/departments/departments.seed';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Persisted uploads (catalog icon/banner, attachments, request-form
  // attachment variables) are served back from here — see UploadsModule.
  // Never exposes filesystem paths to the frontend, only /uploads/<file> URLs.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.enableCors({
    origin: '*', // Allow all origins for development
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // Cache preflight requests for 24 hours
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Enable Socket.IO WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  const config = new DocumentBuilder()
    .setTitle('ITSM API')
    .setDescription('IT Service Management REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Seed departments if they don't exist
  const dataSource = app.get(getDataSourceToken());
  await seedDepartments(dataSource);

  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);

  const externalHost = host === '0.0.0.0' ? host : host;
  logger.log(`🚀 Application is running on: http://${externalHost}:${port}`);
  logger.log(`📄 Swagger UI:               http://${externalHost}:${port}/api/docs`);
  logger.log(`🔌 WebSocket:                ws://${externalHost}:${port}`);
}

async function seedDepartments(dataSource: DataSource) {
  const logger = new Logger('Seed');
  const departmentRepo = dataSource.getRepository(Department);
  
  const existingDepartments = await departmentRepo.count();
  if (existingDepartments === 0) {
    logger.log('Seeding departments...');
    await departmentRepo.save(DEPARTMENTS_SEED_DATA);
    logger.log(`✅ Seeded ${DEPARTMENTS_SEED_DATA.length} departments`);
  } else {
    logger.log(`✅ Departments already exist (${existingDepartments} found)`);
  }
}
bootstrap();
