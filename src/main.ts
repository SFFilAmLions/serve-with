import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root is missing');

const escaped = (text: string) => text.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c] || c);
const magic = new URL(location.href).searchParams.get('magic');

async function request(path: string, payload?: Record<string,string>) {
  const response = await fetch('/api/auth/' + path, { method: payload ? 'POST' : 'GET', headers: payload ? { 'content-type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined, credentials: 'same-origin' });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Request failed');
  return result;
}
function renderForm() {
  app!.innerHTML = `
    <div class="shell">
      <div class="eyebrow">SFFilAmLions · Community Service</div>
      <h1>Serve With</h1>
      <p class="lead">Making it easier to serve together.</p>
      <p class="description">Admin sign-in</p>
      <form id="request-form">
        <label for="email">Administrator email</label>
        <input id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.org">
        <button type="submit">Email me a code and sign-in link</button>
      </form>
      <form id="verify-form" hidden>
        <label for="code">Eight-digit email code</label>
        <input id="code" name="code" type="text" inputmode="numeric" pattern="[0-9]{8}" autocomplete="one-time-code" placeholder="00000000" required>
        <button type="submit">Verify code</button>
      </form>
      <form id="magic-form" ${magic ? '' : 'hidden'}>
        <p>A sign-in link was opened. Confirm using the email address that received it.</p>
        <button type="submit">Confirm magic-link sign-in</button>
      </form>
      <p id="message" role="status" aria-live="polite"></p>
      <footer>Administrator access only · Passwordless authentication</footer>
    </div>`;
  const email = app!.querySelector<HTMLInputElement>('#email')!;
  const message = app!.querySelector<HTMLParagraphElement>('#message')!;
  const verify = app!.querySelector<HTMLFormElement>('#verify-form')!;
  const show = (value: string) => { message.textContent = value; };
  app!.querySelector<HTMLFormElement>('#request-form')!.addEventListener('submit', async e => {
    e.preventDefault();
    try { const response = await request('request',{email:email.value});show(String(response.message)); verify.hidden = false; }
    catch (error) { show(error instanceof Error ? error.message : 'Something went wrong'); }
  });
  verify.addEventListener('submit',async e => {
    e.preventDefault();
    try { await request('verify',{email:email.value,code:app!.querySelector<HTMLInputElement>('#code')!.value});await render(); }
    catch (error) { show(error instanceof Error ? error.message : 'Unable to sign in'); }
  });
  app!.querySelector<HTMLFormElement>('#magic-form')!.addEventListener('submit',async e => {
    e.preventDefault();
    try {await request('magic',{email:email.value,token:magic || ''}); history.replaceState(null,'',location.pathname); await render();}
    catch (error) { show(error instanceof Error ? error.message : 'Unable to sign in'); }
  });
}
async function render() {
  try {
    const me = await request('me');
    if (me.authenticated && typeof me.email === 'string') {
      // The server verifies the session again for every protected API request.
      const protectedResponse = await fetch('/api/admin/dashboard', { credentials: 'same-origin', cache: 'no-store' });
      if (!protectedResponse.ok) throw new Error('Session is no longer authorized');
      app!.innerHTML = `<div class="shell"><div class="eyebrow">Serve With · Admin</div><h1>Dashboard</h1><p class="lead">Signed in as ${escaped(me.email)}</p><p class="description">Administrator features are coming soon.</p><button id="logout">Sign out</button></div>`;
      app!.querySelector<HTMLButtonElement>('#logout')!.addEventListener('click',async () => { await request('logout',{}); renderForm(); });
      return;
    }
  } catch { /* Auth not yet configured; render sign-in form with a clear server error on submit. */ }
  renderForm();
}
void render();
