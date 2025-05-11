//import * as React from 'react';
import Paper from '@mui/material/Paper';
import InputBase from '@mui/material/InputBase';
//import MoreVertIcon from '@material-ui/icons/MoreVert';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
//import DirectionsIcon from '@mui/icons-material/Directions';
import ScienceIcon from '@mui/icons-material/Science';
//import Box from '@mui/material/Box';

export default function SearchInput() {
  return (
    <>
      <div
        className='search-input-container fullwidth'
        style={{ padding: 'none' }}>
        <Paper
          component='form'
          sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <IconButton aria-label='menu'>
            <MenuIcon />
          </IconButton>
          <InputBase
            sx={{ ml: 1, flex: 1 }}
            placeholder='Search...'
            inputProps={{ 'aria-label': 'Search for chemicals' }}
          />
          <IconButton type='button' aria-label='search'>
            <ScienceIcon />
          </IconButton>
          <Divider orientation='vertical' />
          <IconButton color='primary' aria-label='directions'>
            <SearchIcon />
          </IconButton>
        </Paper>
      </div>
    </>
  );
}