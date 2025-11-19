import {
	Controller,
	Get,
	Post,
	Body,
	Param,
	Patch,
	Query,
	UseFilters,
	UsePipes,
	ValidationPipe,
	UseGuards,
	Req,
	BadRequestException,
	Res,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
	ApiBody,
	ApiBasicAuth,
	ApiQuery,
} from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ApplicationsService } from './applications.service';
import { CreateApplicationsDto } from './dto/create-applications.dto';
import { UpdateApplicationsDto } from './dto/update-applications.dto';
import { AllExceptionsFilter } from 'src/common/filters/exception.filters';
import { UpdateApplicationStatusDto, ApplicationStatus } from './dto/update-application-status.dto';
import { ListApplicationsDto } from './dto/list-applications.dto';
import { ApplicationStatusValidationPipe } from './pipes/application-status-validation.pipe';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApplicationsApiDocs } from '../docs';
import { CsvExportApplicationsDto } from './dto/csvexport-applications.dto';
import { CsvExportEligibilityDto } from './dto/eligibility-csv-dto';
import { getAuthToken, getBrowserInfo } from 'src/common/util';

@UseFilters(new AllExceptionsFilter())
@ApiTags('Applications')
@Controller('applications')
export class ApplicationsController {
	constructor(private readonly applicationsService: ApplicationsService) { }

	@Post()
	@ApiOperation(ApplicationsApiDocs.create.operation)
	@ApiBody(ApplicationsApiDocs.create.body)
	@ApiResponse(ApplicationsApiDocs.create.responses.success)
	@ApiResponse(ApplicationsApiDocs.create.responses.badRequest)
	async create(@Body() data: CreateApplicationsDto) {
		return this.applicationsService.create(data);
	}

	@Post('list')  // Changed to POST with 'list' path to avoid conflict with existing POST /applications
	@ApiBasicAuth('access-token')
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: 'List applications with pagination and ordering',
		description: 'Returns paginated list of applications for a benefit with optional ordering by updatedAt or createdAt fields'
	})
	@ApiBody({ type: ListApplicationsDto })
	@ApiResponse({
		status: 200,
		description: 'Applications retrieved successfully with pagination metadata'
	})
	@ApiResponse({ status: 400, description: 'Missing or invalid parameters' })
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	async findAll(@Body() listDto: ListApplicationsDto, @Req() req: Request) {
		return this.applicationsService.findAll(listDto, req);
	}

	@Get(':id')
	@ApiBasicAuth('access-token')
	@UseGuards(AuthGuard)
	@ApiOperation(ApplicationsApiDocs.findOne.operation)
	@ApiParam(ApplicationsApiDocs.findOne.param)
	@ApiResponse(ApplicationsApiDocs.findOne.responses.success)
	@ApiResponse(ApplicationsApiDocs.findOne.responses.notFound)
	async findOne(@Param('id') id: string, @Req() req: Request) {
		return this.applicationsService.findOne(Number(id), req);
	}

	@Patch(':id')
	@ApiBasicAuth('access-token')
	@UseGuards(AuthGuard)
	@ApiOperation(ApplicationsApiDocs.update.operation)
	@ApiParam(ApplicationsApiDocs.update.param)
	@ApiBody(ApplicationsApiDocs.update.body)
	@ApiResponse(ApplicationsApiDocs.update.responses.success)
	@ApiResponse(ApplicationsApiDocs.update.responses.badRequest)
	@ApiResponse(ApplicationsApiDocs.update.responses.notFound)
	async update(@Param('id') id: string, @Body() data: UpdateApplicationsDto) {
		return this.applicationsService.update(
			Number(id),
			data as Prisma.ApplicationsUpdateInput,
		);
	}

	@Patch(':id/status')
	@ApiBasicAuth('access-token')
	@UseGuards(AuthGuard)
	@ApiOperation(ApplicationsApiDocs.updateStatus.operation)
	@ApiParam(ApplicationsApiDocs.updateStatus.param)
	@ApiBody(ApplicationsApiDocs.updateStatus.body)
	@ApiResponse(ApplicationsApiDocs.updateStatus.responses.success)
	@ApiResponse(ApplicationsApiDocs.updateStatus.responses.badRequest)
	async updateStatus(
		@Param('id') id: string,
		@Body(new ApplicationStatusValidationPipe())
		updateStatusDto: UpdateApplicationStatusDto,
		@Req() req: Request,
	) {
		const updatedByRaw = req.mw_userid;
		if (!updatedByRaw) {
			throw new BadRequestException('updatedBy header missing');
		}
		const updatedBy = Number(updatedByRaw);
		if (Number.isNaN(updatedBy)) {
			throw new BadRequestException('updatedBy must be numeric');
		}

		// Parse x-forwarded-for header, handling both string and array cases
		const forwardedFor = req.headers['x-forwarded-for'];
		let ip = '';
		if (Array.isArray(forwardedFor)) {
			ip = forwardedFor[0];
		} else if (typeof forwardedFor === 'string') {
			// Split on comma and take first IP if it's a comma-separated list
			ip = forwardedFor.split(',')[0].trim();
		}
		// Fallback to remote address if no forwarded IP
		if (!ip) {
			ip = req.socket.remoteAddress ?? '';
		}

		const userAgent = req.headers['user-agent'] ?? '';
		const { os, browser } = getBrowserInfo(userAgent);
		return this.applicationsService.updateStatus(Number(id), updateStatusDto, {
			os,
			browser,
			updatedBy,
			ip,
			updatedAt: new Date(),
		});
	}

	@Get('/reports/csvexport')
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	@ApiBasicAuth('access-token')
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: 'Export applications as CSV',
		description:
			'Exports applications for a given benefitId and report type as a CSV file.',
	})
	@ApiQuery({ name: 'benefitId', type: String, required: true })
	@ApiQuery({ name: 'type', type: String, required: true })
	@ApiQuery({ name: 'status', type: [String], required: false, isArray: true })
	@ApiResponse({
		status: 200,
		description: 'CSV file with applications data',
		schema: { type: 'string', format: 'binary' },
	})
	@ApiResponse({ status: 400, description: 'Missing or invalid parameters' })
	async csvexport(
		@Query() dto: CsvExportApplicationsDto,
		@Req() req: Request,
		@Res() res: Response,
	) {
		try {
			// Handle status[] query parameter (with brackets) - normalize to status array
			if (!dto.status && req.query['status[]']) {
				const statusValue = req.query['status[]'];
				dto.status = Array.isArray(statusValue) 
					? statusValue as ApplicationStatus[]
					: [statusValue as ApplicationStatus];
			}

			const csv = await this.applicationsService.exportApplicationsCsv(
				dto.benefitId,
				dto.type,
				dto.status,
			);

			res.setHeader('Content-Type', 'text/csv');
			res.setHeader(
				'Content-Disposition',
				`attachment; filename="${dto.type}_applications.csv"`,
			);
			res.send(csv);
		} catch (error) {
			throw new BadRequestException(error.message);
		}
	}

	@Get('calculate-benefit/:id')
	@ApiBasicAuth('access-token')
	@UseGuards(AuthGuard)
	@ApiOperation(ApplicationsApiDocs.calculateBenefit.operation)
	@ApiParam(ApplicationsApiDocs.calculateBenefit.param)
	@ApiResponse(ApplicationsApiDocs.calculateBenefit.responses.success)
	@ApiResponse(ApplicationsApiDocs.calculateBenefit.responses.notFound)
	async calculateBenefit(@Param('id') id: string, @Req() req: Request) {
		const authToken = getAuthToken(req);
		// auth token is required for the benefit calculation as method is called from cron job
		return this.applicationsService.calculateBenefit(Number(id), authToken);
	}

	@Get('check-eligibility/:id')
	@ApiBasicAuth('access-token')
	@UseGuards(AuthGuard)
	async isEligible(@Param('id') id: string, @Req() req: Request) {
		return this.applicationsService.checkEligibility(Number(id), req);
	}


	@Get('/reports/eligibility/csvexport')
	@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
	@ApiBasicAuth('access-token')
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: 'Export eligibility report as CSV',
		description:
			'Exports eligibility report for a given report type as a CSV file.',
	})
	@ApiQuery({ name: 'benefitId', type: String, required: true })
	@ApiQuery({ name: 'type', type: String, required: true })
	@ApiResponse({
		status: 200,
		description: 'CSV file with eligibility data',
		schema: { type: 'string', format: 'binary' },
	})
	@ApiResponse({ status: 400, description: 'Missing or invalid parameters' })
	async eligibilitycsvexport(
		@Query() dto: CsvExportEligibilityDto,
		@Res() res: Response,
	) {
		try {
			const csv = await this.applicationsService.exportEligibilityDetailsCsv(
				dto.benefitId,
				dto.type,
			);

			res.setHeader('Content-Type', 'text/csv');
			res.setHeader(
				'Content-Disposition',
				`attachment; filename=eligibility-${dto.type}.csv`,
			);
			res.send(csv);
		} catch (error) {
			throw new BadRequestException(error.message);
		}
	}
}
