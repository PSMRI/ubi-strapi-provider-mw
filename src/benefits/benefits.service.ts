import {
	BadRequestException,
	Injectable,
	Inject,
	InternalServerErrorException,
	forwardRef,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import * as qs from 'qs';
import { HttpService } from '@nestjs/axios';
import { SearchRequestDto } from './dto/search-request.dto';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { generateRandomString, getAuthToken, titleCase } from 'src/common/util';
import { PrismaService } from '../prisma.service';
import { ApplicationsService } from 'src/applications/applications.service';
import { InitRequestDto } from './dto/init-request.dto';
import { ConfirmRequestDto } from './dto/confirm-request.dto';
import { SearchBenefitsDto } from './dto/search-benefits.dto';
import { ConfirmResponseDto } from './dto/confirm-response.dto';
import { StatusRequestDto } from './dto/status-request.dto';
import { StatusResponseDto } from './dto/status-response.dto';
import { SearchResponseDto, TagDto } from './dto/search-response.dto';
import { SelectRequestDto } from './dto/select-request.dto';
import { SelectResponseDto } from './dto/select-response.dto';

@Injectable()
export class BenefitsService {
	private readonly strapiUrl: string;
	private readonly strapiToken: string;
	private readonly providerUrl: string;
  private readonly domain: string;
	private readonly bppId: string;
	private readonly bppUri: string;
	private bapId: string;
	private bapUri: string;
	private readonly urlExtension: string =
		'?populate[tags]=*&populate[benefits][on][benefit.financial-benefit][populate]=*&populate[benefits][on][benefit.non-monetary-benefit][populate]=*&populate[exclusions]=*&populate[references]=*&populate[providingEntity][populate][address]=*&populate[providingEntity][populate][contactInfo]=*&populate[sponsoringEntities][populate][address]=*&populate[sponsoringEntities][populate][contactInfo]=*&populate[eligibility][populate][criteria]=*&populate[documents]=*&populate[applicationProcess]=*&populate[applicationForm][populate][fields][populate][options]=*&populate[benefitCalculationRules]=*';

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		@Inject(forwardRef(() => ApplicationsService))
		private readonly applicationsService: ApplicationsService,
		private readonly prisma: PrismaService,
	) {
		this.strapiUrl = this.configService.get('STRAPI_URL') ?? '';
		this.strapiToken = this.configService.get('STRAPI_TOKEN') ?? '';
		this.providerUrl = this.configService.get('PROVIDER_UBA_UI_URL') ?? '';
		this.domain = this.configService.get('DOMAIN') ?? '';
		this.bppId = this.configService.get('BPP_ID') ?? '';
		this.bppUri = this.configService.get('BPP_URI') ?? '';
	}

	onModuleInit() {
		if (
			!this.strapiToken.trim().length ||
			!this.strapiUrl.trim().length ||
			!this.providerUrl.trim().length ||
			!this.bppId.trim().length ||
			!this.bppUri.trim().length ||
      !this.domain.trim().length
		) {
			throw new InternalServerErrorException(
				'One or more required environment variables are missing or empty: STRAPI_URL, STRAPI_TOKEN, PROVIDER_UBA_UI_URL, BPP_ID, BPP_URI, DOMAIN',
			);
		}
	}

	async getBenefits(body: SearchBenefitsDto, req: Request): Promise<any> {
		const authToken = getAuthToken(req);
		const page = body?.page ?? '1';
		const pageSize = body?.pageSize ?? '100';
		const sort = body?.sort ?? 'createdAt:desc';
		const locale = body?.locale ?? 'en';
		const filters = body?.filters ?? {};

		const queryParams = {
			page,
			pageSize,
			sort,
			locale,
			filters,
		};

		const queryString = qs.stringify(queryParams, {
			encode: false,
			arrayFormat: 'brackets',
		});

		// Call to the Strapi API to get the benefits
		const url = `${this.strapiUrl}/content-manager/collection-types/api::benefit.benefit?${queryString}`;

		const headers = {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: authToken,
		};

		const response = await this.httpService.axiosRef.get(url, {
			headers,
		});

		// Filter benefits to only include published ones
		if (response?.data?.results) {
			response.data.results = response.data.results.filter(
				(benefit: any) => benefit.status === 'published'
			);
		}

		// Check if the response contains results
		if (response?.data?.results.length > 0) {
			const enrichedData = await Promise.all(
				// Map through the results and fetch application details
				response.data.results.map(async (benefit) => {
					let benefitApplications = await this.prisma.applications.findMany({
						where: { benefitId: String(benefit.documentId) },
					});

					let pendingBenefitApplications = 0;
					let approvedBenefitApplications = 0;
					let rejectedBenefitApplications = 0;

					for (const application of benefitApplications) {
						if (application.status === 'pending') {
							pendingBenefitApplications++;
						} else if (application.status === 'approved') {
							approvedBenefitApplications++;
						} else if (application.status === 'rejected') {
							rejectedBenefitApplications++;
						}
					}

					benefitApplications ??= [];

					// Enrich the benefit data with application details like application count, successful and failed applications count
					return {
						...benefit,
						application_details: {
							applications_count: benefitApplications.length,
							pending_applications_count: pendingBenefitApplications,
							approved_applications_count: approvedBenefitApplications,
							rejected_applications_count: rejectedBenefitApplications,
						},
					};
				}),
			);

			response.data.results = enrichedData;
		}

		return response.data;
	}

	async getBenefitsByIdStrapi(id: string, authToken?: string): Promise<any> {
		let url = `${this.strapiUrl}/api/benefits/${id}${this.urlExtension}`;
		let authorizationHeader = `Bearer ${this.strapiToken}`;

		// If authToken is provided and it's not the same as the default strapi token,
		// use the content-manager endpoint with the provided token
		if (authToken && authToken !== this.strapiToken && authToken !== `Bearer ${this.strapiToken}`) {
			url = `${this.strapiUrl}/content-manager/collection-types/api::benefit.benefit/${id}`;
			// Ensure the token has Bearer prefix
			authorizationHeader = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
		}

		const response = await this.httpService.axiosRef.get(url, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: authorizationHeader,
			},
		});

		return response;
	}

	async getBenefitsById(id: string, req: Request): Promise<any> {
		try {
			const authToken = getAuthToken(req);
			const response = await this.getBenefitsByIdStrapi(id, authToken);
			return response.data;
		} catch (error) {
			if (error.isAxiosError) {
				// Handle AxiosError and rethrow as HttpException
				throw new HttpException(
					error.response?.data?.message ?? 'Benefit not found',
					error.response?.status ?? HttpStatus.NOT_FOUND,
				);
			}

			// Handle other errors
			throw new HttpException(
				error.message ?? 'Internal server error',
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

  async searchBenefits(searchRequest: SearchRequestDto, authToken?: string): Promise<SearchResponseDto> {
    if (searchRequest.context.domain === this.domain) {
      let url = `${this.strapiUrl}/api/benefits${this.urlExtension}`;

      // if (authToken) {
      // url = `${this.strapiUrl}/content-manager/collection-types/api::benefit.benefit?${queryString}`;
      //}

			this.checkBapIdAndUri(
				searchRequest?.context?.bap_id,
				searchRequest?.context?.bap_uri,
			);
			const response = await this.httpService.axiosRef.get(url, {
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.strapiToken}`,
				},
			});

      let mappedResponse = new SearchResponseDto();

      if (response?.data) {
        mappedResponse = await this.transformScholarshipsToOnestFormat(
          searchRequest,
          response?.data?.data,
          'on_search',
        );
      }

			return mappedResponse;
		}

		throw new BadRequestException('Invalid domain provided');
	}

	async selectBenefitsById(body: SelectRequestDto): Promise<SelectResponseDto> {
		this.checkBapIdAndUri(body?.context?.bap_id, body?.context?.bap_uri);
		try {
			let id = body.message.order.items[0].id;

      const response = await this.getBenefitsByIdStrapi(id);
      let mappedResponse;
      if (response?.data) {
        mappedResponse = await this.transformScholarshipsToOnestFormat(
          body,
          [response?.data?.data],
          'on_select',
        );
      }

			return mappedResponse;
		} catch (error) {
			if (error.isAxiosError) {
				// Handle AxiosError and rethrow as HttpException
				throw new HttpException(
					error.response?.data?.message ?? 'Benefit not found',
					error.response?.status ?? HttpStatus.NOT_FOUND,
				);
			}

			console.error('Error in selectBenefitsById:', error);
			throw new InternalServerErrorException('Failed to select benefit by ID');
		}
	}

	async init(selectDto: InitRequestDto): Promise<any> {
		this.checkBapIdAndUri(
			selectDto?.context?.bap_id,
			selectDto?.context?.bap_uri,
		);
		try {
			const benefitId = selectDto.message.order.items[0].id;

			// Fetch benefit data from the Strapi API
			const benefitData = await this.getBenefitsByIdStrapi(benefitId);

			let mappedResponse;

      if (benefitData?.data) {
        mappedResponse = await this.transformScholarshipsToOnestFormat(
          selectDto,
          [benefitData?.data?.data],
          'on_init',
        );
      }

			const xinput = {
				head: {
					descriptor: {
						name: 'Application Form',
					},
					index: {
						min: 0,
						cur: 0,
						max: 1,
					},
					headings: ['Personal Details'],
				},
				form: {
					url: `${this.providerUrl}/benefit/apply/${benefitId}`, // React route for the benefit ID
					mime_type: 'text/html',
					resubmit: false,
				},
				required: true,
			};

			const { id, descriptor, categories, locations, items, rateable }: any =
				mappedResponse?.message.catalog.providers?.[0] ?? {};

			items[0].xinput = xinput;

			selectDto.message.order = {
				...selectDto.message.order,
				// Ensure the object matches the InitOrderDto type
				providers: [{ id, descriptor, rateable, locations, categories }],
				items,
			};

			selectDto.context = {
				...selectDto.context,
				...mappedResponse?.context,
			};
			return selectDto;
		} catch (error) {
			if (error.isAxiosError) {
				// Handle AxiosError and rethrow as HttpException
				throw new HttpException(
					error.response?.data?.message ?? 'Benefit not found',
					error.response?.status ?? HttpStatus.NOT_FOUND,
				);
			}

			console.error('Error in handleInit:', error);
			throw new InternalServerErrorException('Failed to initialize benefit');
		}
	}

	async confirm(confirmDto: ConfirmRequestDto): Promise<any> {
		this.checkBapIdAndUri(
			confirmDto?.context?.bap_id,
			confirmDto?.context?.bap_uri,
		);
		try {
			const confirmData = new ConfirmResponseDto();
			const applicationId = confirmDto.message.order.items[0].id; // from frontend will be received after save application

			// Fetch application data from db
			const benefit = await this.applicationsService.findUniqueApplication(
				Number(applicationId),
			);
			if (!benefit) {
				throw new BadRequestException('Application not found');
			}
			const benefitData = await this.getBenefitsByIdStrapi(benefit.benefitId); // from strapi

      let mappedResponse;
      if (benefitData?.data) {
        mappedResponse = await this.transformScholarshipsToOnestFormat(
          confirmDto,
          [benefitData?.data?.data],
          'on_confirm',
        );
      }

			// Generate order ID
			const orderId: string =
				benefit?.orderId ??
				`TLEXP_${generateRandomString().toUpperCase()}_${Date.now()}`;

			// Update customer details
			const orderDetails = await this.applicationsService.update(
				Number(applicationId),
				{ orderId },
			);

			if (!orderDetails?.orderId) {
				throw new BadRequestException('Failed to update order details');
			}

			const { id, descriptor, locations, items, rateable }: any =
				mappedResponse?.message.catalog.providers[0] ?? {};

			confirmData['message'] = {
				order: {
					...confirmDto.message.order,
					provider: { id, descriptor, rateable, locations },
					items,
					id: orderDetails.orderId ?? '',
				},
			};

			confirmData['context'] = {
				...confirmDto.context,
				...mappedResponse?.context,
			};

			return confirmData;
		} catch (error) {
			if (error.isAxiosError) {
				// Handle AxiosError and rethrow as HttpException
				throw new HttpException(
					error.response?.data?.message ?? 'Benefit not found',
					error.response?.status ?? HttpStatus.NOT_FOUND,
				);
			}

			console.error('Error in confirm:', error);
			throw new InternalServerErrorException('Failed to confirm benefit');
		}
	}

	async status(statusDto: StatusRequestDto): Promise<any> {
		this.checkBapIdAndUri(
			statusDto?.context?.bap_id,
			statusDto?.context?.bap_uri,
		);
		try {
			const statusData = new StatusResponseDto();

			// Extract order ID from the request body
			const orderId = statusDto?.message?.order_id;

			// Fetch application details using the order ID
			const applicationData = await this.applicationsService.find({
				orderId,
			});

			if (!applicationData || applicationData.length === 0) {
				throw new BadRequestException(
					'No application found for the given order ID',
				);
			}

			// Extract application from the application data
			const application = applicationData[0];

			// Fetch benefit details using the benefit ID
			const benefitData = await this.getBenefitsByIdStrapi(
				application.benefitId,
			); // from strapi

			// Extract status from application data and add it to benefit data
			const status = application.status.toUpperCase();
			const remark = application.remark ?? '';

			let statusCode;

			if (status === 'APPROVED') {
				statusCode = {
					code: 'APPLICATION-APPROVED',
					name: JSON.stringify({
						status: 'Application Approved',
						comment: remark,
					}),
				};
			} else if (status === 'REJECTED') {
				statusCode = {
					code: 'APPLICATION-REJECTED',
					name: JSON.stringify({
						status: 'Application Rejected',
						comment: remark,
					}),
				};
			} else if (status === 'RESUBMIT') {
				statusCode = {
					code: 'APPLICATION-RESUBMIT',
					name: JSON.stringify({
						status: 'Application Resubmit',
						comment: remark,
					}),
				};
			} else {
				statusCode = {
					code: 'APPLICATION-' + status,
					name: JSON.stringify({
						status: 'Application ' + titleCase(application.status),
						comment: remark,
					}),
				};
			}

      // Prepare the status object
      const metadata = {
        billing: {
          name: 'N/A',
          phone: 'N/A',
          email: 'dummyemail@dummydomain.com',
          address: 'N/A',
          organization: {
            "descriptor": {
              "name": "Onest",
              "code": "onest.com"
            },
            "contact": {
              "phone": "+91-8888888888",
              "email": "scholarships@nammayatri.in"
            }
          },
        },
        payments: [
          {
            params: {
              bank_code: 'ICICI',
              bank_account_number: '123456789012',
              bank_account_name: 'John Doe',
            },
            type: 'PRE-ORDER',
            status: 'PAID',
            collected_by: 'bpp',
          },
        ],
        fulfillments: [{
          id: 'FULFILL_UNIFIED',
          type: 'APPLICATION',
          tracking: false,
          state: {
            descriptor: {
              ...statusCode
            },
            updated_at: new Date().toISOString(),
          },
          agent: {
            "person": {
              "name": "Ekstep Foundation SPoc"
            },
            "contact": {
              "email": "ekstepsupport@ekstep.com"
            },
          },
          customer: {
            "id": "aadhaar:798677675565",
            "person": {
              "name": "Jane Doe",
              "age": "13",
              "gender": "female"
            },
            "contact": {
              "phone": "+91-9663088848",
              "email": "jane.doe@example.com"
            }
          }
        }],
        quote: {
          price: {
            currency: 'INR',
            value: '123',
          },
          breakup: [
            {
              title: 'Tuition Fee',
              price: {
                currency: 'INR',
                value: '123',
              },
            }
          ]
        },
      };
      let mappedResponse;
      if (benefitData?.data) {
        mappedResponse = await this.transformScholarshipsToOnestFormat(
          statusDto,
          [benefitData?.data?.data],
          'on_status',
        );

      }

			const { id, descriptor, items, rateable }: any = mappedResponse?.message
				.catalog.providers?.[0] ?? {
				id: null,
				descriptor: null,
				items: [],
				rateable: false,
			};

			// Construct the final response
			statusData['message'] = {
				order: {
					provider: { id, descriptor, rateable },
					items,
					id: orderId || '',
					...metadata,
				},
			};

			statusData['context'] = {
				...statusDto.context,
				...mappedResponse?.context,
			};

			return statusData;
		} catch (error) {
			if (error.isAxiosError) {
				// Handle AxiosError and rethrow as HttpException
				throw new HttpException(
					error.response?.data?.message ?? 'Benefit not found',
					error.response?.status ?? HttpStatus.NOT_FOUND,
				);
			}

			console.error('Error in status:', error);
			throw new InternalServerErrorException('Failed to fetch benefit status');
		}
	}

	// Function to check if the BAP ID and URI are valid
	checkBapIdAndUri(bapId: string, bapUri: string) {
		if (!bapId || !bapUri) {
			throw new BadRequestException('Invalid BAP ID or URI');
		}

		this.bapId = bapId;
		this.bapUri = bapUri;
	}

  async transformScholarshipsToOnestFormat(reqData, apiResponseArray: any[], action?) {
    if (!Array.isArray(apiResponseArray)) {
      throw new Error('Expected an array of benefits');
    }

		const items = await Promise.all(
			apiResponseArray.map(async (benefit) => {
				const {
					title,
					longDescription,
					applicationOpenDate,
					applicationCloseDate,
					eligibility,
					documents,
					benefits,
					exclusions,
					sponsoringEntities,
					applicationForm,
					documentId,
				} = benefit;

				const [
					eligibilityTags,
					documentTags,
					benefitTags,
					exclusionTags,
					sponsoringEntitiesTags,
					applicationFormTags,
				] = await Promise.all([
					this.formatEligibilityTags(eligibility),
					this.formatDocumentTags(documents),
					this.formatBenefitTags(benefits),
					this.formatExclusionTags(exclusions),
					this.formatSponsoringEntities(sponsoringEntities),
					this.formatApplicationForm(applicationForm),
				]);

        return {
          id: documentId,
          descriptor: {
            name: title,
            long_desc: longDescription,
          },
          price: {
            currency: 'INR',
            value: await this.calculateTotalBenefitValue(benefits), // await here!
          },
          time: {
            range: {
              start: new Date(applicationOpenDate).toISOString(),
              end: new Date(applicationCloseDate).toISOString(),
            },
          },
          rateable: false,
          tags: [
            eligibilityTags,
            documentTags,
            benefitTags,
            exclusionTags,
            sponsoringEntitiesTags,
            applicationFormTags,
          ]
            .filter(Boolean)
            .flat() as TagDto[],
        };
      }),
    );

		const firstScholarship = apiResponseArray[0];

    return {
      context: {
        version: '1.1.0',
        ttl: 'PT10M',
        ...reqData.context,
        domain: this.domain,
        action: action,
        transaction_id: uuidv4(),
        message_id: uuidv4(),
        timestamp: new Date().toISOString(),
        bap_id: this.bapId,
        bap_uri: this.bapUri,
        bpp_id: this.bppId,
        bpp_uri: this.bppUri,
      },
      message: {
        catalog: {
          descriptor: {
            name: this.bppId,
          },
          providers: [
            {
              id: this.bppId,
              descriptor: {
                name:
                  firstScholarship?.providingEntity?.name ?? 'Unknown Provider',
                short_desc: 'Multiple scholarships offered',
                images: firstScholarship?.imageUrl
                  ? [firstScholarship.imageUrl]
                  : [],
              },
              categories: [
                {
                  id: 'CAT_SCHOLARSHIP',
                  descriptor: {
                    code: 'scholarship',
                    name: 'Scholarship',
                  },
                },
              ],
              fulfillments: [
                {
                  id: 'FULFILL_UNIFIED',
                  tracking: false,
                },
              ],
              locations: [
                {
                  id: 'L1',
                  city: {
                    name: 'Pune',
                    code: 'std:020',
                  },
                  state: {
                    name: 'Maharashtra',
                    code: 'MH',
                  },
                },
              ],
              items,
            },
          ],
        },
      },
    };
  }

	// Calculate a rough total of monetary benefits if known
	async calculateTotalBenefitValue(benefits) {
		let total = 0;
		benefits.forEach((benefit) => {
			const matches = benefit.description.match(/₹([\d,]+)/g);
			if (matches) {
				matches.forEach((amount) => {
					total += parseInt(amount.replace(/[₹,]/g, ''), 10);
				});
			}
		});
		return total.toString();
	}

	async formatEligibilityTags(eligibility) {
		if (!eligibility?.length) return null;

		return {
			display: true,
			descriptor: {
				code: 'eligibility',
				name: 'Eligibility',
			},
			list: eligibility.map((e) => ({
				descriptor: {
					code: e.evidence,
					name:
						e.type.charAt(0).toUpperCase() +
						e.type.slice(1) +
						' - ' +
						e.evidence,
					short_desc: e.description,
				},
				value: JSON.stringify(e),
				display: true,
			})),
		};
	}

	async formatDocumentTags(documents) {
		if (!documents?.length) return null;

		return {
			display: true,
			descriptor: {
				code: 'required-docs',
				name: 'Required Documents',
			},
			list: documents.map((doc) => ({
				descriptor: {
					code: doc.isRequired ? 'mandatory-doc' : 'optional-doc',
					name: doc.isRequired ? 'Mandatory Document' : 'Optional Document',
				},
				value: JSON.stringify(doc),
				display: true,
			})),
		};
	}

	async formatBenefitTags(benefits) {
		if (!benefits?.length) return null;

		return {
			display: true,
			descriptor: {
				code: 'benefits',
				name: 'Benefits',
			},
			list: benefits.map((b) => ({
				descriptor: {
					code: 'financial',
					name: b.title,
				},
				value: JSON.stringify(b),
				display: true,
			})),
		};
	}

	async formatExclusionTags(exclusions) {
		if (!exclusions?.length) return null;

		return {
			display: true,
			descriptor: {
				code: 'exclusions',
				name: 'Exclusions',
			},
			list: exclusions.map((e) => ({
				descriptor: {
					code: 'ineligibility',
					name: 'Ineligibility Condition',
				},
				value: JSON.stringify(e),
				display: true,
			})),
		};
	}

	async formatSponsoringEntities(sponsoringEntities) {
		if (!sponsoringEntities?.length) return null;

		return {
			display: true,
			descriptor: {
				code: 'sponsoringEntities',
				name: 'Sponsoring Entities',
			},
			list: sponsoringEntities.map((sponsoringEntity) => ({
				descriptor: {
					code: 'sponsoringEntities',
					name: 'Entities Sponsoring Benefits',
				},
				value: JSON.stringify(sponsoringEntity),
				display: true,
			})),
		};
	}

	async formatApplicationForm(applicationForm: any) {
		if (!applicationForm?.length) return null;

		// Flatten all fields from all field groups
		const allFields: any[] = [];
		
		applicationForm.forEach((fieldGroup: any) => {
			if (fieldGroup.fields && Array.isArray(fieldGroup.fields)) {
				fieldGroup.fields.forEach((field: any) => {
					// Add fieldsGroupName and fieldsGroupLabel to each field
					const enrichedField = {
						...field,
						fieldsGroupName: fieldGroup.fieldsGroupName,
						fieldsGroupLabel: fieldGroup.fieldsGroupLabel
					};
					allFields.push(enrichedField);
				});
			}
		});

		return {
			display: true,
			descriptor: {
				code: 'applicationForm',
				name: 'Application Form',
			},
			list: allFields.map((field) => ({
				descriptor: {
					code: 'applicationFormField-' + field.name,
					name: 'Application Form Field - ' + field.label,
				},
				value: JSON.stringify(field),
				display: true,
			})),
		};
	}

	async init2(initRequestDto: any): Promise<any> {		
		// Validate BAP ID and URI
		this.checkBapIdAndUri(
			initRequestDto?.context?.bap_id,
			initRequestDto?.context?.bap_uri,
		);

		try {
		// Extract applicationData from the payload
		const applicationData = initRequestDto?.message?.order?.tags?.applicationData;
		
		if (applicationData) {
			console.log('Extracted applicationData:', JSON.stringify(applicationData, null, 2));
		} else {
			console.log('No applicationData found in payload');
			throw new BadRequestException('ApplicationData is required in payload');
		}

		const benefitId = initRequestDto.message.order.items[0].id;

		// Add bapId to applicationData for application creation
		const applicationDataWithContext = {
			...applicationData,
			bapId: initRequestDto.context.bap_id,
		};

		console.log('Creating application with payload:', JSON.stringify(applicationDataWithContext, null, 2));
		
		// Create the application and get the real applicationId
		const createdApplication = await this.applicationsService.create(applicationDataWithContext);
		const applicationId = createdApplication.application.id;

		console.log('Created application with ID:', applicationId);

		// Fetch benefit data from the Strapi API
		const benefitData = await this.getBenefitsByIdStrapi(benefitId);

		let mappedResponse;

		if (benefitData?.data) {
			mappedResponse = await this.transformScholarshipsToOnestFormat(
				initRequestDto,
				[benefitData?.data?.data],
				'on_init',
			);
		}

		const { id, descriptor, categories, locations, items, rateable }: any =
			mappedResponse?.message.catalog.providers?.[0] ?? {};

		// Add real applicationId to the first item
		items[0].applicationId = applicationId;

			initRequestDto.message.order = {
				...initRequestDto.message.order,
				// Ensure the object matches the InitOrderDto type
				providers: [{ id, descriptor, rateable, locations, categories }],
				items,
			};

			initRequestDto.context = {
				...initRequestDto.context,
				...mappedResponse?.context,
			};

			return initRequestDto;
		} catch (error) {
			if (error.isAxiosError) {
				// Handle AxiosError and rethrow as HttpException
				throw new HttpException(
					error.response?.data?.message ?? 'Benefit not found',
					error.response?.status ?? HttpStatus.NOT_FOUND,
				);
			}

			console.error('Error in init2:', error);
			throw new InternalServerErrorException('Failed to initialize benefit');
		}
	}
}
