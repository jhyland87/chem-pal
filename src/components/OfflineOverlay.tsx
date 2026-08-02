import { i18n } from '@/helpers/i18n';
import { ThemeContext } from '@/themes';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import { useContext, useEffect, useState } from 'react';

/**
 * Full-screen overlay shown whenever the browser reports it is offline. It
 * listens for the `window` `offline`/`online` events and covers the whole UI
 * with a "network connection issue" message that clears itself once the
 * connection returns. The Chrome offline dino (theme-matched) sits across the
 * bottom.
 * @component
 * @category Components
 * @returns The offline overlay (renders nothing while online).
 * @example
 * ```tsx
 * <ThemeProvider>
 *   <OfflineOverlay />
 *   <App />
 * </ThemeProvider>
 * ```
 * @source
 */
export default function OfflineOverlay() {
  const themeContext = useContext(ThemeContext);
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    // Reconcile in case connectivity changed between the initial render and mount.
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const dinoSrc =
    themeContext?.mode === 'dark'
      ? '/static/images/dino-dark-theme.png'
      : '/static/images/dino-light-theme.png';

  return (
    <Modal
      open={offline}
      aria-labelledby="offline-overlay-title"
      aria-describedby="offline-overlay-message"
    >
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          bgcolor: 'background.default',
          color: 'text.primary',
          p: 3,
          outline: 'none',
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Typography id="offline-overlay-title" variant="h6" component="h2">
            {i18n('offline_title')}
          </Typography>
          <Typography
            id="offline-overlay-message"
            variant="body2"
            sx={{ maxWidth: 320, color: 'text.secondary' }}
          >
            {i18n('offline_message')}
          </Typography>
        </Box>
        <Box
          component="img"
          data-testid="offline-dino"
          src={dinoSrc}
          alt=""
          sx={{
            width: '100%',
            //maxWidth: 260,
            height: 'auto',
            imageRendering: 'pixelated',
            mt: 'auto',
            pb: 1,
          }}
        />
      </Box>
    </Modal>
  );
}
