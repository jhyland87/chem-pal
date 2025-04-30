// MyComponent.jsx
import React, { useState } from 'react';


function MyComponent({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);


  const increment = () => {
    setCount(count + 1);
  };


  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
}


export default MyComponent;