import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateRequirementDto } from './update-requirement.dto';

describe('UpdateRequirementDto', () => {
  it('allows empty partial update payload', async () => {
    const dto = plainToInstance(UpdateRequirementDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('validates and trims provided fields', async () => {
    const dto = plainToInstance(UpdateRequirementDto, {
      title: '  Updated Requirement Title  ',
      description: '  Updated Requirement Description  ',
      referenceKey: '  REQ-102  ',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('Updated Requirement Title');
    expect(dto.description).toBe('Updated Requirement Description');
    expect(dto.referenceKey).toBe('REQ-102');
  });

  it('rejects empty or whitespace-only title if provided', async () => {
    const dtoEmpty = plainToInstance(UpdateRequirementDto, {
      title: '',
    });
    const errorsEmpty = await validate(dtoEmpty);
    expect(errorsEmpty.some((e) => e.property === 'title')).toBe(true);

    const dtoSpaces = plainToInstance(UpdateRequirementDto, {
      title: '   ',
    });
    const errorsSpaces = await validate(dtoSpaces);
    expect(errorsSpaces.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects empty or whitespace-only description if provided', async () => {
    const dtoEmpty = plainToInstance(UpdateRequirementDto, {
      description: '',
    });
    const errorsEmpty = await validate(dtoEmpty);
    expect(errorsEmpty.some((e) => e.property === 'description')).toBe(true);

    const dtoSpaces = plainToInstance(UpdateRequirementDto, {
      description: '   ',
    });
    const errorsSpaces = await validate(dtoSpaces);
    expect(errorsSpaces.some((e) => e.property === 'description')).toBe(true);
  });

  it('rejects title longer than 255 characters', async () => {
    const dto = plainToInstance(UpdateRequirementDto, {
      title: 'b'.repeat(256),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects referenceKey or externalReference longer than 100 characters', async () => {
    const dto = plainToInstance(UpdateRequirementDto, {
      referenceKey: 'c'.repeat(101),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'referenceKey')).toBe(true);
  });
});
