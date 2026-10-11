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

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';

type UsersRepositoryMock = {
  findOne: jest.Mock<Promise<User | null>, [{ where: Partial<User> }]>;
  create: jest.Mock<Partial<User>, [Partial<User>]>;
  save: jest.Mock<Promise<User>, [Partial<User>]>;
};

type JwtServiceMock = {
  signAsync: jest.Mock<Promise<string>, [Record<string, string>]>;
};

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-id',
  email: 'user@example.com',
  passwordHash: 'hashed-password',
  createdAt,
  updatedAt,
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: UsersRepositoryMock;
  let jwtService: JwtServiceMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersRepository = module.get<UsersRepositoryMock>(getRepositoryToken(User));
    jwtService = module.get<JwtServiceMock>(JwtService);
  });

  it('registers a user with a normalized email and hashed password', async () => {
    usersRepository.findOne.mockResolvedValue(null);
    usersRepository.create.mockImplementation((user: Partial<User>) => user);
    usersRepository.save.mockImplementation((user: Partial<User>) =>
      Promise.resolve(
        buildUser({
          email: user.email,
          passwordHash: user.passwordHash,
        }),
      ),
    );

    const result = await service.register({
      email: '  User@Example.COM ',
      password: 'Password123',
    });

    expect(usersRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(result).toEqual({
      id: 'user-id',
      email: 'user@example.com',
      createdAt,
      updatedAt,
    });
    expect(result).not.toHaveProperty('passwordHash');

    const savedUser = usersRepository.save.mock.calls[0][0];
    const savedPasswordHash = savedUser.passwordHash;

    expect(savedPasswordHash).toBeDefined();
    expect(savedPasswordHash).not.toBe('Password123');
    await expect(
      bcrypt.compare('Password123', savedPasswordHash ?? ''),
    ).resolves.toBe(true);
  });

  it('rejects duplicate email registration', async () => {
    usersRepository.findOne.mockResolvedValue(buildUser());

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'Password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  it('logs in with valid credentials and returns a signed JWT', async () => {
    const passwordHash = await bcrypt.hash('Password123', 4);
    usersRepository.findOne.mockResolvedValue(buildUser({ passwordHash }));

    const result = await service.login({
      email: 'USER@example.com',
      password: 'Password123',
    });

    expect(usersRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-id' });
    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      user: {
        id: 'user-id',
        email: 'user@example.com',
        createdAt,
        updatedAt,
      },
    });
  });

  it('rejects invalid credentials with a generic unauthorized error', async () => {
    const passwordHash = await bcrypt.hash('Password123', 4);
    usersRepository.findOne.mockResolvedValue(buildUser({ passwordHash }));

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'WrongPassword123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});
