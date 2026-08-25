import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import './styles.css';
import './hudChrome.css';
import './hudIcons.css';
import './hudCommandPanel.css';

import { createApp } from './app/bootstrap/createApp';
import { renderFatalStartupError } from './app/bootstrap/renderFatalStartupError';
import { mountSetupScreen, shouldShowSetupScreen } from './app/bootstrap/setupScreen';

// A bare visit gets the match setup screen (spec §4.6); Start writes the
// choices into the URL this app already reads and reloads into the match.
// Any visit WITH params — every test, harness, and shared link — boots
// straight into the game exactly as before.
if (shouldShowSetupScreen(window.location.href)) {
  mountSetupScreen(document.body);
} else {
  void createApp().catch((error: unknown) => {
    console.error('[aoe2] startup failed', error);
    renderFatalStartupError(error);
  });
}
