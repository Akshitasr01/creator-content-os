import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { createProject } from "../services/projects";

function NewProjectPage({ user, profile }) {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("text");
  const [sourceText, setSourceText] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      await createProject({
        userId: user.id,
        profileId: profile.id,
        title,
        sourceType,
        sourceText,
      });

      navigate("/dashboard");
    } catch (error) {
      console.error(error);

      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
      >
        ← Back
      </button>

      <h1>Create New Project</h1>

      <p>
        Paste long-form content that you want to turn into
        social media content.
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Project Title</label>

          <br />

          <input
            type="text"
            placeholder="Complete DSA Roadmap"
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            required
          />
        </div>

        <br />

        <div>
          <label>Source Type</label>

          <br />

          <select
            value={sourceType}
            onChange={(event) =>
              setSourceType(event.target.value)
            }
          >
            <option value="text">
              Text
            </option>

            <option value="transcript">
              Video Transcript
            </option>

            <option value="article">
              Article / Blog
            </option>
          </select>
        </div>

        <br />

        <div>
          <label>Long-form Content</label>

          <br />

          <textarea
            rows="15"
            cols="70"
            placeholder="Paste your transcript, article or long-form content here..."
            value={sourceText}
            onChange={(event) =>
              setSourceText(event.target.value)
            }
            required
          />
        </div>

        <br />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Saving..."
            : "Create Project"}
        </button>

        {message && (
          <p>{message}</p>
        )}
      </form>
    </main>
  );
}

export default NewProjectPage;