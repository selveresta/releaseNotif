import type { Request, Response, NextFunction } from 'express';
import type { SubscriptionService } from '../services/subscription.service';
import { subscribeRequestSchema } from '../shared/validation/schemas';
import { ValidationError } from '../shared/errors/app-error';

const htmlPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GitHub Release Notification</title>
  <style>
    :root { color-scheme: light; --bg: #f6f0e8; --card: #fffdf8; --text: #1f2937; --muted: #6b7280; --accent: #0f766e; --accent-2: #115e59; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: radial-gradient(circle at top, #fff7ed, #f6f0e8 40%, #efe7da); color: var(--text); min-height: 100vh; display: grid; place-items: center; }
    .wrap { width: min(720px, calc(100vw - 32px)); }
    .hero { margin-bottom: 20px; }
    h1 { margin: 0 0 8px; font-size: clamp(2rem, 4vw, 3.5rem); letter-spacing: -0.04em; }
    p { line-height: 1.55; color: var(--muted); }
    .card { background: rgba(255, 253, 248, 0.92); backdrop-filter: blur(8px); border: 1px solid rgba(15, 118, 110, 0.14); box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12); border-radius: 24px; padding: 28px; }
    form { display: grid; gap: 14px; }
    label { font-size: 0.95rem; font-weight: 600; }
    input { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 14px 16px; border-radius: 14px; border: 1px solid #d6d3d1; font: inherit; background: white; }
    button { border: 0; border-radius: 14px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: white; padding: 14px 18px; font: inherit; font-weight: 700; cursor: pointer; }
    button:hover { filter: brightness(1.04); }
    .message { margin-top: 16px; padding: 14px 16px; border-radius: 14px; display: none; }
    .message.ok { display: block; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .message.err { display: block; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    small { color: var(--muted); }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <h1>GitHub Release Notification</h1>
      <p>Subscribe your email to a GitHub repository and get notified when a new release appears.</p>
    </section>
    <section class="card">
      <form id="subscribe-form">
        <label>Email
          <input name="email" type="email" autocomplete="email" placeholder="user@example.com" required />
        </label>
        <label>Repository
          <input name="repository" type="text" autocomplete="off" placeholder="owner/repo" required />
        </label>
        <button type="submit">Subscribe</button>
        <small>Confirm and unsubscribe links will be sent to your inbox.</small>
      </form>
      <div id="message" class="message"></div>
    </section>
  </main>
  <script>
    const form = document.getElementById('subscribe-form');
    const message = document.getElementById('message');

    function show(text, ok) {
      message.textContent = text;
      message.className = 'message ' + (ok ? 'ok' : 'err');
      message.style.display = 'block';
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        email: form.email.value.trim(),
        repository: form.repository.value.trim(),
      };

      try {
        const response = await fetch('/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          show(data.message || 'Subscription failed.', false);
          return;
        }
        show(data.message || 'Confirmation email sent.', true);
        form.reset();
      } catch (error) {
        show('Network error. Please try again.', false);
      }
    });
  </script>
</body>
</html>`;

export function createHtmlController(service: SubscriptionService) {
  return {
    page(_req: Request, res: Response) {
      res.type('html').status(200).send(htmlPage);
    },

    async submit(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = subscribeRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new ValidationError('Invalid request body.');
        }

        const result = await service.subscribe(parsed.data);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}

export type HtmlController = ReturnType<typeof createHtmlController>;
