import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    Logger
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { AxiosError } from 'axios';
import * as Sentry from '@sentry/nestjs';

interface ErrorResponse {
    statusCode: number;
    message: string;
    timestamp: string;
    path: string;
}

type SupportedException = Error | HttpException | AxiosError;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    constructor(private readonly apiId?: string) { }

    private getSanitizedErrorResponse(
        status: number,
        errorMessage: string,
        request: Request,
    ): ErrorResponse {
        return {
            statusCode: status,
            message: errorMessage,
            timestamp: new Date().toISOString(),
            path: request.url,
        };
    }

    private getSanitizedMessage(status: number, errorMessage: string): string {
        // Map common error messages to generic ones in production
        const errorMap: Record<number, string> = {
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            404: 'Not Found',
            500: 'Internal Server Error',
        };

        return errorMap[status] || errorMessage || 'An unexpected error occurred';
    }

    private logError(
        exception: SupportedException,
        status: number,
        request: Request,
    ): void {
        const errorDetails = {
            status,
            error: exception.message,
            stack: exception.stack,
            path: request.url,
            method: request.method,
            timestamp: new Date().toISOString(),
        };

        this.logger.error(errorDetails);
        
        // Send to Sentry if configured
        this.sendToSentry(exception, status, request);
    }

    private sendToSentry(
        exception: SupportedException,
        status: number,
        request: Request,
    ): void {
        if (!process.env.SENTRY_DSN) return;

        try {
            Sentry.withScope((scope) => {
                // Set the severity level based on status code
                if (status >= 500) {
                    scope.setLevel('error');
                } else if (status >= 400) {
                    scope.setLevel('warning');
                } else {
                    scope.setLevel('info');
                }

                // Add tags for better categorization
                scope.setTag('exception_filter', 'AllExceptionsFilter');
                scope.setTag('status_code', status.toString());
                scope.setTag('http_method', request.method);
                
                // Add API ID if provided
                if (this.apiId) {
                    scope.setTag('api_id', this.apiId);
                }

                // Set user context if available (from auth middleware)
                // const user = (request as any).user;
                if (request.mw_userid) {
                    scope.setUser({
                        id: request.mw_userid,
                        // username: user.username || user.preferred_username,
                        // email: user.email,
                    });
                }

                // Add request context
                scope.setContext('request', {
                    url: request.url,
                    method: request.method,
                    headers: this.sanitizeHeaders(request.headers),
                    body: this.sanitizeBody(request.body),
                    query: request.query,
                    params: request.params,
                });

                // Add exception context
                scope.setContext('exception', {
                    name: exception.constructor.name,
                    message: exception.message,
                    status,
                    timestamp: new Date().toISOString(),
                });

                // Handle different types of exceptions
                if (exception instanceof HttpException) {
                    scope.setTag('exception_type', 'HttpException');
                    const response = exception.getResponse();
                    scope.setContext('http_exception', {
                        response: typeof response === 'object' ? response : { message: response },
                        status: exception.getStatus(),
                    });
                } else if (exception instanceof AxiosError) {
                    scope.setTag('exception_type', 'AxiosError');
                    scope.setContext('axios_error', {
                        code: exception.code,
                        response_status: exception.response?.status,
                        response_data: exception.response?.data,
                        config: {
                            url: exception.config?.url,
                            method: exception.config?.method,
                            baseURL: exception.config?.baseURL,
                        },
                    });
                } else if (exception instanceof Prisma.PrismaClientValidationError) {
                    scope.setTag('exception_type', 'PrismaClientValidationError');
                } else if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
                    scope.setTag('exception_type', 'PrismaClientUnknownRequestError');
                } else if (exception instanceof Prisma.PrismaClientInitializationError) {
                    scope.setTag('exception_type', 'PrismaClientInitializationError');
                } else {
                    scope.setTag('exception_type', 'UnknownError');
                }

                // Capture the exception
                Sentry.captureException(exception);
            });
        } catch (sentryError) {
            this.logger.warn({ 
                message: 'Error sending exception to Sentry', 
                context: 'AllExceptionsFilter',
                error: sentryError.message 
            });
        }
    }

    private sanitizeHeaders(headers: any): any {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        const sanitized = { ...headers };
        
        Object.keys(sanitized).forEach(key => {
            if (sensitiveHeaders.includes(key.toLowerCase())) {
                sanitized[key] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }

    private sanitizeBody(body: any): any {
        if (!body || typeof body !== 'object') return body;
        
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
        const sanitized = { ...body };
        
        const sanitizeObject = (obj: any): any => {
            if (typeof obj !== 'object' || obj === null) return obj;
            
            const result = Array.isArray(obj) ? [] : {};
            
            Object.keys(obj).forEach(key => {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    result[key] = '[REDACTED]';
                } else if (typeof obj[key] === 'object') {
                    result[key] = sanitizeObject(obj[key]);
                } else {
                    result[key] = obj[key];
                }
            });
            
            return result;
        };
        
        return sanitizeObject(sanitized);
    }

    catch(
        exception: SupportedException,
        host: ArgumentsHost,
    ) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // Default status code
        let status = 500;
        let errorMessage: string;

        // Handle HttpException
        if (exception instanceof HttpException) {
            status = exception.getStatus();
            errorMessage = (exception.getResponse() as any)?.message ?? exception.message;
        }
        // Handle AxiosError
        else if (exception instanceof AxiosError) {
            status = exception.response?.status ?? 500;
            errorMessage = exception.response?.data ?? exception.message ?? 'AXIOS_ERROR';
        }
        // Handle PrismaClientValidationError
        else if (exception instanceof Prisma.PrismaClientValidationError) {
            status = 400;
            errorMessage = exception.message ?? 'PRISMA_CLIENT_ERROR';
        }
        // Handle PrismaClientUnknownRequestError
        else if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
            errorMessage = exception.message ?? 'PRISMA_CLIENT_UNKNOWN_ERROR';
        }
        // Handle PrismaClientInitializationError       
        else if (exception instanceof Prisma.PrismaClientInitializationError) {
            errorMessage = exception.message ?? 'PRISMA_CLIENT_INITIALIZATION_ERROR';
        }
        // Handle other exceptions
        else {
            errorMessage = exception?.message ?? 'INTERNAL_SERVER_ERROR';
        }

        // Log the error with appropriate detail level
        this.logError(exception, status, request);

        // Send sanitized response
        const errorResponse = this.getSanitizedErrorResponse(status, errorMessage, request);
        return response.status(status).json(errorResponse);
    }
}
