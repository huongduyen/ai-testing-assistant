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

interface StoredRequirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  referenceKey: string | null;
  externalReference?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

let projectsDb: StoredProject[] = [];
let requirementsDb: StoredRequirement[] = [];

let idCounter = 1;

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

        if (entity.name === 'Requirement') {
          return {
            provide: `${entity.name}Repository`,
            useValue: {
              create: jest
                .fn()
                .mockImplementation((dto: Partial<StoredRequirement>) => {
                  idCounter++;
                  const generatedId = `10000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`;
                  return {
                    id: generatedId,
                    projectId: dto.projectId,
                    title: dto.title,
                    description: dto.description,
                    referenceKey: dto.referenceKey ?? null,
                    externalReference: dto.referenceKey ?? null,
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
                  };
                }),
              save: jest.fn().mockImplementation((req: StoredRequirement) => {
                const existingIdx = requirementsDb.findIndex(
                  (r) => r.id === req.id,
                );
                if (existingIdx >= 0) {
                  requirementsDb[existingIdx] = {
                    ...requirementsDb[existingIdx],
                    ...req,
                    externalReference: req.referenceKey,
                    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
                  };
                  return Promise.resolve(requirementsDb[existingIdx]);
                }
                const newReq = {
                  ...req,
                  externalReference: req.referenceKey,
                  createdAt: new Date('2026-01-01T00:00:00.000Z'),
                  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
                };
                requirementsDb.push(newReq);
                return Promise.resolve(newReq);
              }),
              find: jest
                .fn()
                .mockImplementation(
                  (options?: {
                    where?: { projectId?: string };
                    skip?: number;
                    take?: number;
                  }) => {
                    const projectId = options?.where?.projectId;
                    let results = projectId
                      ? requirementsDb.filter((r) => r.projectId === projectId)
                      : requirementsDb;
                    if (options?.skip !== undefined) {
                      results = results.slice(options.skip);
                    }
                    if (options?.take !== undefined) {
                      results = results.slice(0, options.take);
                    }
                    return Promise.resolve(
                      results.map((r) => ({
                        ...r,
                        externalReference: r.referenceKey,
                      })),
                    );
                  },
                ),
              findOne: jest
                .fn()
                .mockImplementation(
                  (options?: {
                    where?: { id?: string; projectId?: string };
                  }) => {
                    const id = options?.where?.id;
                    const projectId = options?.where?.projectId;
                    const found = requirementsDb.find(
                      (r) =>
                        r.id === id &&
                        (!projectId || r.projectId === projectId),
                    );
                    if (!found) return Promise.resolve(null);
                    return Promise.resolve({
                      ...found,
                      externalReference: found.referenceKey,
                    });
                  },
                ),
              remove: jest.fn().mockImplementation((req: StoredRequirement) => {
                requirementsDb = requirementsDb.filter((r) => r.id !== req.id);
                return Promise.resolve(req);
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

const projectA1Id = '11111111-1111-1111-1111-111111111111';
const projectA2Id = '22222222-2222-2222-2222-222222222222';
const projectBId = '33333333-3333-3333-3333-333333333333';

describe('Requirements (e2e)', () => {
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
    projectsDb = [
      {
        id: projectA1Id,
        name: 'User A Project 1',
        description: 'First project',
        ownerId: 'user-a-uuid',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: projectA2Id,
        name: 'User A Project 2',
        description: 'Second project',
        ownerId: 'user-a-uuid',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: projectBId,
        name: 'User B Project',
        description: 'B project',
        ownerId: 'user-b-uuid',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
    requirementsDb = [];
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests on requirement endpoints with 401', async () => {
    await request(httpServer)
      .get(`/projects/${projectA1Id}/requirements`)
      .expect(401);

    await request(httpServer)
      .post(`/projects/${projectA1Id}/requirements`)
      .send({ title: 'T', description: 'D' })
      .expect(401);
  });

  it('rejects invalid UUID formats with 400 Bad Request', async () => {
    await request(httpServer)
      .get('/projects/not-a-valid-uuid/requirements')
      .set('Authorization', 'Bearer user-a.token')
      .expect(400);

    await request(httpServer)
      .get(`/projects/${projectA1Id}/requirements/not-a-valid-uuid`)
      .set('Authorization', 'Bearer user-a.token')
      .expect(400);
  });

  it('rejects invalid DTO inputs with 400 Bad Request', async () => {
    await request(httpServer)
      .post(`/projects/${projectA1Id}/requirements`)
      .set('Authorization', 'Bearer user-a.token')
      .send({ title: '' })
      .expect(400);

    await request(httpServer)
      .post(`/projects/${projectA1Id}/requirements`)
      .set('Authorization', 'Bearer user-a.token')
      .send({ title: 'Title', description: '   ' })
      .expect(400);

    await request(httpServer)
      .post(`/projects/${projectA1Id}/requirements`)
      .set('Authorization', 'Bearer user-a.token')
      .send({
        title: 'Title',
        description: 'Desc',
        unexpectedField: 'forbidden',
      })
      .expect(400);
  });

  it('allows user A to create and list requirements in their project', async () => {
    const createRes = await request(httpServer)
      .post(`/projects/${projectA1Id}/requirements`)
      .set('Authorization', 'Bearer user-a.token')
      .send({
        title: 'User Authentication Flow',
        description: 'System must support email and password login with JWT',
        referenceKey: 'AUTH-1',
      })
      .expect(201);

    expect(createRes.body.title).toBe('User Authentication Flow');
    expect(createRes.body.projectId).toBe(projectA1Id);
    expect(createRes.body.referenceKey).toBe('AUTH-1');

    const listRes = await request(httpServer)
      .get(`/projects/${projectA1Id}/requirements`)
      .set('Authorization', 'Bearer user-a.token')
      .expect(200);

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(createRes.body.id);
  });

  it('enforces cross-project isolation: requirement in Project 1 cannot be accessed via Project 2 URL', async () => {
    const createRes = await request(httpServer)
      .post(`/projects/${projectA1Id}/requirements`)
      .set('Authorization', 'Bearer user-a.token')
      .send({
        title: 'Project 1 Specific Requirement',
        description: 'Belongs strictly to Project 1',
      })
      .expect(201);

    const reqId = createRes.body.id;

    // User A owns both Project 1 and Project 2, but Req belongs to Project 1
    // Accessing via Project 2 URL must 404
    await request(httpServer)
      .get(`/projects/${projectA2Id}/requirements/${reqId}`)
      .set('Authorization', 'Bearer user-a.token')
      .expect(404);

    await request(httpServer)
      .patch(`/projects/${projectA2Id}/requirements/${reqId}`)
      .set('Authorization', 'Bearer user-a.token')
      .send({ title: 'Hacked' })
      .expect(404);

    await request(httpServer)
      .delete(`/projects/${projectA2Id}/requirements/${reqId}`)
      .set('Authorization', 'Bearer user-a.token')
      .expect(404);
  });

  it('enforces cross-user isolation: user B cannot access user A project requirements', async () => {
    const createRes = await request(httpServer)
      .post(`/projects/${projectA1Id}/requirements`)
      .set('Authorization', 'Bearer user-a.token')
      .send({
        title: 'User A Secret Requirement',
        description: 'Private business logic',
      })
      .expect(201);

    const reqId = createRes.body.id;

    // User B tries to create in Project A -> 404
    await request(httpServer)
      .post(`/projects/${projectA1Id}/requirements`)
      .set('Authorization', 'Bearer user-b.token')
      .send({ title: 'Hack', description: 'Desc' })
      .expect(404);

    // User B tries to list requirements in Project A -> 404
    await request(httpServer)
      .get(`/projects/${projectA1Id}/requirements`)
      .set('Authorization', 'Bearer user-b.token')
      .expect(404);

    // User B tries to get requirement in Project A -> 404
    await request(httpServer)
      .get(`/projects/${projectA1Id}/requirements/${reqId}`)
      .set('Authorization', 'Bearer user-b.token')
      .expect(404);

    // User B tries to patch requirement in Project A -> 404
    await request(httpServer)
      .patch(`/projects/${projectA1Id}/requirements/${reqId}`)
      .set('Authorization', 'Bearer user-b.token')
      .send({ title: 'Compromised' })
      .expect(404);

    // User B tries to delete requirement in Project A -> 404
    await request(httpServer)
      .delete(`/projects/${projectA1Id}/requirements/${reqId}`)
      .set('Authorization', 'Bearer user-b.token')
      .expect(404);
  });

  it('allows user A to update and delete their requirement', async () => {
    const createRes = await request(httpServer)
      .post(`/projects/${projectA1Id}/requirements`)
      .set('Authorization', 'Bearer user-a.token')
      .send({
        title: 'Initial Title',
        description: 'Initial Description',
      })
      .expect(201);

    const reqId = createRes.body.id;

    const patchRes = await request(httpServer)
      .patch(`/projects/${projectA1Id}/requirements/${reqId}`)
      .set('Authorization', 'Bearer user-a.token')
      .send({
        title: 'Updated Title',
        description: 'Updated Description',
        referenceKey: 'NEW-REF',
      })
      .expect(200);

    expect(patchRes.body.title).toBe('Updated Title');
    expect(patchRes.body.description).toBe('Updated Description');
    expect(patchRes.body.referenceKey).toBe('NEW-REF');

    // Delete requirement
    await request(httpServer)
      .delete(`/projects/${projectA1Id}/requirements/${reqId}`)
      .set('Authorization', 'Bearer user-a.token')
      .expect(204);

    // Subsequent GET returns 404
    await request(httpServer)
      .get(`/projects/${projectA1Id}/requirements/${reqId}`)
      .set('Authorization', 'Bearer user-a.token')
      .expect(404);
  });
});
