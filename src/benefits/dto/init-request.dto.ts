import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BENEFIT_CONSTANTS } from '../benefit.constants';
class InitContextDto {
  @ApiProperty({ description: 'Domain of the request', example: BENEFIT_CONSTANTS.FINANCE })
  @IsString()
  @IsNotEmpty()
  domain: string;

  @ApiProperty({ description: 'Action to be performed', example: 'init' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ description: 'Version of the API', example: '1.1.0' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({ description: 'BPP ID', example: 'dev-uba-bpp.com' })
  @IsString()
  @IsNotEmpty()
  bpp_id: string;

  @ApiProperty({ description: 'BPP URI', example: 'https://dev-uba-bpp.com/' })
  @IsString()
  @IsNotEmpty()
  bpp_uri: string;

  @ApiProperty({ description: 'Country code', example: 'IND' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ description: 'City code', example: 'std:080' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ description: 'BAP ID', example: 'dev-uba-bap.com' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  bap_id: string;

  @ApiProperty({ description: 'BAP URI', example: 'https://dev-uba-bap.com/' })
  @IsString()
  @IsNotEmpty()
  bap_uri: string;

  @ApiProperty({ description: 'Transaction ID', example: '0e6c7f7f-d15f-4bb4-9ccd-cf71de9a5179' })
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @ApiProperty({ description: 'Message ID', example: 'd7fab278-4741-4cf1-be7c-796c4ef45273' })
  @IsString()
  @IsNotEmpty()
  message_id: string;

  @ApiProperty({ description: 'Time-to-live for the request', example: 'PT10M' })
  @IsString()
  @IsNotEmpty()
  ttl: string;

  @ApiProperty({ description: 'Timestamp of the request', example: '2024-12-09T07:15:17.723Z' })
  @IsString()
  @IsNotEmpty()
  timestamp: string;
}

class InitItemDto {
  @ApiProperty({ description: 'Item ID', example: 'giyuvihjvhv' })
  @IsString()
  @IsNotEmpty()
  id: string;
}

class InitOrderDto {
  @ApiProperty({ description: 'List of items in the order', type: [InitItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitItemDto)
  items: InitItemDto[];

  @ApiPropertyOptional({ description: 'List of providers' })
  @IsOptional()
  providers?: any[];

  @ApiProperty({ description: 'List of fulfillments' })
  @IsArray()
  fulfillments: any[];
}

class InitMessageDto {
  @ApiProperty({ description: 'Order details', type: InitOrderDto })
  @ValidateNested()
  @Type(() => InitOrderDto)
  order: InitOrderDto;
}

export class InitRequestDto {
  @ApiProperty({ description: 'Context of the request', type: InitContextDto })
  @ValidateNested()
  @Type(() => InitContextDto)
  context: InitContextDto;

  @ApiProperty({ description: 'Message containing the order details', type: InitMessageDto })
  @ValidateNested()
  @Type(() => InitMessageDto)
  message: InitMessageDto;
}