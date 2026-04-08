import { describe, expect, it } from 'vitest';
import { parseRepositoryFullName } from '../../src/shared/utils/repository-format';

describe('parseRepositoryFullName', () => {
  it('accepts valid owner/repo', () => {
    expect(parseRepositoryFullName('golang/go')).toEqual({
      owner: 'golang',
      name: 'go',
      fullName: 'golang/go',
    });
  });

  it('rejects missing slash', () => {
    expect(() => parseRepositoryFullName('golanggo')).toThrow();
  });

  it('rejects empty owner', () => {
    expect(() => parseRepositoryFullName('/go')).toThrow();
  });

  it('rejects empty repo', () => {
    expect(() => parseRepositoryFullName('golang/')).toThrow();
  });

  it('rejects third segment', () => {
    expect(() => parseRepositoryFullName('golang/go/extra')).toThrow();
  });
});
