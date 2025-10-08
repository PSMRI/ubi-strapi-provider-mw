import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { ConfigService } from '@nestjs/config';
import { ApplicationsService } from '../applications.service';
import { BenefitsService } from '../../benefits/benefits.service';
import { CronJob } from 'cron';

@Injectable()
export class EligibilityStatusUpdate {
	private readonly strapiToken: string | undefined;
	constructor(
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService,
		private readonly applicationsService: ApplicationsService,
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly benefitsService: BenefitsService
	) {
		this.strapiToken = this.configService.get('STRAPI_TOKEN');
		if (!this.strapiToken) {
			throw new Error('STRAPI_TOKEN is not defined in the configuration');
		}
	}

	onModuleInit() {
		const cronExpression = this.configService.get('ELIGIBILITY_CHECK_CRON_TIME') ?? '*/30 * * * *';
		const job = new CronJob(cronExpression, () => this.updateEligibilityStatusCron());

		this.schedulerRegistry.addCronJob('eligibility-status-update', job);
		job.start();
	}

	private async updateEligibilityStatusCron() {
		try {
			const benefits = await this.getBenefitsIds();
			await this.processBenefits(benefits);
		} catch (error) {
			Logger.error(`Error in eligibility status update cron: ${error.message}`);
		}
	}

	private async getBenefitsIds() {
		const dt = new Date();
		const ELIGIBILITY_CHECK_LAST_PROCESS_HOURS = Number(
			this.configService.get('ELIGIBILITY_CHECK_LAST_PROCESS_HOURS') ?? 24
		);
		const filterTimestamp = new Date(
			dt.setHours(dt.getHours() - ELIGIBILITY_CHECK_LAST_PROCESS_HOURS)
		).toISOString();
		return this.prisma.$queryRaw<Array<{ id: number }>>`
            SELECT *
            FROM "Applications"
            WHERE "eligibilityStatus" NOT IN ('eligible', 'ineligible')
            AND ("eligibilityCheckedAt" IS NULL OR "eligibilityCheckedAt" <= ${filterTimestamp}::timestamp)
            AND "eligibilityResult" IS NULL
			limit ${this.configService.get('ELIGIBILITY_CHECK_BATCH_SIZE') ?? 10}::bigint OFFSET 0
            `;
	}

	private async processBenefits(applications: any[]) {
		for (const application of applications) {
			try {
				const getBenefit = await this.benefitsService.getBenefitsByIdStrapi(application?.benefitId)
				const benefitDetails = getBenefit?.data // fix CRON
				if (benefitDetails) {
					const formatEligiblityPayload = await this.applicationsService.formatEligibility(
						benefitDetails,
						application,
						true
					);
					const eligibilityResult = await this.applicationsService.checkApplicationEligibility(
						formatEligiblityPayload?.applicationDetails,
						formatEligiblityPayload?.eligibilityRules,
						formatEligiblityPayload?.strictCheck,
					);
					let eligibilityStatus = 'ineligible'; // Default status
					if (eligibilityResult?.eligibleUsers?.length > 0) {
						eligibilityStatus = 'eligible';
					}
					await this.applicationsService.update(application?.id, {
						eligibilityStatus,
						eligibilityResult: eligibilityResult,
						eligibilityCheckedAt: new Date(),
					});
				}
			} catch (err) {
				console.log(err)
				Logger.warn(
					`Failed to process application ${application.id}: ${err.message}`
				);
			}
		}
	}
}
