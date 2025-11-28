// Import this first!
import './common/tools/sentry.tools';

// Now import other modules
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Increase the request body size limit
	app.use(bodyParser.json({ limit: '50mb' }));
	app.use(
		bodyParser.urlencoded({
			limit: '50mb',
			extended: true,
		}),
	);

	// Enable CORS only for explicit development environment
	const isDevelopment = process.env.NODE_ENV === 'development';
	
	// Warn if NODE_ENV is undefined (safer default behavior)
	if (!process.env.NODE_ENV) {
		console.warn('Warning: NODE_ENV is undefined. Defaulting to production mode (CORS disabled) for security.');
	}
	
	if (isDevelopment) {
		app.enableCors({
			origin: [
				'http://localhost:5173',
				'http://localhost:5174',
			],
			credentials: true,
		});
		console.log('CORS enabled for development environment');
	} else {
		console.log('CORS disabled for production/non-development environment');
	}

	// Ensure Swagger UI is correctly configured to include Authorization header
	const config = new DocumentBuilder()
		.setTitle('API Documentation')
		.setDescription('The API description')
		.setVersion('1.0')
		.addTag('App', 'Application health check endpoints')
		.addTag('Auth', 'Authentication endpoints')
		.addTag('Benefits', 'Benefits management endpoints')
		.addTag('Applications', 'Application management endpoints')
		.addTag('Strapi Admin', 'Strapi administration endpoints')
		.addTag('Verification', 'Verification management endpoints')
		.addBearerAuth(
			{ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
			'access-token',
		)
		.build();

	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('documentation', app, document, {
		customSiteTitle: 'API Documentation UBI Provider',
		swaggerOptions: {
			tagsSorter: (a, b) => {
				const order = [
					'Auth',
					'Benefits',
					'Applications',
					'Verification',
					'Strapi Admin',
				];
				return order.indexOf(a) - order.indexOf(b);
			},
			operationsSorter: 'alpha',
		},
	});

	// Bind to all interfaces inside the container; avoid logging env in prod
	const port = parseInt(process.env.PORT ?? '', 10) || 7000;
	await app.listen(port, '0.0.0.0');
}
bootstrap();
