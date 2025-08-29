import * as Sentry from '@sentry/nestjs';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Skip Sentry initialization during tests or when DSN is not provided
if (process.env.NODE_ENV === 'test' || !process.env.SENTRY_DSN) {
	if (process.env.NODE_ENV === 'test') {
		console.log('Sentry initialization skipped in test environment');
	} else {
		console.warn(
			'⚠️ SENTRY_DSN not found - Sentry will not capture events',
		);
	}
} else {
	// Ensure to call this before requiring any other modules!
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		environment: process.env.SENTRY_ENVIRONMENT,
		release: process.env.SENTRY_RELEASE,

		// Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
		// Adjusting this value in production
		// Learn more at https://docs.sentry.io/platforms/javascript/guides/nestjs/configuration/options/#tracesSampleRate
		tracesSampleRate: 0.1,

		// Additional configuration options
		debug: process.env.NODE_ENV === 'development',
	});
}

// Test Sentry initialization
if (process.env.NODE_ENV !== 'test' && process.env.SENTRY_DSN) {
	console.log(
		'Sentry initialized with environment:',
		process.env.SENTRY_ENVIRONMENT,
	);
}
