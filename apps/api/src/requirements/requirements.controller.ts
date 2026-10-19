import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';
import { Requirement } from './entities/requirement.entity';
import { RequirementsService } from './requirements.service';

@Controller('projects/:projectId/requirements')
@UseGuards(JwtAuthGuard)
export class RequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() createRequirementDto: CreateRequirementDto,
  ): Promise<Requirement> {
    return this.requirementsService.create(
      request.user.id,
      projectId,
      createRequirementDto,
    );
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Requirement[]> {
    return this.requirementsService.findAll(request.user.id, projectId, query);
  }

  @Get(':requirementId')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
  ): Promise<Requirement> {
    return this.requirementsService.findOne(
      request.user.id,
      projectId,
      requirementId,
    );
  }

  @Patch(':requirementId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
    @Body() updateRequirementDto: UpdateRequirementDto,
  ): Promise<Requirement> {
    return this.requirementsService.update(
      request.user.id,
      projectId,
      requirementId,
      updateRequirementDto,
    );
  }

  @Delete(':requirementId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('requirementId', new ParseUUIDPipe()) requirementId: string,
  ): Promise<void> {
    return this.requirementsService.remove(
      request.user.id,
      projectId,
      requirementId,
    );
  }
}
