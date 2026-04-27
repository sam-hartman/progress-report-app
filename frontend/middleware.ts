import { next } from '@vercel/functions';

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login - Quarterly Progress Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 50%, #3182ce 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .login-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 2.5rem;
      width: 100%;
      max-width: 420px;
      text-align: center;
    }
    .logo-icon {
      width: 64px;
      height: 64px;
      background: #3182ce;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      font-size: 28px;
    }
    h1 {
      font-size: 1.25rem;
      color: #1a365d;
      font-weight: 700;
      line-height: 1.4;
      margin-bottom: 0.25rem;
    }
    .subtitle {
      font-size: 0.875rem;
      color: #718096;
      margin-bottom: 2rem;
    }
    .error-message {
      background: #fed7d7;
      color: #c53030;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      margin-bottom: 1rem;
      display: none;
    }
    .error-message.visible { display: block; }
    .input-group {
      text-align: left;
      margin-bottom: 1.5rem;
    }
    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
      margin-bottom: 0.5rem;
    }
    input[type="password"] {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }
    input[type="password"]:focus {
      border-color: #3182ce;
      box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.15);
    }
    button {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #3182ce;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #2b6cb0; }
    button:active { background: #2c5282; }
    button:disabled {
      background: #a0aec0;
      cursor: not-allowed;
    }
    .footer {
      margin-top: 1.5rem;
      font-size: 0.75rem;
      color: #a0aec0;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="logo-icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    </div>
    <h1>Quarterly Progress Report</h1>
    <p class="subtitle">Maryland Public School System</p>
    <div id="error" class="error-message">Incorrect password. Please try again.</div>
    <form id="loginForm">
      <div class="input-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" placeholder="Enter password" autocomplete="current-password" required autofocus />
      </div>
      <button type="submit" id="submitBtn">Sign In</button>
    </form>
    <p class="footer">Access restricted to authorized users</p>
  </div>
  <script>
    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('error');
    const submitBtn = document.getElementById('submitBtn');
    const passwordInput = document.getElementById('password');

    // Check for error param in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === '1') {
      errorEl.classList.add('visible');
      passwordInput.focus();
    }

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      errorEl.classList.remove('visible');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: passwordInput.value }),
        });

        if (res.ok) {
          window.location.href = '/';
        } else {
          errorEl.classList.add('visible');
          passwordInput.value = '';
          passwordInput.focus();
        }
      } catch (err) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.add('visible');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });
  </script>
</body>
</html>`;

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|favicon\\.svg|manifest\\.json|og-image\\.png|pwa-.*\\.png|apple-touch-icon\\.png|masked-icon\\.svg|sw\\.js|workbox-.*\\.js).*)'],
};

export default function middleware(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = parseCookies(cookieHeader);
  const authToken = cookies['qpr-auth'];

  if (authToken === 'authenticated') {
    return next();
  }

  return new Response(LOGIN_HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const pair of cookieHeader.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const key = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}
