import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthMiddleware } from './common/middlewares/auth.middleware';
import { AllExceptionsFilter } from './common/filters/exception.filters';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { BenefitsModule } from './benefits/benefits.module';
import { ApplicationFilesModule } from './applicationFiles/applicationFiles.module';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma.service';
import { VerificationsModule } from './verifications/verifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ApplicationStatusUpdate } from './applications/crons/calculate-benefit-amount';
import { StrapiAdminModule } from './strapi-admin/strapi-admin.module';
import { EligibilityStatusUpdate } from './applications/crons/check-eligibility-cron';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot(),
    BenefitsModule,
    ApplicationFilesModule,
    ApplicationsModule,
    AuthModule,
    VerificationsModule,
    StrapiAdminModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    ApplicationStatusUpdate,
    EligibilityStatusUpdate,
    {
      provide: APP_FILTER,
      useFactory: () => new AllExceptionsFilter('ubi-provider-mw'),
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: '/*', method: RequestMethod.ALL });
  }
}
