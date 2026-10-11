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
      const providers = entities.map((entity) => ({
        provide: `${entity.name}Repository`,
        useValue: {
          findOne: jest.fn(),
          create: jest.fn(),
          save: jest.fn(),
        },
      }));

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
      canActivate(): boolean {
        return true;
      }
    },
  PassportModule: {
    register: () => ({
      module: class PassportTestingModule {},
    }),
  },
  PassportStrategy: () => class {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', async () => {
    await request(httpServer).get('/').expect(200).expect('Hello World!');
  });
});
