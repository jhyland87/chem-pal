import { createInputSetter, useSmartStorage } from "./useSmartStorage";

const defaultUser = {
  username: "",
  theme: "light" as "light" | "dark",
};

export default function AppExample() {
  // Persist user data in storage (local or chrome)
  const [user, setUser, resetUser] = useSmartStorage("userProfile", defaultUser, { area: "local" });

  // Create setters for individual properties
  const setUsername = createInputSetter(setUser, "username");
  const setTheme = createInputSetter(setUser, "theme");

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "2rem auto",
        padding: 24,
        border: "1px solid #ccc",
        borderRadius: 8,
      }}
    >
      <h2>Smart Storage Example</h2>
      <div style={{ marginBottom: 16 }}>
        <label>
          Username:
          <input
            type="text"
            value={user.username}
            onChange={setUsername}
            style={{ marginLeft: 8 }}
          />
        </label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>
          Theme:
          <select value={user.theme} onChange={setTheme} style={{ marginLeft: 8 }}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={resetUser}>Reset to Default</button>
      </div>
      <div style={{ background: "#f9f9f9", padding: 12, borderRadius: 4 }}>
        <strong>Live Data:</strong>
        <pre style={{ margin: 0 }}>{JSON.stringify(user, null, 2)}</pre>
      </div>
    </div>
  );
}
