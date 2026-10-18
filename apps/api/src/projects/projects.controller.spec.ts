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

import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

const validProjectId = '11111111-1111-1111-1111-111111111111';
const userBProjectId = '22222222-2222-2222-2222-222222222222';
const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

describe('ProjectsController', () => {
  let app: INestApplication;
  let httpServer: Server;
  let projectsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    projectsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: projectsService,
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
    it('rejects unauthenticated requests on all endpoints', async () => {
      await request(httpServer)
        .post('/projects')
        .send({ name: 'Test' })
        .expect(401);
      await request(httpServer).get('/projects').expect(401);
      await request(httpServer).get(`/projects/${validProjectId}`).expect(401);
      await request(httpServer)
        .patch(`/projects/${validProjectId}`)
        .send({ name: 'Update' })
        .expect(401);
      await request(httpServer)
        .delete(`/projects/${validProjectId}`)
        .expect(401);
    });

    it('rejects requests with invalid JWT', async () => {
      await request(httpServer)
        .get('/projects')
        .set('Authorization', 'Bearer invalid.token')
        .expect(401);
    });
  });

  describe('Validation & Invalid IDs', () => {
    it('rejects invalid UUID format for GET /projects/:id with 400', async () => {
      await request(httpServer)
        .get('/projects/not-a-valid-uuid')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(400);
      expect(projectsService.findOne).not.toHaveBeenCalled();
    });

    it('rejects invalid UUID format for PATCH /projects/:id with 400', async () => {
      await request(httpServer)
        .patch('/projects/12345')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ name: 'Updated' })
        .expect(400);
      expect(projectsService.update).not.toHaveBeenCalled();
    });

    it('rejects invalid UUID format for DELETE /projects/:id with 400', async () => {
      await request(httpServer)
        .delete('/projects/invalid-id')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(400);
      expect(projectsService.remove).not.toHaveBeenCalled();
    });

    it('rejects POST /projects when name is missing or empty', async () => {
      await request(httpServer)
        .post('/projects')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({})
        .expect(400);

      await request(httpServer)
        .post('/projects')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ name: '' })
        .expect(400);

      await request(httpServer)
        .post('/projects')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ name: '   ' })
        .expect(400);
    });

    it('rejects POST /projects when name exceeds 255 characters', async () => {
      await request(httpServer)
        .post('/projects')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ name: 'a'.repeat(256) })
        .expect(400);
    });

    it('rejects POST /projects when description exceeds 1000 characters', async () => {
      await request(httpServer)
        .post('/projects')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ name: 'Valid Project', description: 'd'.repeat(1001) })
        .expect(400);
    });

    it('rejects unexpected fields in POST /projects (including client-supplied ownerId)', async () => {
      await request(httpServer)
        .post('/projects')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({
          name: 'Hacked Project',
          ownerId: 'user-b-id',
        })
        .expect(400);

      await request(httpServer)
        .post('/projects')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({
          name: 'Hacked Project',
          isAdmin: true,
        })
        .expect(400);

      expect(projectsService.create).not.toHaveBeenCalled();
    });

    it('rejects unexpected fields in PATCH /projects/:id', async () => {
      await request(httpServer)
        .patch(`/projects/${validProjectId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({
          ownerId: 'user-b-id',
        })
        .expect(400);

      expect(projectsService.update).not.toHaveBeenCalled();
    });
  });

  describe('Project CRUD & User Isolation', () => {
    it('creates a project with owner derived from authenticated user', async () => {
      const createdProject = {
        id: validProjectId,
        name: 'My Project',
        description: 'Desc',
        ownerId: 'user-a-id',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      };
      projectsService.create.mockResolvedValue(createdProject);

      const response = await request(httpServer)
        .post('/projects')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ name: '  My Project  ', description: 'Desc' })
        .expect(201);

      expect(projectsService.create).toHaveBeenCalledWith('user-a-id', {
        name: 'My Project',
        description: 'Desc',
      });
      expect(response.body).toEqual(createdProject);
    });

    it('lists projects owned by the authenticated user', async () => {
      const userProjects = [
        {
          id: validProjectId,
          name: 'Project 1',
          ownerId: 'user-a-id',
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ];
      projectsService.findAll.mockResolvedValue(userProjects);

      const response = await request(httpServer)
        .get('/projects')
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(200);

      expect(projectsService.findAll).toHaveBeenCalledWith('user-a-id');
      expect(response.body).toEqual(userProjects);
    });

    it('gets a single project owned by the authenticated user', async () => {
      const project = {
        id: validProjectId,
        name: 'My Project',
        ownerId: 'user-a-id',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      };
      projectsService.findOne.mockResolvedValue(project);

      const response = await request(httpServer)
        .get(`/projects/${validProjectId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(200);

      expect(projectsService.findOne).toHaveBeenCalledWith(
        'user-a-id',
        validProjectId,
      );
      expect(response.body).toEqual(project);
    });

    it('returns 404 when user A attempts to read user B project', async () => {
      projectsService.findOne.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await request(httpServer)
        .get(`/projects/${userBProjectId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(404);

      expect(projectsService.findOne).toHaveBeenCalledWith(
        'user-a-id',
        userBProjectId,
      );
    });

    it('updates a project owned by the authenticated user', async () => {
      const updatedProject = {
        id: validProjectId,
        name: 'New Name',
        description: 'New Description',
        ownerId: 'user-a-id',
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      };
      projectsService.update.mockResolvedValue(updatedProject);

      const response = await request(httpServer)
        .patch(`/projects/${validProjectId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ name: 'New Name', description: 'New Description' })
        .expect(200);

      expect(projectsService.update).toHaveBeenCalledWith(
        'user-a-id',
        validProjectId,
        {
          name: 'New Name',
          description: 'New Description',
        },
      );
      expect(response.body).toEqual(updatedProject);
    });

    it('returns 404 when user A attempts to update user B project', async () => {
      projectsService.update.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await request(httpServer)
        .patch(`/projects/${userBProjectId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .send({ name: 'Hacked Name' })
        .expect(404);

      expect(projectsService.update).toHaveBeenCalledWith(
        'user-a-id',
        userBProjectId,
        { name: 'Hacked Name' },
      );
    });

    it('deletes a project owned by the authenticated user with 204 No Content', async () => {
      projectsService.remove.mockResolvedValue(undefined);

      await request(httpServer)
        .delete(`/projects/${validProjectId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(204);

      expect(projectsService.remove).toHaveBeenCalledWith(
        'user-a-id',
        validProjectId,
      );
    });

    it('returns 404 when user A attempts to delete user B project', async () => {
      projectsService.remove.mockRejectedValue(
        new NotFoundException('Project not found'),
      );

      await request(httpServer)
        .delete(`/projects/${userBProjectId}`)
        .set('Authorization', 'Bearer user-a.jwt.token')
        .expect(404);

      expect(projectsService.remove).toHaveBeenCalledWith(
        'user-a-id',
        userBProjectId,
      );
    });
  });
});
