import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  async create(
    userId: string,
    createProjectDto: CreateProjectDto,
  ): Promise<Project> {
    try {
      const project = this.projectsRepository.create({
        name: createProjectDto.name,
        description: createProjectDto.description ?? null,
        ownerId: userId,
      });

      return await this.projectsRepository.save(project);
    } catch {
      throw new InternalServerErrorException('Unable to create project');
    }
  }

  async findAll(userId: string): Promise<Project[]> {
    try {
      return await this.projectsRepository.find({
        where: { ownerId: userId },
        order: { createdAt: 'DESC' },
      });
    } catch {
      throw new InternalServerErrorException('Unable to retrieve projects');
    }
  }

  async findOne(userId: string, id: string): Promise<Project> {
    let project: Project | null = null;

    try {
      project = await this.projectsRepository.findOne({
        where: { id, ownerId: userId },
      });
    } catch {
      throw new InternalServerErrorException('Unable to retrieve project');
    }

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(
    userId: string,
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.findOne(userId, id);

    if (updateProjectDto.name !== undefined) {
      project.name = updateProjectDto.name;
    }

    if (updateProjectDto.description !== undefined) {
      project.description = updateProjectDto.description;
    }

    try {
      return await this.projectsRepository.save(project);
    } catch {
      throw new InternalServerErrorException('Unable to update project');
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const project = await this.findOne(userId, id);

    try {
      await this.projectsRepository.remove(project);
    } catch {
      throw new InternalServerErrorException('Unable to delete project');
    }
  }
}
