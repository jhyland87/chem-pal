import { PRODUCT_REFRESH_STATUS } from '@/constants/common';
import { getErrorMessage } from '@/helpers/exceptions';
import { i18n } from '@/helpers/i18n';
import { hasNotificationPermission, requestNotificationPermission } from '@/helpers/permissions';
import { formatWithSymbol } from '@/helpers/price';
import { removePriceAlerts, type PriceAlert } from '@/helpers/priceAlerts';
import { formatTimestamp } from '@/helpers/utils';
import { Logger } from '@/utils/Logger';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

const logger = new Logger('PriceAlertsPanel');

/** Props for {@link PriceAlertsPanel}. */
interface PriceAlertsPanelProps {
  /** The alerts to list. */
  alerts: PriceAlert[];
}

/**
 * Formats an alert's last known price: the product's own, or its cheapest size.
 * @param alert - The alert
 * @returns The price in the supplier's currency, or undefined when none is known
 * @example
 * ```ts
 * formatLastPrice(alert); // '$19.50'
 * ```
 * @source
 */
function formatLastPrice({ id, lastPrices }: PriceAlert): string | undefined {
  const [cheapest] = Object.values(lastPrices).sort((a, b) => a.price - b.price);
  const snapshot = lastPrices[id] ?? cheapest;
  return snapshot && formatWithSymbol(snapshot.currencyCode ?? 'USD', snapshot.price);
}

/**
 * Describes how an alert's last check went.
 * @param alert - The alert
 * @returns Lines to show under its title
 * @example
 * ```ts
 * describeAlert(alert); // ['Carolina Chemical — $19.50', 'Last checked Nov 24, 2:15 PM']
 * ```
 * @source
 */
function describeAlert(alert: PriceAlert): string[] {
  const { supplier, lastCheckedAt, lastDrop, lastStatus, failures } = alert;
  const lines = [
    [supplier, formatLastPrice(alert)].filter(Boolean).join(' — '),
    lastCheckedAt === undefined
      ? i18n('price_alerts_not_checked')
      : i18n('price_alerts_last_checked', [formatTimestamp(lastCheckedAt)]),
  ];
  if (lastDrop) {
    const { at, from, to, currencyCode = 'USD' } = lastDrop;
    lines.push(
      i18n('price_alerts_last_drop', [
        formatWithSymbol(currencyCode, from),
        formatWithSymbol(currencyCode, to),
        formatTimestamp(at),
      ]),
    );
  }
  if (lastStatus === PRODUCT_REFRESH_STATUS.UNAVAILABLE) {
    lines.push(i18n('price_alerts_unavailable'));
  } else if (lastStatus === PRODUCT_REFRESH_STATUS.FAILED) {
    lines.push(i18n('price_alerts_check_failed', [String(failures)]));
  }
  return lines;
}

/**
 * Lists the products being watched for price drops, with controls to stop watching one, several or
 * all of them.
 * @category Components
 * @group Price Alerts
 * @param props - Component props
 * @returns The panel
 * @example
 * ```tsx
 * <PriceAlertsPanel alerts={usePriceAlerts()} />
 * ```
 * @source
 */
export function PriceAlertsPanel({ alerts }: PriceAlertsPanelProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  // Assume granted until known, so the prompt doesn't flash.
  const [canNotify, setCanNotify] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setCanNotify(await hasNotificationPermission());
      } catch (error) {
        logger.warn(`Failed to check notification permission: ${getErrorMessage(error)}`, {
          error,
        });
      }
    };
    void load();
  }, []);

  // Alerts can be removed elsewhere while selected.
  const selectedIds = alerts.map(({ id }) => id).filter((id) => selected.has(id));
  const isAllSelected = selectedIds.length === alerts.length;

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds);
    if (!next.delete(id)) next.add(id);
    setSelected(next);
  };

  const handleToggleAll = () => {
    setSelected(new Set(isAllSelected ? [] : alerts.map(({ id }) => id)));
  };

  const handleRemove = async (ids: string[]) => {
    try {
      await removePriceAlerts(ids);
    } catch (error) {
      logger.warn(`Failed to remove price alerts: ${getErrorMessage(error)}`, { error });
    }
  };

  const handleRemoveAll = () => {
    setIsConfirmOpen(false);
    void handleRemove(alerts.map(({ id }) => id));
  };

  const handleAllowNotifications = async () => {
    try {
      setCanNotify(await requestNotificationPermission());
    } catch (error) {
      logger.warn(`Failed to request notifications: ${getErrorMessage(error)}`, { error });
    }
  };

  if (alerts.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 1.5 }}>
        {i18n('price_alerts_empty')}
      </Typography>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      {!canNotify && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {i18n('price_alerts_notifications_off')}
          </Typography>
          <Button size="small" variant="outlined" onClick={() => void handleAllowNotifications()}>
            {i18n('price_alerts_allow_notifications')}
          </Button>
        </Stack>
      )}
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={isAllSelected}
            indeterminate={selectedIds.length > 0 && !isAllSelected}
            onChange={handleToggleAll}
          />
        }
        label={<Typography variant="caption">{i18n('price_alerts_select_all')}</Typography>}
        sx={{ ml: 0 }}
      />
      <List dense disablePadding>
        {alerts.map((alert) => (
          <ListItem
            key={alert.id}
            divider
            disablePadding
            secondaryAction={
              <Tooltip title={i18n('settings_remove')}>
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => void handleRemove([alert.id])}
                  aria-label={i18n('settings_remove_item', [alert.title])}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            }
          >
            <ListItemIcon sx={{ minWidth: 0 }}>
              <Checkbox
                size="small"
                checked={selected.has(alert.id)}
                onChange={() => handleToggle(alert.id)}
                slotProps={{
                  input: { 'aria-label': i18n('price_alerts_select_item', [alert.title]) },
                }}
              />
            </ListItemIcon>
            <ListItemText
              primary={
                <Link
                  href={alert.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                >
                  {alert.title}
                </Link>
              }
              secondary={describeAlert(alert).map((line) => (
                <Box component="span" key={line} sx={{ display: 'block' }}>
                  {line}
                </Box>
              ))}
              slotProps={{ secondary: { variant: 'caption' } }}
            />
          </ListItem>
        ))}
      </List>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button
          fullWidth
          variant="outlined"
          size="small"
          disabled={selectedIds.length === 0}
          onClick={() => void handleRemove(selectedIds)}
        >
          {i18n('price_alerts_delete_selected', [String(selectedIds.length)])}
        </Button>
        <Button
          fullWidth
          variant="outlined"
          color="warning"
          size="small"
          onClick={() => setIsConfirmOpen(true)}
        >
          {i18n('price_alerts_delete_all')}
        </Button>
      </Stack>

      <Dialog
        open={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        aria-labelledby="price-alerts-dialog-title"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="price-alerts-dialog-title">
          {i18n('price_alerts_delete_all_title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {i18n('price_alerts_delete_all_body', [String(alerts.length)])}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsConfirmOpen(false)}>{i18n('migration_cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleRemoveAll}>
            {i18n('price_alerts_delete_all')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
