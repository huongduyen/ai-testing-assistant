jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: (entity: { name: string }) => {
    const { Inject } =
      jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');

    return Inject(`${entity.name}Repository`);
  },
  getRepositoryToken: (entity: { name: string }) => `${entity.name}Repository`,
}));

import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Project } from './entities/project.entity';
import { ProjectsService } from './projects.service';

type ProjectsRepositoryMock = {
  find: jest.Mock<Promise<Project[]>, [object?]>;
  findOne: jest.Mock<Promise<Project | null>, [object?]>;
  create: jest.Mock<Partial<Project>, [Partial<Project>]>;
  save: jest.Mock<Promise<Project>, [Partial<Project>]>;
  remove: jest.Mock<Promise<Project>, [Project]>;
};

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

const buildProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-uuid-1',
  name: 'Test Project',
  description: 'Test Project Description',
  ownerId: 'user-a-id',
  owner: {
    id: 'user-a-id',
    email: 'usera@example.com',
    passwordHash: 'hash',
    createdAt,
    updatedAt,
  },
  createdAt,
  updatedAt,
  ...overrides,
});

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectsRepository: ProjectsRepositoryMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    projectsRepository = module.get<ProjectsRepositoryMock>(
      getRepositoryToken(Project),
    );
  });

  describe('create', () => {
    it('creates and saves a project with authenticated user as owner', async () => {
      const createDto = {
        name: 'New Project',
        description: 'Project details',
      };
      const createdEntity = {
        ...createDto,
        ownerId: 'user-a-id',
      };
      projectsRepository.create.mockReturnValue(createdEntity);
      projectsRepository.save.mockResolvedValue(
        buildProject({ ...createdEntity, id: 'new-id' }),
      );

      const result = await service.create('user-a-id', createDto);

      expect(projectsRepository.create).toHaveBeenCalledWith({
        name: 'New Project',
        description: 'Project details',
        ownerId: 'user-a-id',
      });
      expect(projectsRepository.save).toHaveBeenCalledWith(createdEntity);
      expect(result.ownerId).toBe('user-a-id');
      expect(result.id).toBe('new-id');
    });

    it('sets null description if description is omitted', async () => {
      const createDto = { name: 'Only Name' };
      projectsRepository.create.mockImplementation(
        (val: Partial<Project>) => val,
      );
      projectsRepository.save.mockImplementation((val: Partial<Project>) =>
        Promise.resolve(buildProject(val)),
      );

      await service.create('user-a-id', createDto);

      expect(projectsRepository.create).toHaveBeenCalledWith({
        name: 'Only Name',
        description: null,
        ownerId: 'user-a-id',
      });
    });

    it('throws InternalServerErrorException on database error', async () => {
      projectsRepository.create.mockReturnValue({});
      projectsRepository.save.mockRejectedValue(new Error('DB failure'));

      await expect(
        service.create('user-a-id', { name: 'Fail' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('findAll', () => {
    it('returns only projects owned by the requesting user ordered by createdAt DESC', async () => {
      const userProjects = [
        buildProject({ id: 'p1', ownerId: 'user-a-id' }),
        buildProject({ id: 'p2', ownerId: 'user-a-id' }),
      ];
      projectsRepository.find.mockResolvedValue(userProjects);

      const result = await service.findAll('user-a-id');

      expect(projectsRepository.find).toHaveBeenCalledWith({
        where: { ownerId: 'user-a-id' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result).toEqual(userProjects);
    });

    it('throws InternalServerErrorException if find fails', async () => {
      projectsRepository.find.mockRejectedValue(new Error('DB failure'));

      await expect(service.findAll('user-a-id')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('findOne', () => {
    it('returns a project if owned by the requesting user', async () => {
      const project = buildProject({ id: 'p1', ownerId: 'user-a-id' });
      projectsRepository.findOne.mockResolvedValue(project);

      const result = await service.findOne('user-a-id', 'p1');

      expect(projectsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'p1', ownerId: 'user-a-id' },
      });
      expect(result).toEqual(project);
    });

    it('throws NotFoundException if project belongs to another user or does not exist', async () => {
      projectsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('user-a-id', 'p-b-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(projectsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'p-b-id', ownerId: 'user-a-id' },
      });
    });

    it('throws InternalServerErrorException on database failure', async () => {
      projectsRepository.findOne.mockRejectedValue(new Error('DB failure'));

      await expect(service.findOne('user-a-id', 'p1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('update', () => {
    it('updates project fields when user is the owner', async () => {
      const existingProject = buildProject({
        id: 'p1',
        name: 'Old Name',
        description: 'Old Desc',
        ownerId: 'user-a-id',
      });
      projectsRepository.findOne.mockResolvedValue(existingProject);
      projectsRepository.save.mockImplementation((p: Partial<Project>) =>
        Promise.resolve(p as Project),
      );

      const result = await service.update('user-a-id', 'p1', {
        name: 'New Name',
        description: 'New Desc',
      });

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('New Desc');
      expect(projectsRepository.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when attempting to update another users project', async () => {
      projectsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('user-a-id', 'p-b-id', { name: 'Hack' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(projectsRepository.save).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when save fails during update', async () => {
      const existingProject = buildProject({ id: 'p1', ownerId: 'user-a-id' });
      projectsRepository.findOne.mockResolvedValue(existingProject);
      projectsRepository.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.update('user-a-id', 'p1', { name: 'New Name' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('remove', () => {
    it('removes project when user is the owner', async () => {
      const existingProject = buildProject({ id: 'p1', ownerId: 'user-a-id' });
      projectsRepository.findOne.mockResolvedValue(existingProject);
      projectsRepository.remove.mockResolvedValue(existingProject);

      await service.remove('user-a-id', 'p1');

      expect(projectsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'p1', ownerId: 'user-a-id' },
      });
      expect(projectsRepository.remove).toHaveBeenCalledWith(existingProject);
    });

    it('throws NotFoundException when attempting to delete another users project', async () => {
      projectsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('user-a-id', 'p-b-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(projectsRepository.remove).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when remove fails', async () => {
      const existingProject = buildProject({ id: 'p1', ownerId: 'user-a-id' });
      projectsRepository.findOne.mockResolvedValue(existingProject);
      projectsRepository.remove.mockRejectedValue(new Error('DB error'));

      await expect(service.remove('user-a-id', 'p1')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
