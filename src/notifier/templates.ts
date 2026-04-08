function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildConfirmationEmailTemplate(input: {
  email: string;
  repositoryFullName: string;
  confirmUrl: string;
  unsubscribeUrl: string;
}) {
  const subject = `Confirm your subscription for ${input.repositoryFullName}`;
  const text = [
    `You subscribed to release notifications for ${input.repositoryFullName}.`,
    `Confirm: ${input.confirmUrl}`,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join('\n');

  const html = `
    <p>You subscribed to release notifications for <strong>${escapeHtml(input.repositoryFullName)}</strong>.</p>
    <p><a href="${escapeHtml(input.confirmUrl)}">Confirm subscription</a></p>
    <p><a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe</a></p>
  `;

  return { subject, text, html };
}

export function buildReleaseNotificationTemplate(input: {
  repositoryFullName: string;
  releaseTag: string;
  releaseUrl: string;
  unsubscribeUrl: string;
}) {
  const subject = `New release for ${input.repositoryFullName}: ${input.releaseTag}`;
  const text = [
    `A new release was published for ${input.repositoryFullName}.`,
    `Tag: ${input.releaseTag}`,
    `Release: ${input.releaseUrl}`,
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join('\n');

  const html = `
    <p>A new release was published for <strong>${escapeHtml(input.repositoryFullName)}</strong>.</p>
    <p>Tag: <strong>${escapeHtml(input.releaseTag)}</strong></p>
    <p><a href="${escapeHtml(input.releaseUrl)}">Open release</a></p>
    <p><a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe</a></p>
  `;

  return { subject, text, html };
}
