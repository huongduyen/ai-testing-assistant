import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  it('normalizes email before validation', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: '  User@Example.COM ',
      password: 'Password123',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('user@example.com');
  });

  it('rejects passwords that do not meet complexity requirements', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'password',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
