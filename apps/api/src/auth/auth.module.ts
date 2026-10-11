import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtStrategy } from '../strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const getRequiredConfig = (
  configService: ConfigService,
  key: string,
): string => {
  const value = configService.get<string>(key);

  if (!value) {
    throw new Error(`${key} environment variable is required`);
  }

  return value;
};

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const expiresIn = getRequiredConfig(
          configService,
          'JWT_EXPIRES_IN',
        ) as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

        return {
          secret: getRequiredConfig(configService, 'JWT_SECRET'),
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
