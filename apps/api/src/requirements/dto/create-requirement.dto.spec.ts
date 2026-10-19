import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateRequirementDto } from './create-requirement.dto';

describe('CreateRequirementDto', () => {
  it('validates a valid requirement payload and trims fields', async () => {
    const dto = plainToInstance(CreateRequirementDto, {
      title: '  User Login Requirement  ',
      description:
        '  The user must be able to log in with email and password.  ',
      referenceKey: '  REQ-101  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('User Login Requirement');
    expect(dto.description).toBe(
      'The user must be able to log in with email and password.',
    );
    expect(dto.referenceKey).toBe('REQ-101');
  });

  it('allows optional referenceKey and externalReference to be omitted or null', async () => {
    const dtoOmitted = plainToInstance(CreateRequirementDto, {
      title: 'Valid Title',
      description: 'Valid Description',
    });
    const errors1 = await validate(dtoOmitted);
    expect(errors1).toHaveLength(0);

    const dtoNull = plainToInstance(CreateRequirementDto, {
      title: 'Valid Title',
      description: 'Valid Description',
      referenceKey: null,
      externalReference: null,
    });
    const errors2 = await validate(dtoNull);
    expect(errors2).toHaveLength(0);
  });

  it('rejects missing, empty, or whitespace-only title', async () => {
    const dtoMissing = plainToInstance(CreateRequirementDto, {
      description: 'Valid Description',
    });
    const errorsMissing = await validate(dtoMissing);
    expect(errorsMissing.some((e) => e.property === 'title')).toBe(true);

    const dtoEmpty = plainToInstance(CreateRequirementDto, {
      title: '',
      description: 'Valid Description',
    });
    const errorsEmpty = await validate(dtoEmpty);
    expect(errorsEmpty.some((e) => e.property === 'title')).toBe(true);

    const dtoSpaces = plainToInstance(CreateRequirementDto, {
      title: '   ',
      description: 'Valid Description',
    });
    const errorsSpaces = await validate(dtoSpaces);
    expect(errorsSpaces.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects title longer than 255 characters', async () => {
    const dto = plainToInstance(CreateRequirementDto, {
      title: 'a'.repeat(256),
      description: 'Valid Description',
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects missing, empty, or whitespace-only description', async () => {
    const dtoMissing = plainToInstance(CreateRequirementDto, {
      title: 'Valid Title',
    });
    const errorsMissing = await validate(dtoMissing);
    expect(errorsMissing.some((e) => e.property === 'description')).toBe(true);

    const dtoEmpty = plainToInstance(CreateRequirementDto, {
      title: 'Valid Title',
      description: '',
    });
    const errorsEmpty = await validate(dtoEmpty);
    expect(errorsEmpty.some((e) => e.property === 'description')).toBe(true);

    const dtoSpaces = plainToInstance(CreateRequirementDto, {
      title: 'Valid Title',
      description: '    ',
    });
    const errorsSpaces = await validate(dtoSpaces);
    expect(errorsSpaces.some((e) => e.property === 'description')).toBe(true);
  });

  it('rejects referenceKey or externalReference longer than 100 characters', async () => {
    const dtoKey = plainToInstance(CreateRequirementDto, {
      title: 'Valid Title',
      description: 'Valid Description',
      referenceKey: 'k'.repeat(101),
    });
    const errorsKey = await validate(dtoKey);
    expect(errorsKey.some((e) => e.property === 'referenceKey')).toBe(true);

    const dtoRef = plainToInstance(CreateRequirementDto, {
      title: 'Valid Title',
      description: 'Valid Description',
      externalReference: 'e'.repeat(101),
    });
    const errorsRef = await validate(dtoRef);
    expect(errorsRef.some((e) => e.property === 'externalReference')).toBe(
      true,
    );
  });
});
