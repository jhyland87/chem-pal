import React from 'react';
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';


test('renders with initial count', () => {
  render(<App />);
  const headerElement = screen.getByText('Chem Crawler');
  expect(headerElement).toBeInTheDocument();
});

