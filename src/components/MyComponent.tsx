// MyComponent.jsx
import { useState } from "react";

function MyComponent({ initialCount = 0 }: { initialCount?: number }) {
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
