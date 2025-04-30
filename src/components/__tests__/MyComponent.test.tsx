import React from 'react';
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from '../MyComponent';


test('renders with initial count', () => {
  render(<MyComponent initialCount={5} />);
  const countElement = screen.getByText('Count: 5');
  expect(countElement).toBeInTheDocument();
});


test('increments count on button click', () => {
  render(<MyComponent />);
  const buttonElement = screen.getByRole('button', { name: 'Increment' });
  fireEvent.click(buttonElement);
  const countElement = screen.getByText('Count: 1');
  expect(countElement).toBeInTheDocument();
});