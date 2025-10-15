import { IsNotEmpty, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({ description: 'ID of the item', example: 'SCM_63587501' })
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

  @ApiProperty({ description: 'Time range of the item', type: TimeRangeDto })
  @ValidateNested()
  @Type(() => TimeRangeDto)
  time: TimeRangeDto;

  @ApiProperty({ description: 'Rateable flag', example: false })
  @IsNotEmpty()
  rateable: boolean;

  @ApiProperty({ description: 'Tags associated with the item', type: [TagDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TagDto)
  tags: TagDto[];

  @ApiProperty({ description: 'Fulfillment IDs', type: [String], example: ['VSP_FUL_1113'] })
  @IsArray()
  @IsNotEmpty()
  fulfillment_ids: string[];
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

class BillingDto {
  @ApiProperty({ description: 'Name of the billing entity', example: 'Manjunath' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Organization details', type: Object })
  @IsNotEmpty()
  organization: {
    descriptor: DescriptorDto;
    contact: { phone: string; email: string };
  };

  @ApiProperty({ description: 'Billing address', example: 'No 27, XYZ Lane, etc' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'Billing phone number', example: '+91-9999999999' })
  @IsString()
  @IsNotEmpty()
  phone: string;
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
  @ApiProperty({ description: 'State of the fulfillment', type: FulfillmentStateDto })
  @ValidateNested()
  @Type(() => FulfillmentStateDto)
  state: FulfillmentStateDto;

  @ApiProperty({ description: 'Fulfillment ID', example: 'VSP_FUL_1113' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Fulfillment type', example: 'SCHOLARSHIP' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Tracking flag', example: false })
  @IsNotEmpty()
  tracking: boolean;

  @ApiProperty({ description: 'Agent details', type: Object })
  @IsNotEmpty()
  agent: {
    person: { name: string };
    contact: { email: string };
  };

  @ApiProperty({ description: 'Customer details', type: Object })
  @IsNotEmpty()
  customer: {
    id: string;
    person: { name: string; age: string; gender: string };
    contact: { phone: string; email: string };
  };
}

class PaymentParamsDto {
  @ApiProperty({ description: 'Bank code', example: 'IFSC_Code_Of_the_bank' })
  @IsString()
  @IsNotEmpty()
  bank_code: string;

  @ApiProperty({ description: 'Bank account number', example: '121212121212' })
  @IsString()
  @IsNotEmpty()
  bank_account_number: string;

  @ApiProperty({ description: 'Bank account name', example: 'Account Holder Name' })
  @IsString()
  @IsNotEmpty()
  bank_account_name: string;
}

class PaymentDto {
  @ApiProperty({ description: 'Payment parameters', type: PaymentParamsDto })
  @ValidateNested()
  @Type(() => PaymentParamsDto)
  params: PaymentParamsDto;
}

class QuoteBreakupDto {
  @ApiProperty({ description: 'Title of the breakup', example: 'Tution fee' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Price details', type: PriceDto })
  @ValidateNested()
  @Type(() => PriceDto)
  price: PriceDto;
}

class QuoteDto {
  @ApiProperty({ description: 'Total price', type: PriceDto })
  @ValidateNested()
  @Type(() => PriceDto)
  price: PriceDto;

  @ApiProperty({ description: 'Breakup of the quote', type: [QuoteBreakupDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteBreakupDto)
  breakup: QuoteBreakupDto[];
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

  @ApiProperty({ description: 'BAP ID', example: 'sample.bap.io' })
  @IsString()
  @IsNotEmpty()
  bap_id: string;

  @ApiProperty({ description: 'BAP URI', example: 'https://sample.bap.io' })
  @IsString()
  @IsNotEmpty()
  bap_uri: string;

  @ApiProperty({ description: 'BPP ID', example: 'sample.bpp.io' })
  @IsString()
  @IsNotEmpty()
  bpp_id: string;

  @ApiProperty({ description: 'BPP URI', example: 'https://sample.bpp.io' })
  @IsString()
  @IsNotEmpty()
  bpp_uri: string;

  @ApiProperty({ description: 'Transaction ID', example: 'a9aaecca-10b7-4d19-b640-b047a7c60008' })
  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @ApiProperty({ description: 'Message ID', example: 'f6a7d7ea-a23e-4419-b07e-a3412fdffecf' })
  @IsString()
  @IsNotEmpty()
  message_id: string;
}



export class StatusResponseDto {
  @ApiProperty({ description: 'Context of the request', type: ContextDto })
  @ValidateNested()
  @Type(() => ContextDto)
  context: ContextDto;


}