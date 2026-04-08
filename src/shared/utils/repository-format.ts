import { InvalidRepositoryFormatError } from '../errors/app-error';

export type RepositoryCoordinates = {
  owner: string;
  name: string;
  fullName: string;
};

export function parseRepositoryFullName(input: string): RepositoryCoordinates {
  const value = input.trim();
  const parts = value.split('/');

  if (parts.length !== 2) {
    throw new InvalidRepositoryFormatError();
  }

  const [owner, name] = parts;
  if (!owner || !name) {
    throw new InvalidRepositoryFormatError();
  }

  return {
    owner,
    name,
    fullName: `${owner}/${name}`,
  };
}
