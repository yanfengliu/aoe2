import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import './styles.css';
import './hudChrome.css';
import './hudIcons.css';
import './hudCommandPanel.css';

import { createApp } from './app/bootstrap/createApp';
import { renderFatalStartupError } from './app/bootstrap/renderFatalStartupError';

void createApp().catch((error: unknown) => {
  console.error('[aoe2] startup failed', error);
  renderFatalStartupError(error);
});
