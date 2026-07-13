export function renderFatalStartupError(
  failure: unknown,
  targetDocument: Document = document,
): void {
  const message = failure instanceof Error ? failure.message : String(failure);
  const panel = targetDocument.createElement('main');
  panel.className = 'fatal-startup-error';
  panel.setAttribute('role', 'alert');
  panel.setAttribute('aria-live', 'assertive');

  const heading = targetDocument.createElement('h1');
  heading.textContent = 'Age of Empires could not start';
  const detail = targetDocument.createElement('p');
  detail.textContent = message;
  panel.append(heading, detail);

  const host = targetDocument.getElementById('app');
  if (host) host.replaceChildren(panel);
  else targetDocument.body.replaceChildren(panel);
}
