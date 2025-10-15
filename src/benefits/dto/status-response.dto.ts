import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BENEFIT_CONSTANTS } from '../benefit.constants';

class DescriptorDto {
  @ApiProperty({ description: 'Code of the descriptor', example: 'background-eligibility' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Name of the descriptor', example: 'Background eligibility' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Short description', example: 'Short description about the descriptor' })
  @IsString()
  short_desc?: string;
}

class TagListDto {
  @ApiProperty({ description: 'Descriptor object', type: DescriptorDto })
  @ValidateNested()
  @Type(() => DescriptorDto)
  descriptor: DescriptorDto;

  @ApiProperty({ description: 'Value of the tag', example: 'SC' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ description: 'Display flag', example: true })
  @IsNotEmpty()
  display: boolean;
}

class TagDto {
  @ApiProperty({ description: 'Descriptor object', type: DescriptorDto })
  @ValidateNested()
  @Type(() => DescriptorDto)
  descriptor: DescriptorDto;

  @ApiProperty({ description: 'List of tag values', type: [TagListDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TagListDto)
  list: TagListDto[];

  @ApiProperty({ description: 'Display flag', example: true })
  @IsNotEmpty()
  display: boolean;
}

class PriceDto {
  @ApiProperty({ description: 'Currency of the price', example: 'INR' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ description: 'Value of the price', example: '1000' })
  @IsString()
  @IsNotEmpty()
  value: string;
}

class TimeRangeDto {
  @ApiProperty({ description: 'Start time', example: '2023-01-03T13:23:01+00:00' })
  @IsString()
  @IsNotEmpty()
  start: string;

  @ApiProperty({ description: 'End time', example: '2023-02-03T13:23:01+00:00' })
  @IsString()
  @IsNotEmpty()
  end: string;
}

class ItemDto {
  @ApiProperty({ description: 'ID of the item (benefit documentId)', example: 'psp2q73amab8spwtlx3hj26s' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Descriptor of the item', type: DescriptorDto })
  @ValidateNested()
  @Type(() => DescriptorDto)
  descriptor: DescriptorDto;

  @ApiProperty({ description: 'Price of the item', type: PriceDto })
  @ValidateNested()
  @Type(() => PriceDto)
  price: PriceDto;

  @ApiProperty({ description: 'Time range of the item (application open/close dates)', type: Object })
  @ValidateNested()
  @Type(() => TimeRangeDto)
  time: { range: TimeRangeDto };

  @ApiProperty({ description: 'Rateable flag', example: false })
  @IsNotEmpty()
  rateable: boolean;

  @ApiPropertyOptional({ 
    description: 'Tags associated with the item (excluded in status response for performance)', 
    type: [TagDto],
    required: false
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  tags?: TagDto[];
}

class ProviderDto {
  @ApiProperty({ description: 'ID of the provider', example: '471' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Descriptor of the provider', type: DescriptorDto })
  @ValidateNested()
  @Type(() => DescriptorDto)
  descriptor: DescriptorDto;

  @ApiProperty({ description: 'Rateable flag', example: false })
  @IsNotEmpty()
  rateable: boolean;
}

class FulfillmentStateDto {
  @ApiProperty({ description: 'Descriptor of the state', type: DescriptorDto })
  @ValidateNested()
  @Type(() => DescriptorDto)
  descriptor: DescriptorDto;

  @ApiProperty({ description: 'Updated timestamp', example: '2023-02-06T09:55:41.161Z' })
  @IsString()
  @IsNotEmpty()
  updated_at: string;
}

class FulfillmentDto {
  @ApiProperty({ description: 'Fulfillment ID', example: 'FULFILL_UNIFIED' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Fulfillment type', example: 'APPLICATION' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Tracking flag', example: false })
  @IsNotEmpty()
  tracking: boolean;

  @ApiProperty({ description: 'State of the fulfillment with status information', type: FulfillmentStateDto })
  @ValidateNested()
  @Type(() => FulfillmentStateDto)
  state: FulfillmentStateDto;
}


class LocationDto {
  @ApiPropertyOptional({ description: 'Country information', type: Object })
  @IsOptional()
  country?: {
    name: string;
    code: string;
  };

  @ApiPropertyOptional({ description: 'City information', type: Object })
  @IsOptional()
  city?: {
    name: string;
    code: string;
  };
}

class ContextDto {
  @ApiProperty({ description: 'Domain of the request', example: BENEFIT_CONSTANTS.FINANCE })
  @IsString()
  @IsNotEmpty()
  domain: string;

  @ApiProperty({ description: 'Action of the request', example: 'on_status' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ description: 'Timestamp of the request', example: '2023-08-02T07:21:58.448Z' })
  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @ApiProperty({ description: 'TTL of the request', example: 'PT10M' })
  @IsString()
  @IsNotEmpty()
  ttl: string;

  @ApiProperty({ description: 'Version of the API', example: '1.1.0' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({ description: 'BAP ID', example: 'dev-uba-bap.tekdinext.com' })
  @IsString()
  @IsNotEmpty()
  bap_id: string;

  @ApiProperty({ description: 'BAP URI', example: 'https://dev-uba-bap.tekdinext.com' })
  @IsString()
  @IsNotEmpty()
  bap_uri: string;

  @ApiProperty({ description: 'BPP ID', example: 'dev-uba-bpp.tekdinext.com' })
  @IsString()
  @IsNotEmpty()
  bpp_id: string;

  @ApiProperty({ description: 'BPP URI', example: 'https://dev-uba-bpp.tekdinext.com' })
  @IsString()
  @IsNotEmpty()
  bpp_uri: string;

  @ApiProperty({ description: 'Transaction ID', example: 'ce1e6ce8-5aba-487f-83e6-95935124e35f' })
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @ApiProperty({ description: 'Message ID', example: 'e9643853-be21-487e-9432-de07778fd24c' })
  @IsString()
  @IsNotEmpty()
  message_id: string;

  @ApiPropertyOptional({ description: 'Location information', type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}
class OrderDto {
  @ApiProperty({ description: 'Order ID from application', example: 'TLEXP_ZBQYCK_1747141815005' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Provider details', type: ProviderDto })
  @ValidateNested()
  @Type(() => ProviderDto)
  provider: ProviderDto;

  @ApiProperty({ description: 'List of benefit items (tags excluded for performance)', type: [ItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];

  @ApiProperty({ 
    description: 'List of fulfillments containing application status information', 
    type: [FulfillmentDto] 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FulfillmentDto)
  fulfillments: FulfillmentDto[];
}

class MessageDto {
  @ApiProperty({ description: 'Order details with status information', type: OrderDto })
  @ValidateNested()
  @Type(() => OrderDto)
  order: OrderDto;
}

export class StatusResponseDto {
  @ApiProperty({ 
    description: 'Context containing DSEP protocol metadata', 
    type: ContextDto 
  })
  @ValidateNested()
  @Type(() => ContextDto)
  context: ContextDto;

  @ApiProperty({ 
    description: 'Message containing order and application status', 
    type: MessageDto 
  })
  @ValidateNested()
  @Type(() => MessageDto)
  message: MessageDto;
}