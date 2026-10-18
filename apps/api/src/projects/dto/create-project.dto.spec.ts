import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateProjectDto } from './create-project.dto';

describe('CreateProjectDto', () => {
  it('validates a valid project payload and trims fields', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      name: '  AI Test Project  ',
      description: '  Description for project  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('AI Test Project');
    expect(dto.description).toBe('Description for project');
  });

  it('allows optional description to be omitted or null', async () => {
    const dtoWithoutDesc = plainToInstance(CreateProjectDto, {
      name: 'Project Without Description',
    });
    const errors1 = await validate(dtoWithoutDesc);
    expect(errors1).toHaveLength(0);

    const dtoWithNullDesc = plainToInstance(CreateProjectDto, {
      name: 'Project With Null Description',
      description: null,
    });
    const errors2 = await validate(dtoWithNullDesc);
    expect(errors2).toHaveLength(0);
  });

  it('rejects missing or empty name', async () => {
    const dtoEmpty = plainToInstance(CreateProjectDto, {
      name: '',
    });
    const errorsEmpty = await validate(dtoEmpty);
    expect(errorsEmpty.some((error) => error.property === 'name')).toBe(true);

    const dtoSpaces = plainToInstance(CreateProjectDto, {
      name: '   ',
    });
    const errorsSpaces = await validate(dtoSpaces);
    expect(errorsSpaces.some((error) => error.property === 'name')).toBe(true);
  });

  it('rejects name longer than 255 characters', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      name: 'a'.repeat(256),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('rejects description longer than 1000 characters', async () => {
    const dto = plainToInstance(CreateProjectDto, {
      name: 'Valid Name',
      description: 'a'.repeat(1001),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'description')).toBe(true);
  });
});
