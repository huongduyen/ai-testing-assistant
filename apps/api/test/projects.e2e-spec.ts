/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';

interface StoredProject {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

let projectsDb: StoredProject[] = [];

jest.mock('@nestjs/config', () => {
  class ConfigService {
    get(key: string): string | undefined {
      if (key === 'JWT_SECRET') {
        return 'e2e-test-secret';
      }
      if (key === 'JWT_EXPIRES_IN') {
        return '15m';
      }
      return undefined;
    }
  }

  class ConfigModule {}

  return {
    ConfigModule: {
      forRoot: () => ({
        module: ConfigModule,
        global: true,
        providers: [ConfigService],
        exports: [ConfigService],
      }),
    },
    ConfigService,
  };
});

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: (entity: { name: string }) => {
    const { Inject } =
      jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
    return Inject(`${entity.name}Repository`);
  },
  TypeOrmModule: {
    forRootAsync: () => ({
      module: class TypeOrmRootTestingModule {},
    }),
    forFeature: (entities: Array<{ name: string }>) => {
      const providers = entities.map((entity) => {
        if (entity.name === 'Project') {
          return {
            provide: `${entity.name}Repository`,
            useValue: {
              create: jest
                .fn()
                .mockImplementation((dto: Partial<StoredProject>) => ({
                  id: '11111111-1111-1111-1111-111111111111',
                  name: dto.name,
                  description: dto.description ?? null,
                  ownerId: dto.ownerId,
                  createdAt: new Date('2026-01-01T00:00:00.000Z'),
                  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
                })),
              save: jest.fn().mockImplementation((project: StoredProject) => {
                const existingIdx = projectsDb.findIndex(
                  (p) => p.id === project.id,
                );
                if (existingIdx >= 0) {
                  projectsDb[existingIdx] = {
                    ...projectsDb[existingIdx],
                    ...project,
                    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
                  };
                  return Promise.resolve(projectsDb[existingIdx]);
                }
                const newProject = {
                  ...project,
                  id: project.id ?? '11111111-1111-1111-1111-111111111111',
                  createdAt: new Date('2026-01-01T00:00:00.000Z'),
                  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
                };
                projectsDb.push(newProject);
                return Promise.resolve(newProject);
              }),
              find: jest
                .fn()
                .mockImplementation(
                  (options?: { where?: { ownerId?: string } }) => {
                    const ownerId = options?.where?.ownerId;
                    const results = ownerId
                      ? projectsDb.filter((p) => p.ownerId === ownerId)
                      : projectsDb;
                    return Promise.resolve(results);
                  },
                ),
              findOne: jest
                .fn()
                .mockImplementation(
                  (options?: { where?: { id?: string; ownerId?: string } }) => {
                    const id = options?.where?.id;
                    const ownerId = options?.where?.ownerId;
                    const found = projectsDb.find(
                      (p) => p.id === id && (!ownerId || p.ownerId === ownerId),
                    );
                    return Promise.resolve(found ?? null);
                  },
                ),
              remove: jest.fn().mockImplementation((project: StoredProject) => {
                projectsDb = projectsDb.filter((p) => p.id !== project.id);
                return Promise.resolve(project);
              }),
            },
          };
        }

        return {
          provide: `${entity.name}Repository`,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        };
      });

      return {
        module: class TypeOrmFeatureTestingModule {},
        providers,
        exports: providers,
      };
    },
  },
}));

jest.mock('@nestjs/jwt', () => {
  class JwtService {
    signAsync(): Promise<string> {
      return Promise.resolve('e2e.jwt.token');
    }
  }

  class JwtTestingModule {}

  return {
    JwtModule: {
      registerAsync: () => ({
        module: JwtTestingModule,
        providers: [JwtService],
        exports: [JwtService],
      }),
    },
    JwtService,
  };
});

jest.mock('@nestjs/passport', () => ({
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
        const req = context.switchToHttp().getRequest();
        const auth = req.headers.authorization;

        if (auth === 'Bearer user-a.token') {
          req.user = { id: 'user-a-uuid', email: 'usera@example.com' };
          return true;
        }

        if (auth === 'Bearer user-b.token') {
          req.user = { id: 'user-b-uuid', email: 'userb@example.com' };
          return true;
        }

        throw new UnauthorizedException();
      }
    },
  PassportModule: {
    register: () => ({
      module: class PassportTestingModule {},
    }),
  },
  PassportStrategy: () => class {},
}));

import { AppModule } from '../src/app.module';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  beforeEach(() => {
    projectsDb = [];
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    await request(httpServer).get('/projects').expect(401);
    await request(httpServer)
      .post('/projects')
      .send({ name: 'Secret' })
      .expect(401);
  });

  it('rejects invalid UUID formats with 400 Bad Request', async () => {
    await request(httpServer)
      .get('/projects/not-a-valid-uuid')
      .set('Authorization', 'Bearer user-a.token')
      .expect(400);
  });

  it('rejects client-supplied ownerId and unexpected fields', async () => {
    await request(httpServer)
      .post('/projects')
      .set('Authorization', 'Bearer user-a.token')
      .send({
        name: 'My Project',
        ownerId: 'user-b-uuid',
      })
      .expect(400);
  });

  it('allows user A to create and retrieve projects', async () => {
    const createRes = await request(httpServer)
      .post('/projects')
      .set('Authorization', 'Bearer user-a.token')
      .send({
        name: 'Project Alpha',
        description: 'First test project',
      })
      .expect(201);

    expect(createRes.body.name).toBe('Project Alpha');
    expect(createRes.body.ownerId).toBe('user-a-uuid');

    const listRes = await request(httpServer)
      .get('/projects')
      .set('Authorization', 'Bearer user-a.token')
      .expect(200);

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(createRes.body.id);
  });

  it('isolates projects between users: user B cannot access user A project', async () => {
    const createRes = await request(httpServer)
      .post('/projects')
      .set('Authorization', 'Bearer user-a.token')
      .send({
        name: 'User A Secret Project',
      })
      .expect(201);

    const projectAId = createRes.body.id;

    // User B lists projects — should be empty
    const userBList = await request(httpServer)
      .get('/projects')
      .set('Authorization', 'Bearer user-b.token')
      .expect(200);
    expect(userBList.body).toHaveLength(0);

    // User B tries GET user A's project -> 404
    await request(httpServer)
      .get(`/projects/${projectAId}`)
      .set('Authorization', 'Bearer user-b.token')
      .expect(404);

    // User B tries PATCH user A's project -> 404
    await request(httpServer)
      .patch(`/projects/${projectAId}`)
      .set('Authorization', 'Bearer user-b.token')
      .send({ name: 'Hacked by B' })
      .expect(404);

    // User B tries DELETE user A's project -> 404
    await request(httpServer)
      .delete(`/projects/${projectAId}`)
      .set('Authorization', 'Bearer user-b.token')
      .expect(404);
  });

  it('allows user A to update and delete their own project', async () => {
    const createRes = await request(httpServer)
      .post('/projects')
      .set('Authorization', 'Bearer user-a.token')
      .send({
        name: 'Original Name',
      })
      .expect(201);

    const projectId = createRes.body.id;

    const patchRes = await request(httpServer)
      .patch(`/projects/${projectId}`)
      .set('Authorization', 'Bearer user-a.token')
      .send({
        name: 'Updated Name',
        description: 'Added description',
      })
      .expect(200);

    expect(patchRes.body.name).toBe('Updated Name');
    expect(patchRes.body.description).toBe('Added description');

    // DELETE project
    await request(httpServer)
      .delete(`/projects/${projectId}`)
      .set('Authorization', 'Bearer user-a.token')
      .expect(204);

    // Now GET should 404
    await request(httpServer)
      .get(`/projects/${projectId}`)
      .set('Authorization', 'Bearer user-a.token')
      .expect(404);
  });
});
