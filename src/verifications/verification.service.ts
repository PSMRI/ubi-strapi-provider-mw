import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { VerifyApplicationVcsResponseDto } from './dtos';
import { PrismaService } from '../prisma.service';
import { IFileStorageService } from '../services/storage-providers/file-storage.service.interface';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    @Inject('FileStorageService')
    private readonly fileStorageService: IFileStorageService,
  ) { }

  async verifyApplicationVcs(payload: { applicationId: string, applicationFileIds?: string[] }): Promise<{
    isSuccess: boolean;
    code: number;
    response: VerifyApplicationVcsResponseDto;
  }> {
    const { applicationId, applicationFileIds } = payload;

    if (!applicationId) {
      return this.buildResponse(false, 400, 'Application ID is required', applicationId, [], 'unverified');
    }

    let applicationFiles;
    if (applicationFileIds && applicationFileIds.length > 0) {
      // Validate that all IDs are valid numbers
      const invalidIds = applicationFileIds.filter(id => isNaN(Number(id)));
      if (invalidIds.length > 0) {
        return this.buildResponse(false, 400, `Invalid file IDs provided: ${invalidIds.join(', ')}`, applicationId, [], 'unverified');
      }
      // Fetch only the specified application files
      applicationFiles = await this.getApplicationFilesByIds(applicationFileIds.map(id => Number(id)), Number(applicationId));
    } else {
      // Fetch all files for the application
      applicationFiles = await this.getApplicationFilesByApplicationId(Number(applicationId));
    }

    if (!applicationFiles || applicationFiles.length === 0) {
      return this.buildResponse(false, 404, 'No application files found for the given application ID', applicationId, [], 'unverified');
    }

    const apiUrl = process.env.VERIFICATION_SERVICE_URL;
    if (!apiUrl) {
      return this.buildResponse(false, 500, 'VERIFICATION_SERVICE_URL is not defined in environment variables', applicationId, [], 'unverified');
    }

    const verificationResults: {
      id: any;
      filePath: string | null;
      isValid: boolean;
      message: string;
    }[] = [];

    for (const file of applicationFiles) {
      if (!file.filePath) {
        verificationResults.push({
          id: file.id,
          filePath: null,
          isValid: false,
          message: 'File path is missing for this application file.',
        });

        await this.prisma.applicationFiles.update({
          where: { id: file.id },
          data: {
            verificationStatus: {
              status: 'Unverified',
              verificationErrors: ['File path is missing.'],
            },
          },
        });
        continue;
      }

      try {
        // Use fileStorageService for all storage types
        const fileContent = await this.fileStorageService.getFile(file.filePath);
        console.log(`Verifying file: ${file.filePath}`);

        if (!fileContent) {
          throw new Error('Failed to read file content from storage.');
        }

        // Convert Buffer to string first
        const fileContentString = fileContent.toString();

        // Try to detect if the content is URL-encoded
        let content = fileContentString;
        if (fileContentString.trim().startsWith('%')) {
          try {
            content = decodeURIComponent(fileContentString);
          } catch (decodeError) {
            console.error('Failed to decode URI component:', decodeError.message);
            throw decodeError;
          }
        }

        let parsedData;
        try {
          parsedData = JSON.parse(content);
        } catch (parseError) {
          console.error('Failed to parse JSON file:', parseError.message);
          throw parseError;
        }
        const DEFAULT_ISSUER_NAME = (file.issuerName || process.env.DEFAULT_ISSUER_NAME?.trim()) || 'dhiway';
        let issuerName = file.issuerName;
        if (!issuerName || typeof issuerName !== 'string' || issuerName.trim() === '') {
          issuerName = DEFAULT_ISSUER_NAME;
        }

        const response = await lastValueFrom(
          this.httpService.post(apiUrl, {
            credential: parsedData,
            config: {
              method: "online",
              issuerName: issuerName,
            }
          })
        );

        const isValid = response?.data?.success ?? false;
        const message = isValid
          ? response.data.message ?? 'Credential verified successfully.'
          : `${response.data.message ?? 'Verification failed.'} Errors: ${(response.data.errors?.map((err: any) => err.error) ?? ['Unknown error']).join(', ')
          }`;

        verificationResults.push({
          id: file.id,
          filePath: file.filePath,
          isValid,
          message,
        });

        await this.prisma.applicationFiles.update({
          where: { id: file.id },
          data: {
            verificationStatus: {
              status: isValid ? 'Verified' : 'Unverified',
              ...(isValid ? {} : {
                verificationErrors: response.data.errors
                  ? response.data.errors.map((err: any) => ({
                    error: err.error,
                    raw: err.raw,
                  }))
                  : [{ error: 'Unknown error', raw: null }],
              }),
            },
          },
        });
      } catch (error: any) {
        verificationResults.push({
          id: file.id,
          filePath: file.filePath,
          isValid: false,
          message: `Error: ${error.message}`,
        });

        // Try to extract error response from API if available
        let verificationErrors;
        if (error?.response?.data?.errors) {
          verificationErrors = error.response.data.errors.map((err: any) => ({
            error: err.error,
            raw: err.raw,
          }));
        } else {
          verificationErrors = [{ error: error.message, raw: error?.response?.data ?? null }];
        }

        await this.prisma.applicationFiles.update({
          where: { id: file.id },
          data: {
            verificationStatus: {
              status: 'Unverified',
              verificationErrors,
            },
          },
        });
      }
    }

    const files: {
      id: any;
      filePath: string | null;
      status: 'verified' | 'unverified';
      message: string;
    }[] = verificationResults.map(result => ({
      id: result.id,
      filePath: result.filePath,
      status: result.isValid ? 'verified' : 'unverified',
      message: result.message,
    }));

    const total = files.length;
    const successCount = files.filter(file => file.status === 'verified').length;
    const allSuccessful = successCount === total;
    const partialSuccess = successCount > 0 && successCount < total;

    let status: 'verified' | 'partially_verified' | 'unverified';
    if (allSuccessful) {
      status = 'verified';
    } else if (partialSuccess) {
      status = 'partially_verified';
    } else {
      status = 'unverified';
    }

    let code: number;
    if (allSuccessful) {
      code = 200;
    } else if (partialSuccess) {
      code = 207;
    } else {
      code = 422;
    }
    let message: string;
    if (allSuccessful) {
      message = 'Verification completed successfully';
    } else if (partialSuccess) {
      message = 'Verification completed with some errors';
    } else {
      message = 'Verification failed';
    }

    await this.prisma.applications.update({
      where: { id: Number(applicationId) },
      data: {
        documentVerificationStatus: status,
      },
    });

    return this.buildResponse(allSuccessful, code, message, applicationId, files, status);
  }

  private async getApplicationFilesByApplicationId(applicationId: number) {
    return this.prisma.applicationFiles.findMany({
      where: { applicationId },
    });
  }

  private async getApplicationFilesByIds(applicationFileIds: number[], applicationId: number) {
    return this.prisma.applicationFiles.findMany({
      where: {
        id: { in: applicationFileIds },
        applicationId,
      },
    });
  }

  private buildResponse(
    isSuccess: boolean,
    code: number,
    message: string,
    applicationId: string,
    files: { id: any; filePath: string | null; status: 'verified' | 'unverified'; message: string }[],
    status: 'verified' | 'partially_verified' | 'unverified' = 'unverified'
  ) {
    return {
      isSuccess,
      code,
      response: {
        applicationId,
        status,
        message,
        files,
      },
    };
  }
}
