import { ExternalApiFailureError, GitHubRateLimitError, RepositoryNotFoundError } from '../../shared/errors/app-error';

export class GithubRepositoryNotFoundError extends RepositoryNotFoundError {
  constructor() {
    super();
    this.name = 'GithubRepositoryNotFoundError';
  }
}

export class GithubRateLimitError extends GitHubRateLimitError {
  constructor() {
    super();
    this.name = 'GithubRateLimitError';
  }
}

export class GithubExternalApiError extends ExternalApiFailureError {
  constructor(message = 'GitHub API request failed.') {
    super(message);
    this.name = 'GithubExternalApiError';
  }
}
