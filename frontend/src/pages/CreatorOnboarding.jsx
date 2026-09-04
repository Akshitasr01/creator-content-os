import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function CreatorOnboarding({ user, onComplete }) {
  const [creatorName, setCreatorName] =
    useState("");

  const [niche, setNiche] =
    useState("");

  const [audience, setAudience] =
    useState("");

  const [language, setLanguage] =
    useState("English");

  const [tone, setTone] =
    useState("");

  const [styleDescription, setStyleDescription] =
    useState("");

  const [thingsToAvoid, setThingsToAvoid] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("creator_profiles")
      .insert({
        user_id: user.id,

        creator_name: creatorName,

        niche,

        audience,

        language,

        tone,

        style_description: styleDescription,

        things_to_avoid: thingsToAvoid,
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error(error);

      setMessage(error.message);

      return;
    }

    onComplete(data);
  }

  return (
    <main>
      <h1>Create your creator profile</h1>

      <p>
        This helps the AI understand
        how you create content.
      </p>

      <form onSubmit={handleSubmit}>

        <div>
          <label>Creator Name</label>

          <br />

          <input
            value={creatorName}
            onChange={(e) =>
              setCreatorName(e.target.value)
            }
            required
          />
        </div>

        <br />

        <div>
          <label>Niche</label>

          <br />

          <input
            placeholder="Coding, Finance, Fitness..."
            value={niche}
            onChange={(e) =>
              setNiche(e.target.value)
            }
          />
        </div>

        <br />

        <div>
          <label>Target Audience</label>

          <br />

          <textarea
            value={audience}
            onChange={(e) =>
              setAudience(e.target.value)
            }
          />
        </div>

        <br />

        <div>
          <label>Language</label>

          <br />

          <select
            value={language}
            onChange={(e) =>
              setLanguage(e.target.value)
            }
          >
            <option>English</option>
            <option>Hindi</option>
            <option>Hinglish</option>
          </select>
        </div>

        <br />

        <div>
          <label>Tone</label>

          <br />

          <input
            placeholder="Casual, professional, funny..."
            value={tone}
            onChange={(e) =>
              setTone(e.target.value)
            }
          />
        </div>

        <br />

        <div>
          <label>
            Describe your content style
          </label>

          <br />

          <textarea
            value={styleDescription}
            onChange={(e) =>
              setStyleDescription(e.target.value)
            }
          />
        </div>

        <br />

        <div>
          <label>
            Things AI should avoid
          </label>

          <br />

          <textarea
            value={thingsToAvoid}
            onChange={(e) =>
              setThingsToAvoid(e.target.value)
            }
          />
        </div>

        <br />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Saving..."
            : "Save Profile"}
        </button>

        {message && <p>{message}</p>}

      </form>
    </main>
  );
}

export default CreatorOnboarding;