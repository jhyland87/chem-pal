
import { useSettings } from '../context';
import Tooltip from '@mui/material/Tooltip';
import _ from '../lodash';
import { HelpTooltipProps } from '../types';
import { useState, useEffect, ReactElement, MouseEvent } from 'react';



export default function HelpTooltip({ text, children, delay = 500, duration = 2000 }: HelpTooltipProps) {
  const settingsContext = useSettings();

  const [showHelp, setShowHelp] = useState(false);

  const handleTooltipClose = () => {
    setShowHelp(false);
  };

  const handleTooltipOpen = () => {
    setShowHelp(true);
  };

  // @todo: Fix this. The onClick is actually triggering a click on the
  // child element instead. the preventDefault and stopPropagation are not
  // fixing anything..
  const handleTooltipClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setShowHelp(false);
  };

  useEffect(() => {
    if (settingsContext.settings.showHelp === false) return;

    _.delayAction(delay, () => setShowHelp(true))
    _.delayAction(duration, () => setShowHelp(false))
  }, [settingsContext.settings.showHelp])


  return (
    <Tooltip
      title={text}
      placement="left-start"
      sx={{
        '& .MuiTooltip-tooltip': {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '4px',
          maxWidth: '200px',
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold',
          textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
          opacity: 0.8,
          transition: 'opacity 0.3s ease-in-out',
          '&:hover': {
            opacity: 1,
          },
        },
      }}
      onClick={handleTooltipClick}
      open={showHelp}
      onClose={handleTooltipClose}
      onOpen={handleTooltipOpen}>
      {children}
    </Tooltip>
  )
}