/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { QueryFailedError, Repository } from 'typeorm';

import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { User } from '../users/entities/user.entity';
import { SafeUser } from './interfaces/safe-user.interface';

interface PostgresDriverError {
  code?: string;
}

type UserWithPasswordHash = Pick<User, 'passwordHash'>;

@Injectable()
export class AuthService {
  private readonly bcryptSaltRounds = 12;
  private readonly invalidCredentialsMessage = 'Invalid email or password';

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<SafeUser> {
    const email = this.normalizeEmail(registerDto.email);

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(
      registerDto.password,
      this.bcryptSaltRounds,
    );

    try {
      const user = this.usersRepository.create({
        email,
        passwordHash,
      });
      const savedUser = await this.usersRepository.save(user);

      return this.toSafeUser(savedUser);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }

      throw new InternalServerErrorException('Unable to register user');
    }
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ accessToken: string; user: SafeUser }> {
    const email = this.normalizeEmail(loginDto.email);
    const user = await this.usersRepository.findOne({
      where: { email },
    });

    if (!user || !(await this.isPasswordValid(loginDto.password, user))) {
      throw new UnauthorizedException(this.invalidCredentialsMessage);
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
    });

    return {
      accessToken,
      user: this.toSafeUser(user),
    };
  }

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async isPasswordValid(
    password: string,
    user: UserWithPasswordHash,
  ): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as PostgresDriverError | undefined;

    return driverError?.code === '23505';
  }
}
