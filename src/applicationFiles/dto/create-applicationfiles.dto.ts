import { IsNotEmpty, IsObject, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicationFilesDto {
  
  @ApiProperty({
    description: 'The ID of the related application',
    example: 1,
  })
  @IsNotEmpty()
  applicationId: number;

  @ApiPropertyOptional({
    description: 'Additional application data in JSON format',
    example: { key: 'value' },
  })
  @IsOptional()
  @IsObject()
  verificationStatus?: Record<string, any>;

  // New VC document metadata fields
  @ApiPropertyOptional({
    description: 'Array of reasons for document submission',
    example: ['disabilityType', 'disabilityRange'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentSubmissionReason?: string[];

  @ApiPropertyOptional({
    description: 'Document subtype classification',
    example: 'disabilityCertificate',
  })
  @IsOptional()
  @IsString()
  documentSubtype?: string;

  @ApiPropertyOptional({
    description: 'Primary document category',
    example: 'disabilityProof',
  })
  @IsOptional()
  @IsString()
  documentType?: string;
}