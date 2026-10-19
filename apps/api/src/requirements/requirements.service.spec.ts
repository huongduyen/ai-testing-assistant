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

import { ProjectsService } from '../projects/projects.service';
import { Requirement } from './entities/requirement.entity';
import { RequirementsService } from './requirements.service';

type RequirementsRepositoryMock = {
  find: jest.Mock<Promise<Requirement[]>, [object?]>;
  findOne: jest.Mock<Promise<Requirement | null>, [object?]>;
  create: jest.Mock<Partial<Requirement>, [Partial<Requirement>]>;
  save: jest.Mock<Promise<Requirement>, [Partial<Requirement>]>;
  remove: jest.Mock<Promise<Requirement>, [Requirement]>;
};

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

const buildRequirement = (
  overrides: Partial<Requirement> = {},
): Requirement => ({
  id: 'req-uuid-1',
  projectId: 'project-uuid-1',
  project: {
    id: 'project-uuid-1',
    name: 'Parent Project',
    description: null,
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
  },
  title: 'Test Requirement',
  description: 'Detailed requirement description',
  referenceKey: 'REQ-1',
  createdAt,
  updatedAt,
  populateExternalReference: jest.fn(),
  ...overrides,
});

describe('RequirementsService', () => {
  let service: RequirementsService;
  let requirementsRepository: RequirementsRepositoryMock;
  let projectsService: { findOne: jest.Mock };

  beforeEach(async () => {
    projectsService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'project-uuid-1',
        ownerId: 'user-a-id',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequirementsService,
        {
          provide: getRepositoryToken(Requirement),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: ProjectsService,
          useValue: projectsService,
        },
      ],
    }).compile();

    service = module.get<RequirementsService>(RequirementsService);
    requirementsRepository = module.get<RequirementsRepositoryMock>(
      getRepositoryToken(Requirement),
    );
  });

  describe('create', () => {
    it('verifies project ownership and creates requirement', async () => {
      const createDto = {
        title: 'New Requirement',
        description: 'Requirement details',
        referenceKey: 'REQ-100',
      };
      requirementsRepository.create.mockImplementation(
        (val: Partial<Requirement>) => val,
      );
      requirementsRepository.save.mockImplementation(
        (val: Partial<Requirement>) =>
          Promise.resolve(buildRequirement({ ...val, id: 'new-req-id' })),
      );

      const result = await service.create(
        'user-a-id',
        'project-uuid-1',
        createDto,
      );

      expect(projectsService.findOne).toHaveBeenCalledWith(
        'user-a-id',
        'project-uuid-1',
      );
      expect(requirementsRepository.create).toHaveBeenCalledWith({
        projectId: 'project-uuid-1',
        title: 'New Requirement',
        description: 'Requirement details',
        referenceKey: 'REQ-100',
      });
      expect(result.id).toBe('new-req-id');
      expect(result.externalReference).toBe('REQ-100');
    });

    it('accepts externalReference and maps to referenceKey', async () => {
      const createDto = {
        title: 'New Requirement',
        description: 'Requirement details',
        externalReference: 'EXT-99',
      };
      requirementsRepository.create.mockImplementation(
        (val: Partial<Requirement>) => val,
      );
      requirementsRepository.save.mockImplementation(
        (val: Partial<Requirement>) =>
          Promise.resolve(buildRequirement({ ...val, id: 'new-req-id' })),
      );

      const result = await service.create(
        'user-a-id',
        'project-uuid-1',
        createDto,
      );

      expect(requirementsRepository.create).toHaveBeenCalledWith({
        projectId: 'project-uuid-1',
        title: 'New Requirement',
        description: 'Requirement details',
        referenceKey: 'EXT-99',
      });
      expect(result.externalReference).toBe('EXT-99');
    });

    it('propagates NotFoundException if project not accessible to user', async () => {
      projectsService.findOne.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(
        service.create('user-a-id', 'non-existent-proj', {
          title: 'Req',
          description: 'Desc',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(requirementsRepository.save).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException on database error', async () => {
      requirementsRepository.create.mockReturnValue({});
      requirementsRepository.save.mockRejectedValue(new Error('DB failure'));

      await expect(
        service.create('user-a-id', 'project-uuid-1', {
          title: 'Req',
          description: 'Desc',
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('findAll', () => {
    it('verifies project ownership and returns requirements ordered by createdAt DESC', async () => {
      const reqList = [
        buildRequirement({ id: 'r1' }),
        buildRequirement({ id: 'r2' }),
      ];
      requirementsRepository.find.mockResolvedValue(reqList);

      const result = await service.findAll('user-a-id', 'project-uuid-1');

      expect(projectsService.findOne).toHaveBeenCalledWith(
        'user-a-id',
        'project-uuid-1',
      );
      expect(requirementsRepository.find).toHaveBeenCalledWith({
        where: { projectId: 'project-uuid-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('supports pagination parameters with page and limit', async () => {
      requirementsRepository.find.mockResolvedValue([]);

      await service.findAll('user-a-id', 'project-uuid-1', {
        page: 2,
        limit: 10,
      });

      expect(requirementsRepository.find).toHaveBeenCalledWith({
        where: { projectId: 'project-uuid-1' },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
    });

    it('propagates NotFoundException when parent project is not found', async () => {
      projectsService.findOne.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await expect(
        service.findAll('user-a-id', 'nonexistent-proj'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException on database find failure', async () => {
      requirementsRepository.find.mockRejectedValue(new Error('DB failure'));

      await expect(
        service.findAll('user-a-id', 'project-uuid-1'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('findOne', () => {
    it('returns requirement when project and requirement match', async () => {
      const req = buildRequirement({ id: 'r1', projectId: 'project-uuid-1' });
      requirementsRepository.findOne.mockResolvedValue(req);

      const result = await service.findOne('user-a-id', 'project-uuid-1', 'r1');

      expect(projectsService.findOne).toHaveBeenCalledWith(
        'user-a-id',
        'project-uuid-1',
      );
      expect(requirementsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'r1', projectId: 'project-uuid-1' },
      });
      expect(result.id).toBe('r1');
    });

    it('throws NotFoundException when requirement belongs to a different project', async () => {
      requirementsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('user-a-id', 'project-uuid-2', 'r1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException on DB error', async () => {
      requirementsRepository.findOne.mockRejectedValue(new Error('DB failure'));

      await expect(
        service.findOne('user-a-id', 'project-uuid-1', 'r1'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('update', () => {
    it('updates requirement fields', async () => {
      const existingReq = buildRequirement({
        id: 'r1',
        title: 'Old Title',
        description: 'Old Desc',
        referenceKey: 'OLD-KEY',
      });
      requirementsRepository.findOne.mockResolvedValue(existingReq);
      requirementsRepository.save.mockImplementation(
        (val: Partial<Requirement>) => Promise.resolve(val as Requirement),
      );

      const result = await service.update('user-a-id', 'project-uuid-1', 'r1', {
        title: 'New Title',
        description: 'New Desc',
        referenceKey: 'NEW-KEY',
      });

      expect(result.title).toBe('New Title');
      expect(result.description).toBe('New Desc');
      expect(result.referenceKey).toBe('NEW-KEY');
      expect(requirementsRepository.save).toHaveBeenCalled();
    });

    it('propagates NotFoundException if requirement not found', async () => {
      requirementsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('user-a-id', 'project-uuid-1', 'nonexistent-r', {
          title: 'New',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException on save failure', async () => {
      const existingReq = buildRequirement({ id: 'r1' });
      requirementsRepository.findOne.mockResolvedValue(existingReq);
      requirementsRepository.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.update('user-a-id', 'project-uuid-1', 'r1', { title: 'New' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('remove', () => {
    it('removes requirement successfully', async () => {
      const existingReq = buildRequirement({ id: 'r1' });
      requirementsRepository.findOne.mockResolvedValue(existingReq);
      requirementsRepository.remove.mockResolvedValue(existingReq);

      await service.remove('user-a-id', 'project-uuid-1', 'r1');

      expect(requirementsRepository.remove).toHaveBeenCalledWith(existingReq);
    });

    it('propagates NotFoundException if requirement does not exist', async () => {
      requirementsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('user-a-id', 'project-uuid-1', 'nonexistent-r'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws InternalServerErrorException on remove failure', async () => {
      const existingReq = buildRequirement({ id: 'r1' });
      requirementsRepository.findOne.mockResolvedValue(existingReq);
      requirementsRepository.remove.mockRejectedValue(new Error('DB error'));

      await expect(
        service.remove('user-a-id', 'project-uuid-1', 'r1'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
