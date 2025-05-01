import React from 'react';
import { chrome } from 'jest-chrome'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

let myMockedFunction: jest.Mock;
describe('wtf', () => {
  beforeEach(() => {
    //myMockedFunction = jest.fn(() => Promise.resolve(false));
    //render(<App />);
  });

  it('should work', () => {
    //expect(myMockedFunction).toBeTruthy

  })

  test('renders with initial count', () => {
    render(<App />);
    const headerElement = screen.getByText('Chem Crawler');
    expect(headerElement).toBeInTheDocument();
  });

})

