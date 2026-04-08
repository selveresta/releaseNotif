import type { GitHubClient } from '../integrations/github/github.client';
import { DuplicateSubscriptionError, SubscriptionAlreadyExistsError, TokenAlreadyUsedError, TokenNotFoundError } from '../shared/errors/app-error';
import { parseRepositoryFullName } from '../shared/utils/repository-format';
import { generateToken } from '../shared/utils/tokens';
import type { NotifierService } from '../notifier/notifier.service';
import type { RepositoryRepository } from '../repositories/repository.repository';
import type { SubscriptionRepository } from '../repositories/subscription.repository';

export type SubscribeInput = {
  email: string;
  repository: string;
};

export function createSubscriptionService(deps: {
  repositories: RepositoryRepository;
  subscriptions: SubscriptionRepository;
  github: GitHubClient;
  notifier: NotifierService;
}) {
  return {
    async subscribe(input: SubscribeInput) {
      const parsed = parseRepositoryFullName(input.repository);

      const email = input.email.trim().toLowerCase();
      await deps.github.getRepository(parsed.owner, parsed.name);

      const existingRepository = await deps.repositories.getOrCreate(parsed);

      const existingSubscription = await deps.subscriptions.findActiveOrPendingByEmailAndRepositoryId(email, existingRepository.id);
      if (existingSubscription) {
        throw new SubscriptionAlreadyExistsError();
      }

      const confirmToken = generateToken();
      const unsubscribeToken = generateToken();

      let created: { id: number } | null = null;
      try {
        created = await deps.subscriptions.createPending({
          email,
          repositoryId: existingRepository.id,
          confirmToken,
          unsubscribeToken,
        });
      } catch (error) {
        if (error instanceof DuplicateSubscriptionError) {
          throw new SubscriptionAlreadyExistsError();
        }

        throw error;
      }

      try {
        if (!created) {
          throw new Error('Subscription row was not created.');
        }
        await deps.notifier.sendConfirmationEmail({
          email,
          repositoryFullName: existingRepository.fullName,
          confirmToken,
          unsubscribeToken,
        });
      } catch (error) {
        if (created) {
          await deps.subscriptions.deleteById(created.id);
        }
        throw error;
      }

      return {
        message: 'Confirmation email sent. Please confirm your subscription.',
        email,
        repository: existingRepository.fullName,
      };
    },

    async confirm(token: string) {
      const subscription = await deps.subscriptions.findByConfirmToken(token);
      if (!subscription) {
        throw new TokenNotFoundError('Confirmation token not found.');
      }

      const updated = await deps.subscriptions.activatePendingByConfirmToken(token);
      if (!updated) {
        const current = await deps.subscriptions.findByConfirmToken(token);
        if (current && current.status !== 'pending_confirmation') {
          throw new TokenAlreadyUsedError('Subscription has already been confirmed.');
        }

        throw new TokenAlreadyUsedError('Subscription has already been confirmed.');
      }

      return { message: 'Subscription confirmed successfully.' };
    },

    async unsubscribe(token: string) {
      const subscription = await deps.subscriptions.findByUnsubscribeToken(token);
      if (!subscription) {
        throw new TokenNotFoundError('Unsubscribe token not found.');
      }

      const updated = await deps.subscriptions.unsubscribeActiveByToken(token);
      if (!updated) {
        const current = await deps.subscriptions.findByUnsubscribeToken(token);
        if (current && current.status === 'unsubscribed') {
          throw new TokenAlreadyUsedError('Subscription already unsubscribed.');
        }

        throw new TokenAlreadyUsedError('Subscription already unsubscribed.');
      }

      return { message: 'Unsubscribed successfully.' };
    },

    async getSubscriptionsByEmail(emailInput: string) {
      const email = emailInput.trim().toLowerCase();
      const subscriptions = await deps.subscriptions.listActiveByEmail(email);
      if (subscriptions.length === 0) {
        throw new TokenNotFoundError('No subscriptions found for this email.');
      }

      return {
        email,
        subscriptions: subscriptions.map((subscription) => ({
          repository: subscription.repository,
          status: subscription.status,
          createdAt: subscription.createdAt.toISOString(),
        })),
      };
    },
  };
}

export type SubscriptionService = ReturnType<typeof createSubscriptionService>;
