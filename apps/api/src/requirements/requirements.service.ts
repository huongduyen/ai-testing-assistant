import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';

import { ProjectsService } from '../projects/projects.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';
import { Requirement } from './entities/requirement.entity';

@Injectable()
export class RequirementsService {
  constructor(
    @InjectRepository(Requirement)
    private readonly requirementsRepository: Repository<Requirement>,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(
    userId: string,
    projectId: string,
    createRequirementDto: CreateRequirementDto,
  ): Promise<Requirement> {
    await this.projectsService.findOne(userId, projectId);

    const referenceKey =
      createRequirementDto.referenceKey ??
      createRequirementDto.externalReference ??
      null;

    try {
      const requirement = this.requirementsRepository.create({
        projectId,
        title: createRequirementDto.title,
        description: createRequirementDto.description,
        referenceKey,
      });

      const saved = await this.requirementsRepository.save(requirement);
      saved.externalReference = saved.referenceKey;
      return saved;
    } catch {
      throw new InternalServerErrorException('Unable to create requirement');
    }
  }

  async findAll(
    userId: string,
    projectId: string,
    query?: PaginationQueryDto,
  ): Promise<Requirement[]> {
    await this.projectsService.findOne(userId, projectId);

    const findOptions: FindManyOptions<Requirement> = {
      where: { projectId },
      order: { createdAt: 'DESC' },
    };

    if (query?.limit) {
      findOptions.take = query.limit;
      if (query?.page) {
        findOptions.skip = (query.page - 1) * query.limit;
      }
    }

    try {
      const items = await this.requirementsRepository.find(findOptions);
      return items.map((item) => {
        item.externalReference = item.referenceKey;
        return item;
      });
    } catch {
      throw new InternalServerErrorException('Unable to retrieve requirements');
    }
  }

  async findOne(
    userId: string,
    projectId: string,
    requirementId: string,
  ): Promise<Requirement> {
    await this.projectsService.findOne(userId, projectId);

    let requirement: Requirement | null = null;

    try {
      requirement = await this.requirementsRepository.findOne({
        where: { id: requirementId, projectId },
      });
    } catch {
      throw new InternalServerErrorException('Unable to retrieve requirement');
    }

    if (!requirement) {
      throw new NotFoundException('Requirement not found');
    }

    requirement.externalReference = requirement.referenceKey;
    return requirement;
  }

  async update(
    userId: string,
    projectId: string,
    requirementId: string,
    updateRequirementDto: UpdateRequirementDto,
  ): Promise<Requirement> {
    const requirement = await this.findOne(userId, projectId, requirementId);

    if (updateRequirementDto.title !== undefined) {
      requirement.title = updateRequirementDto.title;
    }

    if (updateRequirementDto.description !== undefined) {
      requirement.description = updateRequirementDto.description;
    }

    if (updateRequirementDto.referenceKey !== undefined) {
      requirement.referenceKey = updateRequirementDto.referenceKey;
    } else if (updateRequirementDto.externalReference !== undefined) {
      requirement.referenceKey = updateRequirementDto.externalReference;
    }

    try {
      const saved = await this.requirementsRepository.save(requirement);
      saved.externalReference = saved.referenceKey;
      return saved;
    } catch {
      throw new InternalServerErrorException('Unable to update requirement');
    }
  }

  async remove(
    userId: string,
    projectId: string,
    requirementId: string,
  ): Promise<void> {
    const requirement = await this.findOne(userId, projectId, requirementId);

    try {
      await this.requirementsRepository.remove(requirement);
    } catch {
      throw new InternalServerErrorException('Unable to delete requirement');
    }
  }
}
