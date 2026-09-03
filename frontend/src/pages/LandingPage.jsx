import { useState } from "react";
import { getBackendHealth } from "../services/api";

function LandingPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleBackendTest() {
    try {
      setLoading(true);
      setMessage("");

      const data = await getBackendHealth();

      setMessage(data.message);
    } catch (error) {
      console.error(error);

      setMessage("Could not connect to backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Creator Content OS</h1>

      <h2>
        Turn one long-form idea into a week of content.
      </h2>

      <p>
        Generate Reels, LinkedIn posts and carousels while keeping your
        personal creator voice.
      </p>

      <button
        onClick={handleBackendTest}
        disabled={loading}
      >
        {loading ? "Connecting..." : "Test Backend"}
      </button>

      {message && (
        <p>{message}</p>
      )}
    </main>
  );
}

export default LandingPage;