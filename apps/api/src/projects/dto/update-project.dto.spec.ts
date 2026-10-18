import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateProjectDto } from './update-project.dto';

describe('UpdateProjectDto', () => {
  it('allows empty partial update', async () => {
    const dto = plainToInstance(UpdateProjectDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('validates and trims updated fields', async () => {
    const dto = plainToInstance(UpdateProjectDto, {
      name: '  Updated Name  ',
      description: '  Updated Description  ',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Updated Name');
    expect(dto.description).toBe('Updated Description');
  });

  it('rejects empty or whitespace-only name if provided', async () => {
    const dtoEmpty = plainToInstance(UpdateProjectDto, {
      name: '',
    });
    const errorsEmpty = await validate(dtoEmpty);
    expect(errorsEmpty.some((error) => error.property === 'name')).toBe(true);

    const dtoSpaces = plainToInstance(UpdateProjectDto, {
      name: '   ',
    });
    const errorsSpaces = await validate(dtoSpaces);
    expect(errorsSpaces.some((error) => error.property === 'name')).toBe(true);
  });

  it('rejects name longer than 255 characters', async () => {
    const dto = plainToInstance(UpdateProjectDto, {
      name: 'b'.repeat(256),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('rejects description longer than 1000 characters', async () => {
    const dto = plainToInstance(UpdateProjectDto, {
      description: 'c'.repeat(1001),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'description')).toBe(true);
  });
});
