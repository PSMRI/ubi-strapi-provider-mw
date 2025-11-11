import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum ApplicationStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IN_PROGRESS = 'in_progress',
  RESUBMIT = 'resubmit'
}

export class UpdateApplicationStatusDto {
  @ApiProperty({
    description: 'New status for the application',
    example: 'approved',
    required: true,
    enum: ApplicationStatus,
    enumName: 'ApplicationStatus'
  })
  @IsEnum(ApplicationStatus, {
    message: `Status must be one of: ${Object.values(ApplicationStatus).join(', ')}`
  })
  status: ApplicationStatus;

  @ApiProperty({
    description: 'Remark for the status change',
    example: 'Application approved successfully',
    required: true
  })
  remark: string;
}

export class UpdateApplicationActionLogDto {
  @ApiProperty({
    description: 'Operating system of the user',
    example: 'Windows 10',
  })
  os?: string;

  @ApiProperty({
    description: 'Browser used by the user',
    example: 'Chrome 113.0.5672.127',
  })
  browser?: string;

  @ApiProperty({
    description: 'IP address of the user',
    example: '192.168.1.1',  //NOSONAR  
  })
  ip?: string;

  @ApiProperty({
    description: 'New status for the application',
    example: 'approved',
    required: true,
    enum: ApplicationStatus,
    enumName: 'ApplicationStatus',
  })
  @IsEnum(ApplicationStatus, {
    message: `Status must be one of: ${Object.values(ApplicationStatus).join(', ')}`,
  })
  status?: ApplicationStatus;

  @ApiProperty({
    description: 'Remark for the status change',
    example: 'Application approved successfully',
    required: true,
  })
  remark?: string;

  @ApiProperty({
    description: 'ID of the user who updated the application',
    example: '12345',
  })
  updatedBy: number;

  @ApiProperty({
    description: 'Timestamp when the application was updated',
    example: '2025-05-14T12:34:56Z',
  })
  updatedAt: Date;
}