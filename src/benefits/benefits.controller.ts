import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchRequestDto } from './dto/search-request.dto';
import { BenefitsService } from './benefits.service';
import { AllExceptionsFilter } from 'src/common/filters/exception.filters';
import { InitRequestDto } from './dto/init-request.dto';

@UseFilters(new AllExceptionsFilter())
@ApiTags('Benefits') // Grouping the APIs under the "Benefits" tag in Swagger
@Controller('benefits')
export class BenefitsController {
  constructor(private readonly benefitsService: BenefitsService) {}

  @ApiOperation({
    summary: 'Get Benefits by ID',
    description: 'Fetch benefits by their unique identifier.',
  })
  @Get('getById/:docid')
  @HttpCode(HttpStatus.OK)
  getBenefitsById(@Param('docid') id: string): any {
    return this.benefitsService.getBenefitsById(id);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search Benefits',
    description:
      'Search for benefits based on the provided context and message.',
  })
  searchBenefits(@Body() searchRequestDto: SearchRequestDto): any {
    return this.benefitsService.getBenefits(searchRequestDto);
  }

  // Network api's routes

  @Post('dsep/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search Benefits',
    description:
      'Search for benefits based on the provided context and message.',
  })
  searchBenefitsNetwork(@Body() searchRequestDto: SearchRequestDto): any {
    return this.benefitsService.searchBenefits(searchRequestDto);
  }

  @ApiOperation({
    summary: 'Get Benefits by ID',
    description: 'Fetch benefits by their unique identifier.',
  })
  @Get('dsep/select/:id')
  @HttpCode(HttpStatus.OK)
  selectBenefitsNetwork(@Param('id') id: string): any {
    return this.benefitsService.selectBenefitsById(id);
  }

  @Post('dsep/init')
  @ApiOperation({
    summary: 'Initialize Course',
    description: 'Handles the initialization of a course based on the provided data.',
  })
  async init(@Body() initRequestDto: InitRequestDto) {
    return this.benefitsService.init(initRequestDto);
  }
}
