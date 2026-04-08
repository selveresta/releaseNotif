import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSubscriptionService } from '../../src/services/subscription.service';
import { RepositoryNotFoundError, SubscriptionAlreadyExistsError, TokenAlreadyUsedError, TokenNotFoundError } from '../../src/shared/errors/app-error';

function makeService(overrides?: Partial<Parameters<typeof createSubscriptionService>[0]>) {
  const repositories = {
    findByFullName: vi.fn(),
    create: vi.fn(),
    getOrCreate: vi.fn(),
  } as unknown as Parameters<typeof createSubscriptionService>[0]['repositories'];
  const subscriptions = {
    findByEmailAndRepositoryId: vi.fn(),
    findActiveOrPendingByEmailAndRepositoryId: vi.fn(),
    createPending: vi.fn(),
    deleteById: vi.fn(),
    findByConfirmToken: vi.fn(),
    activatePendingByConfirmToken: vi.fn(),
    findByUnsubscribeToken: vi.fn(),
    unsubscribeActiveByToken: vi.fn(),
    listActiveByEmail: vi.fn(),
  } as unknown as Parameters<typeof createSubscriptionService>[0]['subscriptions'];
  const github = {
    getRepository: vi.fn(),
  } as unknown as Parameters<typeof createSubscriptionService>[0]['github'];
  const notifier = {
    sendConfirmationEmail: vi.fn(),
    sendReleaseNotificationEmail: vi.fn(),
  } as unknown as Parameters<typeof createSubscriptionService>[0]['notifier'];

  const service = createSubscriptionService({
    repositories,
    subscriptions,
    github,
    notifier,
    ...overrides,
  });

  return { service, repositories, subscriptions, github, notifier };
}

describe('subscription service', () => {
  it('successful subscribe', async () => {
    const { service, repositories, subscriptions, github, notifier } = makeService();
    vi.mocked((repositories as any).getOrCreate).mockResolvedValue({ id: 1, owner: 'golang', name: 'go', fullName: 'golang/go' });
    vi.mocked(github.getRepository).mockResolvedValue({ full_name: 'golang/go', html_url: 'https://github.com/golang/go' });
    vi.mocked((subscriptions as any).findActiveOrPendingByEmailAndRepositoryId).mockResolvedValue(null);
    vi.mocked((subscriptions as any).createPending).mockResolvedValue({ id: 1, status: 'pending_confirmation' });
    vi.mocked(notifier.sendConfirmationEmail).mockResolvedValue(undefined);

    const result = await service.subscribe({ email: 'user@example.com', repository: 'golang/go' });

    expect(result.email).toBe('user@example.com');
    expect(result.repository).toBe('golang/go');
  });

  it('400 on invalid repo format', async () => {
    const { service } = makeService();
    await expect(service.subscribe({ email: 'user@example.com', repository: 'invalid' })).rejects.toThrow();
  });

  it('404 on repo not found', async () => {
    const { service, github } = makeService();
    vi.mocked(github.getRepository).mockRejectedValue(new RepositoryNotFoundError());

    await expect(service.subscribe({ email: 'user@example.com', repository: 'golang/go' })).rejects.toThrow(RepositoryNotFoundError);
  });

  it('handling of already existing subscription', async () => {
    const { service, repositories, subscriptions, github } = makeService();
    vi.mocked(github.getRepository).mockResolvedValue({ full_name: 'golang/go', html_url: 'https://github.com/golang/go' });
    vi.mocked((repositories as any).getOrCreate).mockResolvedValue({ id: 1, owner: 'golang', name: 'go', fullName: 'golang/go' });
    vi.mocked((subscriptions as any).findActiveOrPendingByEmailAndRepositoryId).mockResolvedValue({ status: 'active' });

    await expect(service.subscribe({ email: 'user@example.com', repository: 'golang/go' })).rejects.toThrow(SubscriptionAlreadyExistsError);
  });

  it('confirm by valid token', async () => {
    const { service, subscriptions } = makeService();
    vi.mocked((subscriptions as any).findByConfirmToken).mockResolvedValue({ status: 'pending_confirmation' });
    vi.mocked((subscriptions as any).activatePendingByConfirmToken).mockResolvedValue({ status: 'active' });

    await expect(service.confirm('token')).resolves.toEqual({ message: 'Subscription confirmed successfully.' });
  });

  it('confirm token used twice returns 410', async () => {
    const { service, subscriptions } = makeService();
    vi.mocked((subscriptions as any).findByConfirmToken)
      .mockResolvedValueOnce({ status: 'pending_confirmation' })
      .mockResolvedValueOnce({ status: 'active' });
    vi.mocked((subscriptions as any).activatePendingByConfirmToken)
      .mockResolvedValueOnce({ status: 'active' })
      .mockResolvedValueOnce(null);

    await expect(service.confirm('token')).resolves.toEqual({ message: 'Subscription confirmed successfully.' });
    await expect(service.confirm('token')).rejects.toThrow(TokenAlreadyUsedError);
  });

  it('confirm concurrent double use returns one success and one 410', async () => {
    const { service, subscriptions } = makeService();
    vi.mocked((subscriptions as any).findByConfirmToken).mockResolvedValue({ status: 'pending_confirmation' });
    vi.mocked((subscriptions as any).activatePendingByConfirmToken)
      .mockResolvedValueOnce({ status: 'active' })
      .mockResolvedValueOnce(null);

    const results = await Promise.allSettled([service.confirm('token'), service.confirm('token')]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(rejection && rejection.status === 'rejected' ? rejection.reason : null).toBeInstanceOf(TokenAlreadyUsedError);
  });

  it('error on invalid confirm token', async () => {
    const { service, subscriptions } = makeService();
    vi.mocked((subscriptions as any).findByConfirmToken).mockResolvedValue(null);

    await expect(service.confirm('token')).rejects.toThrow(TokenNotFoundError);
  });

  it('unsubscribe by valid token', async () => {
    const { service, subscriptions } = makeService();
    vi.mocked((subscriptions as any).findByUnsubscribeToken).mockResolvedValue({ status: 'active' });
    vi.mocked((subscriptions as any).unsubscribeActiveByToken).mockResolvedValue({ status: 'unsubscribed' });

    await expect(service.unsubscribe('token')).resolves.toEqual({ message: 'Unsubscribed successfully.' });
  });

  it('unsubscribe token used twice returns 410', async () => {
    const { service, subscriptions } = makeService();
    vi.mocked((subscriptions as any).findByUnsubscribeToken)
      .mockResolvedValueOnce({ status: 'active' })
      .mockResolvedValueOnce({ status: 'unsubscribed' });
    vi.mocked((subscriptions as any).unsubscribeActiveByToken)
      .mockResolvedValueOnce({ status: 'unsubscribed' })
      .mockResolvedValueOnce(null);

    await expect(service.unsubscribe('token')).resolves.toEqual({ message: 'Unsubscribed successfully.' });
    await expect(service.unsubscribe('token')).rejects.toThrow(TokenAlreadyUsedError);
  });

  it('unsubscribe concurrent double use returns one success and one 410', async () => {
    const { service, subscriptions } = makeService();
    vi.mocked((subscriptions as any).findByUnsubscribeToken).mockResolvedValue({ status: 'active' });
    vi.mocked((subscriptions as any).unsubscribeActiveByToken)
      .mockResolvedValueOnce({ status: 'unsubscribed' })
      .mockResolvedValueOnce(null);

    const results = await Promise.allSettled([service.unsubscribe('token'), service.unsubscribe('token')]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(rejection && rejection.status === 'rejected' ? rejection.reason : null).toBeInstanceOf(TokenAlreadyUsedError);
  });

  it('error on invalid unsubscribe token', async () => {
    const { service, subscriptions } = makeService();
    vi.mocked((subscriptions as any).findByUnsubscribeToken).mockResolvedValue(null);

    await expect(service.unsubscribe('token')).rejects.toThrow(TokenNotFoundError);
  });
});
