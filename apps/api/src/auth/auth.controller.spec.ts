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

          if (request.headers.authorization !== 'Bearer valid.jwt.token') {
            throw new UnauthorizedException();
          }

          request.user = {
            id: 'user-id',
            email: 'user@example.com',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          };

          return true;
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

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

describe('AuthController', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
          },
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

  it('rejects /auth/me when the JWT is missing', async () => {
    await request(httpServer).get('/auth/me').expect(401);
  });

  it('rejects /auth/me when the JWT is invalid', async () => {
    await request(httpServer)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token')
      .expect(401);
  });

  it('returns the safe current user profile for a valid JWT', async () => {
    const response = await request(httpServer)
      .get('/auth/me')
      .set('Authorization', 'Bearer valid.jwt.token')
      .expect(200);

    expect(response.body).toEqual({
      id: 'user-id',
      email: 'user@example.com',
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
    expect(response.body).not.toHaveProperty('passwordHash');
  });
});
