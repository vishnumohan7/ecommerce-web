import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { AppConfigService } from './common/config/app-config.service';
import { GlobalErrorFilter } from './common/errors/global-error.filter';
import { RequestLoggingInterceptor } from './common/logging/request-logging.interceptor';
import { ForbiddenFieldsPipe } from './common/pipes/forbidden-fields.pipe';
import { BigIntSerializationInterceptor } from './common/serialization/bigint-serialization.interceptor';

async function bootstrap(): Promise<void> {
  if (process.env.SENTRY_DSN)
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.SENTRY_ENVIRONMENT });
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(AppConfigService);
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.useGlobalPipes(new ForbiddenFieldsPipe());
  app.useGlobalFilters(new GlobalErrorFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor(), new BigIntSerializationInterceptor());
  app.enableShutdownHooks();
  const swagger = new DocumentBuilder()
    .setTitle('Denes Commerce API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger), {
    jsonDocumentUrl: 'api/docs-json',
  });
  await app.listen(config.port, '0.0.0.0');
}
void bootstrap();
