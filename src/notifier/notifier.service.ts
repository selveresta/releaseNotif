import nodemailer from 'nodemailer';
import type { AppEnv } from '../config/env';
import { EmailDeliveryFailureError } from '../shared/errors/app-error';
import { buildConfirmationEmailTemplate, buildReleaseNotificationTemplate } from './templates';
import type { AppMetrics } from '../infrastructure/metrics/metrics';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createNotifier(
  env: Pick<AppEnv, 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_USER' | 'SMTP_PASS' | 'SMTP_FROM' | 'APP_BASE_URL'>,
  metrics: AppMetrics,
) {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  async function sendMail(message: { to: string; subject: string; text: string; html: string }) {
    const delays = [0, 250, 750];
    for (const delay of delays) {
      if (delay > 0) {
        await sleep(delay);
      }

      try {
        await transporter.sendMail({
          from: env.SMTP_FROM,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        metrics.recordEmailSend('success');
        return;
      } catch (error) {
        if (delay === delays[delays.length - 1]) {
          metrics.recordEmailSend('failure');
          throw new EmailDeliveryFailureError();
        }
      }
    }
  }

  return {
    async sendConfirmationEmail(input: {
      email: string;
      repositoryFullName: string;
      confirmToken: string;
      unsubscribeToken: string;
    }) {
      const confirmUrl = new URL(`/api/confirm/${encodeURIComponent(input.confirmToken)}`, env.APP_BASE_URL).toString();
      const unsubscribeUrl = new URL(`/api/unsubscribe/${encodeURIComponent(input.unsubscribeToken)}`, env.APP_BASE_URL).toString();
      const template = buildConfirmationEmailTemplate({
        email: input.email,
        repositoryFullName: input.repositoryFullName,
        confirmUrl,
        unsubscribeUrl,
      });
      await sendMail({ to: input.email, ...template });
    },

    async sendReleaseNotificationEmail(input: {
      email: string;
      repositoryFullName: string;
      releaseTag: string;
      releaseUrl: string;
      unsubscribeToken: string;
    }) {
      const unsubscribeUrl = new URL(`/api/unsubscribe/${encodeURIComponent(input.unsubscribeToken)}`, env.APP_BASE_URL).toString();
      const template = buildReleaseNotificationTemplate({
        repositoryFullName: input.repositoryFullName,
        releaseTag: input.releaseTag,
        releaseUrl: input.releaseUrl,
        unsubscribeUrl,
      });
      await sendMail({ to: input.email, ...template });
    },
  };
}

export type NotifierService = ReturnType<typeof createNotifier>;
