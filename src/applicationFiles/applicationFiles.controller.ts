import { Controller, Get, Post, Body, Param, Patch, UseFilters, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ApplicationFilesService } from './applicationFiles.service';
import { CreateApplicationFilesDto } from './dto/create-applicationfiles.dto';
import { UpdateApplicationFilesDto } from './dto/update-applicationfiles.dto';
import { AllExceptionsFilter } from 'src/common/filters/exception.filters';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApplicationFilesApiDocs } from '../docs';

@UseFilters(new AllExceptionsFilter())
@ApiBearerAuth('access-token')
@ApiTags('ApplicationFiles')
@Controller('application-files')
export class ApplicationFilesController {
  constructor(private readonly ApplicationFilesService: ApplicationFilesService) {}

  // Create a new ApplicationFile
  @Post()
  @UseGuards(AuthGuard)
  @ApiExcludeEndpoint()
  @ApiOperation(ApplicationFilesApiDocs.create.operation)
  @ApiBody(ApplicationFilesApiDocs.create.body)
  @ApiResponse(ApplicationFilesApiDocs.create.responses.success)
  @ApiResponse(ApplicationFilesApiDocs.create.responses.badRequest)
  async create(@Body() data: CreateApplicationFilesDto) {
    const applicationFileData: Prisma.ApplicationFilesUncheckedCreateInput = {
      ...data,
      storage: 'local' // Provide a default or ensure 'storage' is included
    };
    return this.ApplicationFilesService.create(applicationFileData);
  }

  // Get all ApplicationFiles
  @Get()
  @UseGuards(AuthGuard)
  @ApiExcludeEndpoint()
  @ApiOperation(ApplicationFilesApiDocs.findAll.operation)
  @ApiResponse(ApplicationFilesApiDocs.findAll.responses.success)
  async findAll() {
    return this.ApplicationFilesService.findAll();
  }

  // Get a single ApplicationFile by ID
  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiExcludeEndpoint()
  @ApiOperation(ApplicationFilesApiDocs.findOne.operation)
  @ApiParam(ApplicationFilesApiDocs.findOne.param)
  @ApiResponse(ApplicationFilesApiDocs.findOne.responses.success)
  @ApiResponse(ApplicationFilesApiDocs.findOne.responses.notFound)
  async findOne(@Param('id') id: string) {
    return this.ApplicationFilesService.findOne(Number(id));
  }

  // Update an ApplicationFile by ID
  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiExcludeEndpoint()
  @ApiOperation(ApplicationFilesApiDocs.update.operation)
  @ApiParam(ApplicationFilesApiDocs.update.param)
  @ApiBody(ApplicationFilesApiDocs.update.body)
  @ApiResponse(ApplicationFilesApiDocs.update.responses.success)
  @ApiResponse(ApplicationFilesApiDocs.update.responses.badRequest)
  @ApiResponse(ApplicationFilesApiDocs.update.responses.notFound)
  async update(@Param('id') id: string, @Body() data: UpdateApplicationFilesDto) {
    return this.ApplicationFilesService.update(Number(id), data);
  }
}
