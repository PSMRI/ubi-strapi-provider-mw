import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import * as Sentry from "@sentry/nestjs"


async function bootstrap() {

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT,

    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
  });

  const app = await NestFactory.create(AppModule);

  // Increase the request body size limit
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(
    bodyParser.urlencoded({
      limit: '50mb',
      extended: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('The API description')
    .setVersion('1.0')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Benefits', 'Benefits management endpoints')
    .addTag('Applications', 'Application management endpoints')
    .addTag('ApplicationFiles', 'File management endpoints')
    .addApiKey(
      { type: 'apiKey', name: 'Authorization', in: 'header' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('documentation', app, document, {
    customSiteTitle: 'API Documentation UBI Provider',
    swaggerOptions: {
      tagsSorter: (a, b) => {
        const order = ['Auth', 'Benefits', 'Applications', 'ApplicationFiles'];
        return order.indexOf(a) - order.indexOf(b);
      },
      operationsSorter: 'alpha'
    },
  });

  console.log('process.env.PORT-->>', process.env.PORT);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
