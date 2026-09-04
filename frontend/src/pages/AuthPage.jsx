import { useState } from "react";
import {
  signUpUser,
  loginUser,
} from "../services/auth";

function AuthPage() {
  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const data = await signUpUser(email, password);

        if (data.session) {
          setMessage("Account created successfully.");
        } else {
          setMessage(
            "Account created. Check your email to confirm your account."
          );
        }
      } else {
        await loginUser(email, password);

        setMessage("Login successful.");
      }
    } catch (error) {
      console.error(error);

      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>
        {mode === "login" ? "Login" : "Create Account"}
      </h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Email</label>

          <br />

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
          />
        </div>

        <br />

        <div>
          <label>Password</label>

          <br />

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
            minLength={6}
          />
        </div>

        <br />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Login"
            : "Sign Up"}
        </button>
      </form>

      <br />

      <button
        type="button"
        onClick={() => {
          setMode(
            mode === "login"
              ? "signup"
              : "login"
          );

          setMessage("");
        }}
      >
        {mode === "login"
          ? "Don't have an account? Sign up"
          : "Already have an account? Login"}
      </button>

      {message && <p>{message}</p>}
    </main>
  );
}

export default AuthPage;