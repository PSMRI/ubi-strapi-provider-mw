import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApplicationStatus } from './update-application-status.dto';

export class CsvExportApplicationsDto {
  @ApiProperty({
    description: 'Benefit ID to filter applications',
    required: true,
    example: 'benefit-123'
  })
  @IsString()
  @IsNotEmpty()
  benefitId: string;

  @ApiProperty({
    description: 'Type of report (as per reports.json)',
    required: true,
    example: 'benefit_amounts'
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: 'Filter by application status',
    required: false,
    type: [String],
    enum: ApplicationStatus,
    example: ['pending', 'approved'],
    isArray: true
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    // Handle both array and single string values
    if (Array.isArray(value)) {
      return value;
    }
    // Convert single string to array
    return [value];
  })
  @IsArray()
  @IsEnum(ApplicationStatus, { each: true })
  status?: ApplicationStatus[];
} 