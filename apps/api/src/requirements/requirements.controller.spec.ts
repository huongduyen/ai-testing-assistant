jest.mock('@nestjs/passport', () => {
  const { UnauthorizedException } =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');

  return {
    AuthGuard: () =>
      class {
        canActivate(context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: { authorization?: string };
              user?: Record<string, unknown>;
            };
          };
        }) {
          const request = context.switchToHttp().getRequest();
          const authHeader = request.headers.authorization;

          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException();
          }

          const token = authHeader.replace('Bearer ', '');

          if (token === 'user-a.jwt.token') {
            request.user = {
              id: 'user-a-id',
              email: 'usera@example.com',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            };
            return true;
          }

          if (token === 'user-b.jwt.token') {
            request.user = {
              id: 'user-b-id',
              email: 'userb@example.com',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            };
            return true;
          }

          throw new UnauthorizedException();
        }
      },
  };
});

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: (entity: { name: string }) => {
    const { Inject } =
      jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');

    return Inject(`${entity.name}Repository`);
  },
  getRepositoryToken: (entity: { name: string }) => `${entity.name}Repository`,
}));

import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';

import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';

const validProjectId = '11111111-1111-1111-1111-111111111111';
const validReqId = '22222222-2222-2222-2222-222222222222';
const otherReqId = '33333333-3333-3333-3333-333333333333';
const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

describe('RequirementsController', () => {
  let app: INestApplication;
  let httpServer: Server;
  let requirementsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    requirementsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequirementsController],
      providers: [
        {
          provide: RequirementsService,
          useValue: requirementsService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Authentication & Authorization', () => {
    it('rejects unauthenticated requests on all requirement endpoints', async () => {
      await request(httpServer)
        .post(`/projects/${validProjectId}/requirements`)
        .send({ title: 'Req', description: 'Desc' })
        .expect(401);

      await request(httpServer)
        .get(`/projects/${validProjectId}/requirements`)
        .expect(401);

      await request(httpServer)
        .get(`/projects/${validProjectId}/requirements/${validReqId}`)
        .expect(401);

      await request(httpServer)
        .patch(`/projects/${validProjectId}/requirements/${validReqId}`)
        .send({ title: 'Update' })
        .expect(401);

      await request(httpServer)
        .delete(`/projects/${validProjectId}/requirements/${validReqId}`)
        .expect(401);
    });

    it('rejects requests with invalid JWT token', async () => {
      await request(httpServer)
        .get(`/projects/${validProjectId}/requirements`)
        .set('Authorization', 'Bearer invalid.token')
        .expect(401);
    });
  });

  describe('UUID & DTO Validation', () => {
    it('rejects non-UUID projectId with 400', async () => {
      await request(httpServer)
        .get('/projects/not-a-uuid/requirements')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(400);

      expect(requirementsService.findAll).not.toHaveBeenCalled();
    });

    it('rejects non-UUID requirementId with 400', async () => {
      await request(httpServer)
        .get(`/projects/${validProjectId}/requirements/not-a-uuid`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(400);

      expect(requirementsService.findOne).not.toHaveBeenCalled();
    });

    it('rejects POST with missing title or description', async () => {
      await request(httpServer)
        .post(`/projects/${validProjectId}/requirements`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ description: 'No title' })
        .expect(400);

      await request(httpServer)
        .post(`/projects/${validProjectId}/requirements`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ title: 'No description' })
        .expect(400);
    });

    it('rejects POST with empty or whitespace-only title/description', async () => {
      await request(httpServer)
        .post(`/projects/${validProjectId}/requirements`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ title: '   ', description: 'Valid desc' })
        .expect(400);

      await request(httpServer)
        .post(`/projects/${validProjectId}/requirements`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ title: 'Valid Title', description: '   ' })
        .expect(400);
    });

    it('rejects unexpected fields (e.g. client-supplied projectId or id)', async () => {
      await request(httpServer)
        .post(`/projects/${validProjectId}/requirements`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({
          title: 'Title',
          description: 'Desc',
          projectId: 'some-id',
        })
        .expect(400);

      expect(requirementsService.create).not.toHaveBeenCalled();
    });

    it('rejects unexpected fields in PATCH', async () => {
      await request(httpServer)
        .patch(`/projects/${validProjectId}/requirements/${validReqId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({
          title: 'Updated Title',
          unexpectedProp: 'hack',
        })
        .expect(400);

      expect(requirementsService.update).not.toHaveBeenCalled();
    });
  });

  describe('CRUD & Project Isolation', () => {
    it('creates a requirement under a project owned by authenticated user', async () => {
      const createdReq = {
        id: validReqId,
        projectId: validProjectId,
        title: 'Requirement A',
        description: 'Requirement Description',
        referenceKey: 'REQ-1',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      };
      requirementsService.create.mockResolvedValue(createdReq);

      const response = await request(httpServer)
        .post(`/projects/${validProjectId}/requirements`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({
          title: '  Requirement A  ',
          description: '  Requirement Description  ',
          referenceKey: 'REQ-1',
        })
        .expect(201);

      expect(requirementsService.create).toHaveBeenCalledWith(
        'user-a-id',
        validProjectId,
        {
          title: 'Requirement A',
          description: 'Requirement Description',
          referenceKey: 'REQ-1',
        },
      );
      expect(response.body).toEqual(createdReq);
    });

    it('lists requirements for the specified project', async () => {
      const reqList = [
        {
          id: validReqId,
          projectId: validProjectId,
          title: 'Req 1',
          description: 'Desc 1',
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ];
      requirementsService.findAll.mockResolvedValue(reqList);

      const response = await request(httpServer)
        .get(`/projects/${validProjectId}/requirements?page=1&limit=10`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(200);

      expect(requirementsService.findAll).toHaveBeenCalledWith(
        'user-a-id',
        validProjectId,
        { page: 1, limit: 10 },
      );
      expect(response.body).toEqual(reqList);
    });

    it('gets a single requirement', async () => {
      const req = {
        id: validReqId,
        projectId: validProjectId,
        title: 'Req 1',
        description: 'Desc 1',
      };
      requirementsService.findOne.mockResolvedValue(req);

      const response = await request(httpServer)
        .get(`/projects/${validProjectId}/requirements/${validReqId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(200);

      expect(requirementsService.findOne).toHaveBeenCalledWith(
        'user-a-id',
        validProjectId,
        validReqId,
      );
      expect(response.body).toEqual(req);
    });

    it('returns 404 when project does not belong to authenticated user', async () => {
      requirementsService.create.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await request(httpServer)
        .post(`/projects/${validProjectId}/requirements`)
        .set('Authorization', 'Bearer user-b.jwt.token')
        .send({ title: 'Req', description: 'Desc' })
        .expect(404);
    });

    it('returns 404 when requirement belongs to a different project', async () => {
      requirementsService.findOne.mockRejectedValue(
        new NotFoundException('Requirement not found'),
      );

      await request(httpServer)
        .get(`/projects/${validProjectId}/requirements/${otherReqId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(404);
    });

    it('updates a requirement', async () => {
      const updatedReq = {
        id: validReqId,
        projectId: validProjectId,
        title: 'New Title',
        description: 'New Desc',
      };
      requirementsService.update.mockResolvedValue(updatedReq);

      const response = await request(httpServer)
        .patch(`/projects/${validProjectId}/requirements/${validReqId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ title: 'New Title', description: 'New Desc' })
        .expect(200);

      expect(requirementsService.update).toHaveBeenCalledWith(
        'user-a-id',
        validProjectId,
        validReqId,
        { title: 'New Title', description: 'New Desc' },
      );
      expect(response.body).toEqual(updatedReq);
    });

    it('returns 404 when attempting to update nonexistent requirement or wrong project', async () => {
      requirementsService.update.mockRejectedValue(
        new NotFoundException('Requirement not found'),
      );

      await request(httpServer)
        .patch(`/projects/${validProjectId}/requirements/${otherReqId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ title: 'New' })
        .expect(404);
    });

    it('deletes a requirement with 204 No Content', async () => {
      requirementsService.remove.mockResolvedValue(undefined);

      await request(httpServer)
        .delete(`/projects/${validProjectId}/requirements/${validReqId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(204);

      expect(requirementsService.remove).toHaveBeenCalledWith(
        'user-a-id',
        validProjectId,
        validReqId,
      );
    });

    it('returns 404 when attempting to delete requirement in wrong project', async () => {
      requirementsService.remove.mockRejectedValue(
        new NotFoundException('Requirement not found'),
      );

      await request(httpServer)
        .delete(`/projects/${validProjectId}/requirements/${otherReqId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(404);
    });
  });
});
