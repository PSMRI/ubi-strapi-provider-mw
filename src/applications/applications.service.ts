import {
	Injectable,
	Inject,
	NotFoundException,
	forwardRef,
	BadRequestException,
	UnauthorizedException
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, ApplicationFiles } from '@prisma/client';
import { Request } from 'express';
import {
	UpdateApplicationActionLogDto,
	UpdateApplicationStatusDto,
} from './dto/update-application-status.dto';
import { ListApplicationsDto } from './dto/list-applications.dto';
import { getAuthToken } from '../common/util';
import { v4 as uuidv4 } from 'uuid';
import { BenefitsService } from 'src/benefits/benefits.service';
import reportsConfig from '../common/reportsConfig.json';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AclService } from '../common/service/acl';
import { IFileStorageService } from '../services/storage-providers/file-storage.service.interface';
import { Buffer } from 'buffer';
export interface BenefitDetail {
	id: string;
	documentId: string;
	title: string;
}

type ApplicationData = Record<string, any>;

@Injectable()
export class ApplicationsService {
	private readonly eligibility_base_uri: string;
	
	constructor(
		private readonly prisma: PrismaService,
		@Inject(forwardRef(() => BenefitsService))
		private readonly benefitsService: BenefitsService,
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		private readonly aclService: AclService,
		@Inject('FileStorageService')
		private readonly fileStorageService: IFileStorageService
	) {
		const url = this.configService.get('ELIGIBILITY_API_URL');
		if (!url) {
			throw new Error('ELIGIBILITY_API_URL environment variable is required');
		}
		try {
			new URL(url); // Validate URL format
			this.eligibility_base_uri = url;
		} catch (error) {
			throw new Error(`Invalid ELIGIBILITY_API_URL: ${error.message}`);
		}
	}

	// Helper to build file path with prefix and timestamp
	private buildFilePath(
		applicationId: string,
		certificateType: string,
	): string {
		// fallback to 'local' if not set
		const filePrefix = process.env.FILE_PREFIX_ENV ?? 'local';
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const basePath = `${filePrefix}/applications/${applicationId}`;
		const fileName = `${applicationId}-${certificateType}-${timestamp}.json`;
		return `${basePath}/${certificateType}/${fileName}`;
	}

	/**
	 * Always creates a new application (no orderId matching)
	 */
	async create(data: any) {
		// Step 1: Process and validate input data
		const { vcDocuments, applicationFields } = this.processNewFormat(data);
		const benefitId = data.benefitId;
		if (!benefitId) throw new BadRequestException('benefitId is required');
		// Step 2: Extract and prepare application metadata
		const bapId = data.bapId ?? data.bapid ?? data.bapID ?? null;
		const orderId = data.orderId ?? null;
		const customerId = uuidv4();
		
		// Step 3: Create action log entry for tracking
		const actionLogEntry = this.getActionLogEntry(
			{
				os: applicationFields.os || 'Unknown',
				browser: applicationFields.browser || 'Unknown',
				updatedBy: applicationFields.updatedBy || 0,
				ip: applicationFields.ip || 'Unknown',
				updatedAt: new Date(),
			},
			'application_submitted',
			null
		);
		
		// Step 4: Create application record in database
		const application = await this.prisma.applications.create({
			data: {
				benefitId,
				status: 'pending',
				customerId,
				bapId,
				applicationData: JSON.stringify(applicationFields),
				orderId,
				actionLog: [actionLogEntry],
			},
		});
		
		// Step 5: Process and upload application files
		const applicationFiles = await this.processApplicationFiles(
			application.id,
			vcDocuments,
		);
		
		// Step 6: Return created application with files
		return {
			application,
			applicationFiles,
			message: 'New application created.',
		};
	}

	/**
	 * Always updates an existing application by orderId
	 */
	async updateApplication(orderId: string, data: any) {
		// Step 1: Process and validate input data
		const { vcDocuments, applicationFields } = this.processNewFormat(data);
		
		// Step 2: Find existing application by orderId
		const existing = await this.prisma.applications.findFirst({
			where: { orderId },
		});
		if (!existing) throw new NotFoundException('Application not found for update');
		
		// Step 3: Handle resubmission bookkeeping - create action log entry
		const actionLogEntry = this.getActionLogEntry(
			{
				os: applicationFields.os || 'Unknown',
				browser: applicationFields.browser || 'Unknown',
				updatedBy: applicationFields.updatedBy || 0,
				ip: applicationFields.ip || 'Unknown',
				updatedAt: new Date(),
			},
			'application_resubmitted',
			null,
		);

		// Step 4: Delete existing application files for clean resubmission
		await this.prisma.applicationFiles.deleteMany({
			where: { applicationId: existing.id },
		});

		// Step 5: Update application record in database
		await this.prisma.applications.update({
			where: { id: existing.id },
			data: {
				applicationData: JSON.stringify(applicationFields),
				status: 'pending',
				updatedAt: new Date(),
				remark: null,
				actionLog: Array.isArray(existing.actionLog)
					? [...existing.actionLog, actionLogEntry]
					: [actionLogEntry],
			},
		});
		
		// Step 6: Process and upload new application files
		const applicationFiles = await this.processApplicationFiles(
			existing.id,
			vcDocuments,
		);
		
		// Step 7: Return updated application with files
		return {
			application: { ...existing, ...applicationFields },
			applicationFiles,
			message: 'Application updated.',
		};
	}

	/**
	 * Processes new VC documents format (vc_documents array can be empty, validation handled by DTO)
	 */
	private processNewFormat(data: any) {
		const vcDocuments: { key: string; value: string; metadata: any }[] = [];
		const applicationFields: Record<string, any> = {};

		// Extract vc_documents (validation and transformation already done by DTO)
		data.vc_documents.forEach((doc: any, index: number) => {
			vcDocuments.push({
				key: `vc_document_${index}`,
				value: doc.document_content,
				metadata: {
					document_submission_reason: doc.document_submission_reason,
					document_subtype: doc.document_subtype,
					document_type: doc.document_type,
				}
			});
		});

		// Extract all other fields as application data (excluding control fields)
		const excludeFields = ['vc_documents', 'benefitId', 'orderId', 'bapId', 'status', 'applicationData', 'customerId'];
		for (const [key, value] of Object.entries(data)) {
			if (!excludeFields.includes(key) && !key.startsWith('_') && value !== undefined) {
				applicationFields[key] = value;
			}
		}

		// If applicationData is provided, merge it with extracted fields
		if (data.applicationData && typeof data.applicationData === 'object') {
			Object.assign(applicationFields, data.applicationData);
		}

		return { vcDocuments, applicationFields };
	}


	/**
	 * Checks if an application with the given orderId exists.
	 * - If yes: updates the application and deletes old files
	 * - If no: creates a new application
	 */
	private async findOrCreateApplication({
		orderId,
		benefitId,
		bapId,
		normalFields,
	}: {
		orderId: string | null;
		benefitId: string;
		bapId: string | null;
		normalFields: Record<string, any>;
	}) {
		if (orderId) {
			const existing = await this.prisma.applications.findFirst({
				where: { orderId },
			});

			if (existing) {
				// Delete old application files before updating
				await this.prisma.applicationFiles.deleteMany({
					where: { applicationId: existing.id },
				});

				// Create action log entry for resubmit
				const actionLogEntry = this.getActionLogEntry(
					{
						os: normalFields.os || 'Unknown',
						browser: normalFields.browser || 'Unknown',
						updatedBy: normalFields.updatedBy || 0,
						ip: normalFields.ip || 'Unknown',
						updatedAt: new Date(),
					},
					'application_resubmitted',
					null
				);

				// Update existing action log or create new one
				let updatedActionLog;
				if (existing.actionLog && Array.isArray(existing.actionLog)) {
					updatedActionLog = [...existing.actionLog, actionLogEntry];
				} else {
					updatedActionLog = [actionLogEntry];
				}

				const updated = await this.prisma.applications.update({
					where: { id: existing.id },
					data: {
						benefitId,
						bapId,
						applicationData: JSON.stringify(normalFields),
						remark: null,
						updatedAt: new Date(),
						status: 'pending',
						actionLog: updatedActionLog,
					},
				});
				return { application: updated, isUpdate: true };
			}
		}

		// Create new application if no existing one found
		const customerId = uuidv4();
		
		// Create action log entry for new submission
		const actionLogEntry = this.getActionLogEntry(
			{
				os: normalFields.os || 'Unknown',
				browser: normalFields.browser || 'Unknown',
				updatedBy: normalFields.updatedBy || 0,
				ip: normalFields.ip || 'Unknown',
				updatedAt: new Date(),
			},
			'application_submitted',
			null
		);

		const created = await this.prisma.applications.create({
			data: {
				benefitId,
				status: 'pending',
				customerId,
				bapId,
				applicationData: JSON.stringify(normalFields),
				orderId,
				actionLog: [actionLogEntry],
			},
		});
		return { application: created, isUpdate: false };
	}
	/**
	 * Handles processing of application files (both legacy base64 and new VC documents):
	 * - Decodes content
	 * - Uploads to storage
	 * - Saves record in database with proper metadata
	 */
	private async processApplicationFiles(
		applicationId: number,
		base64Fields: { key: string; value: string; metadata?: any }[],
	) {
		const applicationFiles: ApplicationFiles[] = [];

		for (const { key, value, metadata } of base64Fields) {
			const decodedContent = this.decodeBase64(value);
			const filePathWithPrefix = this.buildFilePath(String(applicationId), key);

			const contentBuffer = Buffer.from(decodedContent, 'utf-8');

			let storageKey: string | null;

			try {
				// Upload decoded file to file storage (e.g., cloud/local)
				storageKey = await this.fileStorageService.uploadFile(
					filePathWithPrefix,
					contentBuffer,
				);

				if (!storageKey) throw new Error('Storage service returned null key');
			} catch (err) {
				console.error('Error uploading file to cloud:', err.message);
				throw new BadRequestException(
					'Failed to upload file. Please try again later.',
				);
			}

			try {
				// Prepare database record data
				const fileData: any = {
					storage: process.env.FILE_STORAGE_PROVIDER ?? 'local',
					filePath: storageKey,
					applicationId,
					createdAt: new Date(),
					updatedAt: new Date(),
				};

				// Add VC document metadata if available
				if (metadata) {
					fileData.documentSubmissionReason = metadata.document_submission_reason;
					fileData.documentSubtype = metadata.document_subtype;
					fileData.documentType = metadata.document_type;
				}

				// Save uploaded file info in applicationFiles table
				const appFile = await this.prisma.applicationFiles.create({
					data: fileData,
				});
				applicationFiles.push(appFile);
			} catch (err) {
				console.error('Error saving ApplicationFiles record:', err.message);
				throw new BadRequestException(
					'Failed to save file record. Please try again later.',
				);
			}
		}

		return applicationFiles;
	}
	/**
	 * Decodes a base64-encoded string back into UTF-8 content
	 */
	private decodeBase64(base64String: string): string {
		const base64Content = base64String.replace(/^base64,/, '');
		const urlEncoded = Buffer.from(base64Content, 'base64').toString('utf-8');
		return decodeURIComponent(urlEncoded);
	}

	// Get all applications with benefit details
	async findAll(listDto: ListApplicationsDto, req: Request) {
		const authToken = getAuthToken(req);

		// Get user from request middleware
		const userId = (req as any).mw_userid;

		// Check if user can access this application
		const canAccess = await this.aclService.canAccessBenefit(
			listDto.benefitId,
			authToken,
			userId,
		);
		if (!canAccess) {
			throw new UnauthorizedException(
				'You do not have permission to view this application',
			);
		}

		const applications = await this.prisma.applications.findMany({
			where: {
				benefitId: listDto.benefitId,
			},
		});

		// Enrich applications with benefit details
		let benefit: BenefitDetail | null = null;
		try {
			const benefitDetail = await this.benefitsService.getBenefitsByIdStrapi(
				`${listDto.benefitId}`,
				authToken,
			);
			benefit = {
				id: benefitDetail?.data?.data?.id,
				documentId: benefitDetail?.data?.data?.documentId,
				title: benefitDetail?.data?.data?.title,
			};
		} catch (error) {
			console.error(
				`Error fetching benefit details for application:`,
				error.message,
			);
		}

		return { applications, benefit };
	}

	// Get a single application by ID
	async findOne(id: number, req: Request) {
		const authToken = getAuthToken(req);

		// Get user from request middleware
		const userId = (req as any).mw_userid;

		// // Check if user can access this application
		const canAccess = await this.aclService.canAccessApplication(
			authToken,
			id,
			userId,
		);
		if (!canAccess) {
			throw new UnauthorizedException(
				'You do not have permission to view this application',
			);
		}
		
		try {
			await this.calculateBenefit(id, authToken);
		} catch (err) {
			console.error(`Error checking amount for application ${id}:`, err.message);
			// Continue with the response even if eligibility check fails
		}
		try {
			await this.checkEligibility(id, req);
		} catch (eligibilityError) {
			console.error(`Error checking eligibility for application ${id}:`, eligibilityError.message);
			// Continue with the response even if eligibility check fails
		}
		const application = await this.prisma.applications.findUnique({
			where: { id },
			include: {
				applicationFiles: true,
			},
		});
		if (!application) {
			throw new NotFoundException('Applications not found');
		}

		// Add base64 file content to each applicationFile
		if (
			application.applicationFiles &&
			Array.isArray(application.applicationFiles)
		) {
			application.applicationFiles = await Promise.all(
				application.applicationFiles.map(async (file) => {
					if (file.filePath) {
						let decodedContent: any;
						try {
							decodedContent = await this.fileStorageService.getFile(
								file.filePath,
							);
						} catch (error) {
							console.error(
								`Error fetching file content for application file ${file.id}:`,
								error.message,
							);
							decodedContent = '';
						}
						if (decodedContent) {
							const base64Content = decodedContent
								? Buffer.from(decodedContent).toString('base64')
								: null;
							return { ...file, fileContent: base64Content };
						}
					}
					return { ...file, fileContent: null };
				}),
			);
		}

		let benefitDetails;
		try {
			benefitDetails = await this.benefitsService.getBenefitsByIdStrapi(
				`${application.benefitId}`,
				authToken,
			);
		} catch (error) {
			console.error(
				`Error fetching benefit details for application:`,
				error.message,
			);
		}

		if (application) {
			(application as any).benefitDetails = {
				id: benefitDetails?.data?.data?.id,
				documentId: benefitDetails?.data?.data?.documentId,
				title: benefitDetails?.data?.data?.title,
			};
		}

		return application;
	}

	async findUniqueApplication(id: number) {
		return await this.prisma.applications.findUnique({
			where: { id },
			include: {
				applicationFiles: true,
			},
		});
	}

	async find(where: Prisma.ApplicationsWhereInput) {
		const application = await this.prisma.applications.findMany({
			where,
		});
		if (!application) {
			throw new NotFoundException('Applications not found');
		}
		return application;
	}

	// Update an application by ID
	async update(id: number, data: Prisma.ApplicationsUpdateInput) {
		return this.prisma.applications.update({
			where: { id },
			data,
		});
	}

	async updateStatus(
		id: number,
		updateStatusDto: UpdateApplicationStatusDto,
		actionLog: UpdateApplicationActionLogDto,
	) {
		const application = await this.prisma.applications.findUnique({
			where: { id },
		});

		if (!application) {
			throw new NotFoundException(`Application with ID ${id} not found`);
		}

		if (application.actionLog && Array.isArray(application.actionLog)) {
			application.actionLog.push(
				this.getActionLogEntry(
					actionLog,
					updateStatusDto.status,
					updateStatusDto.remark,
				),
			);
		} else {
			application.actionLog = [
				this.getActionLogEntry(
					actionLog,
					updateStatusDto.status,
					updateStatusDto.remark,
				),
			];
		}

		const updatedApplication = await this.prisma.applications.update({
			where: { id },
			data: {
				...updateStatusDto,
				updatedBy: actionLog.updatedBy,
				actionLog: application.actionLog,
			},
		});

		return {
			statusCode: 200,
			status: 'success',
			message: `Application ${updatedApplication.status} successfully`,
			data: {
				id: updatedApplication.id,
				status: updatedApplication.status,
				benefitId: updatedApplication.benefitId,
			},
		};
	}

	getActionLogEntry(
		actionLog: UpdateApplicationActionLogDto,
		status: string,
		remark: string | null,
	) {
		return JSON.stringify({
			...actionLog,
			status,
			remark,
		});
	}

	async exportApplicationsCsv(
		benefitId: string,
		reportType: string,
	): Promise<string> {
		const reportConfig = reportsConfig[reportType];
		if (!reportConfig) {
			throw new BadRequestException('Invalid report type');
		}

		const {
			autoGenerateFields = [],
			applicationDataColumnDataFields = [],
			calculatedAmountColumnDataFields = [],
			applicationTableDataFields = [],
		} = reportConfig;

		const applications = await this.fetchApplications(benefitId);

		const finalAppDataFields = this.resolveDynamicFields(
			applications,
			applicationDataColumnDataFields,
			'applicationData',
		);

		const finalCalcAmountFields = this.resolveDynamicFields(
			applications,
			calculatedAmountColumnDataFields,
			'calculatedAmount',
			['totalPayout'],
		);

		const headerFields = [
			...autoGenerateFields,
			...finalAppDataFields,
			...finalCalcAmountFields,
			...applicationTableDataFields,
		];

		const csvRows = [headerFields.join(',')];

		for (const [index, app] of applications.entries()) {
			const row = [
				...this.generateAutoFields(autoGenerateFields, index),
				...this.generateAppDataFields(app, finalAppDataFields),
				...this.generateCalcAmountFields(app, finalCalcAmountFields),
				...this.generateAppTableFields(app, applicationTableDataFields),
			];
			csvRows.push(this.escapeCsvRow(row));
		}

		return csvRows.join('\n');
	}

	// --- Helper Methods ---

	private async fetchApplications(benefitId: string): Promise<any[]> {
		try {
			return await this.prisma.applications.findMany({
				where: {
					benefitId,
				},
			});
		} catch (error) {
			throw new BadRequestException(
				`Failed to fetch applications: ${error.message}`,
			);
		}
	}

	private resolveDynamicFields(
		apps: any[],
		fields: string[],
		source: 'applicationData' | 'calculatedAmount',
		excludeFields: string[] = [],
	): string[] {
		if (!Array.isArray(fields)) return [];

		const isWildcard = fields.length === 1 && fields[0] === '*';

		const keySet = new Set<string>();
		for (const app of apps) {
			const sourceData = app[source];
			if (sourceData && typeof sourceData === 'object') {
				Object.keys(sourceData).forEach((key) => {
					if (!excludeFields.includes(key)) {
						keySet.add(key);
					}
				});
			}
		}

		if (isWildcard) {
			return Array.from(keySet).sort((a, b) => a.localeCompare(b));
		}

		return fields.filter((field) => !excludeFields.includes(field));
	}

	private generateAutoFields(
		fields: string[],
		index: number,
	): (string | number)[] {
		return fields.map((field) => (field === 'serialNumber' ? index + 1 : ''));
	}

	private generateAppDataFields(app: any, fields: string[]): string[] {
		return fields.map((field) => {
			if (field === 'otr') return app.applicationData?.nspOtr ?? '';
			if (field === 'aadhaar')
				return app.applicationData?.aadhaar?.slice(-4) ?? '';
			return app.applicationData?.[field] ?? '';
		});
	}

	private generateCalcAmountFields(app: any, fields: string[]): any[] {
		const calcAmountData = app.calculatedAmount ?? {};
		return fields.map((field) => {
			const value = calcAmountData[field];
			return value ?? '';
		});
	}

	private generateAppTableFields(
		app: any,
		fields: string[],
	): (string | number)[] {
		return fields.map((field) => {
			if (field === 'amount') return app.finalAmount ?? '';
			if (field === 'applicationId') return app.id ?? '';
			return app[field] ?? '';
		});
	}

	private escapeCsvRow(row: (string | number)[]): string {
		return row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',');
	}

	// Get a single application by ID
	async calculateBenefit(id: number, authToken: string) {
		const application = await this.prisma.applications.findUnique({
			where: { id },
		});

		if (!application) {
			throw new NotFoundException('Applications not found');
		}

		const benefitDetails = await this.benefitsService.getBenefitsByIdStrapi(
			`${application.benefitId}`,
			authToken,
		);

		if (!benefitDetails?.data?.data) {
			throw new NotFoundException('Benefit details not found');
		}

		let amounts;
		amounts = await this.doBenefitCalculations(
			application.applicationData,
			benefitDetails?.data?.data,
		);
		try {
			await this.update(id, {
				calculatedAmount: amounts,
				finalAmount: `${amounts?.totalPayout}`,
				calculationsProcessedAt: new Date(),
			});
		} catch (err) {
			console.error(
				`Error updating benefit details for application: ${id}`,
				err.message,
			);
			throw new BadRequestException(
				`Failed to update benefit details for application ${id}`,
			);
		}
		return amounts;
	}

	/**
	 * Main function to calculate benefit payout.
	 */
	async doBenefitCalculations(applicationData: any, benefitDefinition: any) {
		const output: Record<string, number> = {};
		let total = 0;

		for (const rule of benefitDefinition.benefitCalculationRules ?? []) {
			let amount = 0;

			switch (rule.type) {
				case 'fixed':
					amount = rule.fixedValue ?? 0;
					break;

				case 'lookup': {
					const inputVal = applicationData[rule.inputFields[0]];
					const found = rule.lookupTable.find(
						(row: any) => row.match === inputVal,
					);
					amount = found ? found.amount : 0;
					break;
				}

				case 'conditional': {
					for (const condition of rule.conditions) {
						const matches = condition.ifExpr
							? this.evaluateIfExpr(condition.ifExpr, applicationData)
							: Object.entries(condition.if).every(
									([k, v]) => applicationData[k] === v,
								);

						if (matches) {
							if (condition.then.amount === 'value') {
								amount = Number(applicationData[rule.inputFields[0]]) || 0;
							} else {
								amount = Number(condition.then.amount) || 0;
							}
							break;
						}
					}
					break;
				}

				case 'formula':
					amount = this.evaluateFormula(rule.formula, applicationData);
					break;

				default:
					console.warn(`Unsupported rule type: ${rule.type}`);
					break;
			}

			output[rule.outputField] = amount;
			total += amount;
		}

		output.totalPayout = total;
		return output;
	}

	/**
	 * Very basic and safe math formula evaluator (supports + - * / and variables).
	 */
	evaluateFormula(formula: string, context: ApplicationData): number {
		try {
			// Replace variable names in the formula with actual values
			const safeExpr = formula.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (match) => {
				return typeof context[match] !== 'undefined' ? context[match] : '0';
			});

			// Only allow safe characters
			if (!/^[\d\s+\-*/().]+$/.test(safeExpr))
				throw new Error('Unsafe formula');

			return Function(`"use strict"; return (${safeExpr})`)(); // evaluated safely
		} catch (err) {
			console.error('Formula evaluation error:', err.message);
			return 0;
		}
	}

	/**
	 * Limited expression evaluator supporting basic comparison logic.
	 */
	evaluateIfExpr(expr: string, context: ApplicationData): boolean {
		try {
			// Basic parser for comparison operators
			const comparisons = expr.match(
				/([a-zA-Z_][a-zA-Z0-9_]*)\s*([=!<>]+)\s*(true|false|\d+|"[^"]*"|'.*?')/g,
			);

			if (!comparisons) return false;

			return comparisons.every((part) => {
				const [, key, op, rawVal] =
					part.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*([=!<>]+)\s*(.*)/) || [];
				let actual = context[key];
				let expected: any = rawVal;

				if (expected === 'true') expected = true;
				else if (expected === 'false') expected = false;
				else if (!isNaN(Number(expected))) expected = Number(expected);
				else expected = expected.replace(/^['"]|['"]$/g, '');

				switch (op) {
					case '===':
						return actual === expected;
					case '!==':
						return actual !== expected;
					case '>':
						return actual > expected;
					case '<':
						return actual < expected;
					case '>=':
						return actual >= expected;
					case '<=':
						return actual <= expected;
					default:
						return false;
				}
			});
		} catch (err) {
			console.error('Expression evaluation error:', err.message);
			return false;
		}
	}

	async checkEligibility(applicationId: number, req: Request) {
		const application = await this.prisma.applications.findUnique({
			where: { id: applicationId },
		});

		if (!application) {
			throw new NotFoundException(
				`Application with ID ${applicationId} not found`,
			);
		}

		const benefitDefinition = await this.benefitsService.getBenefitsByIdStrapi(
			`${application.benefitId}`,
		);
		if (!benefitDefinition?.data) {
			throw new NotFoundException(
				`Benefit with ID ${application.benefitId} not found`,
			);
		}
		
		const strictCheck = req?.query?.strictCheck === 'true';
		const formatEligiblityPayload = await this.formatEligibility(
			benefitDefinition?.data,
			application,
			strictCheck,
		);
		const eligibilityResult = await this.checkApplicationEligibility(
			formatEligiblityPayload?.applicationDetails,
			formatEligiblityPayload?.eligibilityRules,
			formatEligiblityPayload?.strictCheck,
		);
		
		// Calculate eligibility percentage and add it to userDetails
		const eligibilityPercentage = this.calculateEligibilityPercentage(eligibilityResult);
		
		// Add percentage to the first user's details
		if (eligibilityResult?.eligibleUsers?.[0]?.details) {
			eligibilityResult.eligibleUsers[0].details.eligibilityPercentage = eligibilityPercentage;
		} else if (eligibilityResult?.ineligibleUsers?.[0]?.details) {
			eligibilityResult.ineligibleUsers[0].details.eligibilityPercentage = eligibilityPercentage;
		}
		
		let eligibilityStatus = 'ineligible'; // Default status
		if (eligibilityResult?.eligibleUsers?.length > 0) {
			eligibilityStatus = 'eligible'; // Set to eligible if any users are eligible default we sending one application here
		}
		await this.update(applicationId, {
			eligibilityStatus,
			eligibilityResult: eligibilityResult,
			eligibilityCheckedAt: new Date(),
		});

		return eligibilityResult;
	}

	/**
	 * Calculates eligibility percentage based on criteria results
	 * @param eligibilityResult - The eligibility check result
	 * @returns number - Percentage of passed criteria (0-100)
	 */
	private calculateEligibilityPercentage(eligibilityResult: any): number {
		// Get the first user's criteria results (since we're checking one application at a time)
		const userDetails = eligibilityResult?.eligibleUsers?.[0]?.details || 
						   eligibilityResult?.ineligibleUsers?.[0]?.details;
		
		if (!userDetails?.criteriaResults || !Array.isArray(userDetails.criteriaResults)) {
			return 0;
		}

		const criteriaResults = userDetails.criteriaResults;
		const totalCriteria = criteriaResults.length;
		const passedCriteria = criteriaResults.filter(criteria => Boolean(criteria.passed)).length;
		
		// Calculate percentage
		const percentage = totalCriteria > 0 ? (passedCriteria / totalCriteria) * 100 : 0;
		
		// Round to 2 decimal places
		return Math.round(percentage * 100) / 100;
	}

	/**
	 * Prepares eligibility rules and application profile, then calls the eligibility API.
	 * Returns the eligibility check result.
	 */
	async formatEligibility(
		benefitDefinition: any,
		application: any,
		strictCheck: boolean,
	) {
		try {
			if (!benefitDefinition?.data) {
				throw new BadRequestException('Benefit definition data is missing');
			}
			const eligibilityRules = benefitDefinition?.data?.eligibility ?? [];
			if (Array.isArray(eligibilityRules)) {
				eligibilityRules.forEach((rule) => {
					if (rule && typeof rule === 'object' && 'type' in rule) {
						// Ensure rule is an object with a type
						rule.type = 'userProfile';
					}
				});
				const existingIds = eligibilityRules // Extract existing rule IDs to determine the next ID
					.map((rule) => Number(rule.id))
					.filter((id) => !isNaN(id));
				const nextId =
					existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1; /// Determine the next ID for new rules
				eligibilityRules.push({
					// Add a default rule for document verification
					id: nextId,
					type: 'userProfile',
					description: 'All documents must be verified',
					evidence: 'verification status',
					criteria: {
						id: nextId,
						name: 'documentVerificationStatus',
						condition: 'equals',
						conditionValues: ['verified'],
					},
				});
			}
			const applicationDetails = {
				// Prepare application profile for eligibility check
				applicationId: application?.id,
				...(typeof application?.applicationData === 'object' &&
				application?.applicationData !== null
					? application.applicationData
					: {}),
				documentVerificationStatus: application?.documentVerificationStatus,
			};
			return { applicationDetails, eligibilityRules, strictCheck };
		} catch (err) {
			throw new BadRequestException(
				`Failed to format eligibility rules: ${err.message}. Application ID: ${application?.id}, Benefit ID: ${application?.benefitId}`,
			);
		}
	}

	async checkApplicationEligibility(
		userInfo: object,
		eligibilityData: Array<any>,
		strictCheck: boolean,
	): Promise<any> {
		try {
			let eligibilityApiEnd = 'check-users-eligibility'; // Default endpoint
			if (strictCheck) {
				eligibilityApiEnd = 'check-users-eligibility?strictChecking=true'; // Use strict checking endpoint
			}
			const eligibilityApiUrl = `${this.eligibility_base_uri}/${eligibilityApiEnd}`;
			const sdkResponse = await this.httpService.axiosRef.post(
				eligibilityApiUrl,
				{
					userProfiles: [userInfo],
					benefitSchema: { eligibility: eligibilityData },
				},
				{
					headers: {
						'Content-Type': 'application/json',
					},
				},
			);
			return sdkResponse.data;
		} catch (error) {
			throw new Error(`Error checking benefits eligibility: ${error.message}`);
		}
	}

	private generateEligibilityDetailsFields(
		app: any,
		fields: string[],
	): string[] {
		const eligibilityData = app.eligibilityResult ?? {};
		// Get the application details from either eligibleUsers or ineligibleUsers
		const applicationDetails =
			eligibilityData.eligibleUsers?.[0]?.details ??
			eligibilityData.ineligibleUsers?.[0]?.details ??
			{};

		return fields.map((field) => {
			if (field === 'reasons') {
				const reasons =
					applicationDetails.reasons?.map((r) => r.reason).join('; ') ?? '';
				return reasons;
			}
			return '';
		});
	}

	private generateEligibilityFields(app: any, fields: string[]): string[] {
		const eligibilityData = app.eligibilityResult ?? {};
		return fields.map((field) => {
			if (field === 'eligibleUsers') {
				return eligibilityData.eligibleUsers?.length ? 'Yes' : 'No';
			}
			if (field === 'ineligibleUsers') {
				return eligibilityData.ineligibleUsers?.length ? 'Yes' : 'No';
			}
			if (field === 'errors') {
				return eligibilityData.errors?.length ? 'Yes' : 'No';
			}
			return '';
		});
	}

	async exportEligibilityDetailsCsv(
		benefitId: string,
		reportType: string,
	): Promise<string> {
		const reportConfig = reportsConfig[reportType];
		if (!reportConfig) {
			throw new BadRequestException('Invalid report type');
		}

		const {
			autoGenerateFields = [],
			applicationDataColumnDataFields = [],
			calculatedAmountColumnDataFields = [],
			applicationTableDataFields = [],
			eligibilityResultColumnDataFields = [],
			eligibilityDetailsFields = [],
		} = reportConfig;

		const applications =
			await this.fetchApplicationsEligibilityResults(benefitId);

		const finalAppDataFields = this.resolveDynamicFields(
			applications,
			applicationDataColumnDataFields,
			'applicationData',
		);

		const finalCalcAmountFields = this.resolveDynamicFields(
			applications,
			calculatedAmountColumnDataFields,
			'calculatedAmount',
			['totalPayout'],
		);

		const headerFields = [
			...autoGenerateFields,
			...finalAppDataFields,
			...finalCalcAmountFields,
			...applicationTableDataFields,
			...(eligibilityResultColumnDataFields ?? []),
			...(eligibilityDetailsFields ?? []),
		];

		const csvRows = [headerFields.join(',')];

		for (const [index, app] of applications.entries()) {
			const row = [
				...this.generateAutoFields(autoGenerateFields, index),
				...this.generateAppDataFields(app, finalAppDataFields),
				...this.generateCalcAmountFields(app, finalCalcAmountFields),
				...this.generateAppTableFields(app, applicationTableDataFields),
				...(eligibilityResultColumnDataFields
					? this.generateEligibilityFields(
							app,
							eligibilityResultColumnDataFields,
						)
					: []),
				...(eligibilityDetailsFields
					? this.generateEligibilityDetailsFields(app, eligibilityDetailsFields)
					: []),
			];
			csvRows.push(this.escapeCsvRow(row));
		}

		return csvRows.join('\n');
	}

	async fetchApplicationsEligibilityResults(benefitId) {
		try {
			return await this.prisma.applications.findMany({
				where: {
					benefitId: benefitId,
					eligibilityStatus: {
						in: ['eligible', 'ineligible'],
					},
				},
			});
		} catch (error) {
			throw new BadRequestException(
				`Failed to fetch applications: ${error.message}`,
			);
		}
	}
}
