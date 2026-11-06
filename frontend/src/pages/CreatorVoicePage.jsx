import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  updateCreatorVoice,
} from "../services/profile";


function CreatorVoicePage({
  user,
  profile,
  onProfileUpdate,
}) {

  const navigate = useNavigate();


  const [styleDescription, setStyleDescription] =
    useState(
      profile.style_description || ""
    );


  const [thingsToAvoid, setThingsToAvoid] =
    useState(
      profile.things_to_avoid || ""
    );


  const existingSamples =
    profile.sample_posts || [];


  const [sample1, setSample1] =
    useState(
      existingSamples[0] || ""
    );

  const [sample2, setSample2] =
    useState(
      existingSamples[1] || ""
    );

  const [sample3, setSample3] =
    useState(
      existingSamples[2] || ""
    );


  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");


  async function handleSubmit(event) {

    event.preventDefault();

    try {

      setLoading(true);
      setMessage("");


      const samplePosts = [
        sample1,
        sample2,
        sample3,
      ].filter(
        (sample) =>
          sample.trim() !== ""
      );


      const updatedProfile =
        await updateCreatorVoice({

          userId:
            user.id,

          styleDescription:
            styleDescription,

          thingsToAvoid:
            thingsToAvoid,

          samplePosts:
            samplePosts,
        });


      onProfileUpdate(
        updatedProfile
      );


      setMessage(
        "Creator voice saved successfully."
      );


    } catch (error) {

      console.error(error);

      setMessage(
        error.message
      );


    } finally {

      setLoading(false);

    }
  }


  return (
    <main>

      <button
        type="button"
        onClick={() =>
          navigate("/dashboard")
        }
      >
        ← Back to Dashboard
      </button>


      <h1>
        Creator Voice
      </h1>


      <p>
        Teach the AI how you naturally
        communicate.
      </p>


      <form
        onSubmit={handleSubmit}
      >


        <div>

          <label>
            Describe your style
          </label>

          <br />

          <textarea
            rows="5"
            cols="70"

            placeholder=
              "Example: Short conversational sentences, simple explanations, occasional humour..."

            value={
              styleDescription
            }

            onChange={(event) =>
              setStyleDescription(
                event.target.value
              )
            }
          />

        </div>


        <br />


        <div>

          <label>
            Things the AI should avoid
          </label>

          <br />

          <textarea
            rows="4"
            cols="70"

            placeholder=
              "Example: Corporate language, too many emojis, fake motivational phrases..."

            value={
              thingsToAvoid
            }

            onChange={(event) =>
              setThingsToAvoid(
                event.target.value
              )
            }
          />

        </div>


        <br />


        <h2>
          Example Content
        </h2>


        <p>
          Paste up to 3 examples that
          genuinely sound like you.
        </p>


        <div>

          <label>
            Sample Post 1
          </label>

          <br />

          <textarea
            rows="7"
            cols="70"

            value={sample1}

            onChange={(event) =>
              setSample1(
                event.target.value
              )
            }
          />

        </div>


        <br />


        <div>

          <label>
            Sample Post 2
          </label>

          <br />

          <textarea
            rows="7"
            cols="70"

            value={sample2}

            onChange={(event) =>
              setSample2(
                event.target.value
              )
            }
          />

        </div>


        <br />


        <div>

          <label>
            Sample Post 3
          </label>

          <br />

          <textarea
            rows="7"
            cols="70"

            value={sample3}

            onChange={(event) =>
              setSample3(
                event.target.value
              )
            }
          />

        </div>


        <br />


        <button
          type="submit"
          disabled={loading}
        >

          {
            loading
              ? "Saving..."
              : "Save Creator Voice"
          }

        </button>


        {message && (
          <p>
            {message}
          </p>
        )}


      </form>

    </main>
  );
}


export default CreatorVoicePage;