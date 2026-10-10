import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root is missing');

app.innerHTML = `
  <div class="shell">
    <div class="eyebrow">SFFilAmLions · Community Service</div>
    <h1>Serve With</h1>
    <p class="lead">Making it easier to serve together.</p>
    <p class="description">A new volunteer coordination platform is taking shape, one useful feature at a time.</p>
    <div class="status"><span class="dot" aria-hidden="true"></span> Project foundation · Milestone 001</div>
    <footer>More to come as we build and improve together.</footer>
  </div>
`;
