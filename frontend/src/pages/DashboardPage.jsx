import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { logoutUser } from "../services/auth";

import {
  getProjects,
  saveProjectAnalysis,
  saveProjectIdeas,
} from "../services/projects";

import {
  analyzeContent,
  generateContentIdeas,
} from "../services/api";


function DashboardPage({ user, profile }) {
  const navigate = useNavigate();


  // -----------------------------
  // STATE
  // -----------------------------

  // Stores all projects belonging to the logged-in user
  const [projects, setProjects] = useState([]);

  // Used while initially loading projects
  const [loading, setLoading] = useState(true);

  // Stores ID of project currently being analyzed
  const [
    analyzingProjectId,
    setAnalyzingProjectId,
  ] = useState(null);

  // Stores ID of project currently generating ideas
  const [
    generatingIdeasProjectId,
    setGeneratingIdeasProjectId,
  ] = useState(null);

  // Stores errors from AI requests
  const [
    analysisError,
    setAnalysisError,
  ] = useState("");


  // -----------------------------
  // LOAD PROJECTS
  // -----------------------------

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects(user.id);

        setProjects(data);

      } catch (error) {
        console.error(error);

      } finally {
        setLoading(false);
      }
    }

    loadProjects();

  }, [user.id]);


  // -----------------------------
  // LOGOUT
  // -----------------------------

  async function handleLogout() {
    try {
      await logoutUser();

    } catch (error) {
      console.error(error);
    }
  }


  // -----------------------------
  // ANALYZE PROJECT
  // -----------------------------

  async function handleAnalyze(project) {
    try {
      setAnalyzingProjectId(project.id);

      setAnalysisError("");


      // Send project to FastAPI → OpenAI
      const analysis =
        await analyzeContent({
          title: project.title,

          sourceType:
            project.source_type,

          sourceText:
            project.source_text,

          niche:
            profile.niche,

          audience:
            profile.audience,
        });


      // Save returned analysis to Supabase
      const updatedProject =
        await saveProjectAnalysis(
          project.id,
          analysis
        );


      // Update project immediately in React
      setProjects((currentProjects) =>
        currentProjects.map((item) =>
          item.id === project.id
            ? updatedProject
            : item
        )
      );

    } catch (error) {
      console.error(error);

      setAnalysisError(
        error.message
      );

    } finally {
      setAnalyzingProjectId(null);
    }
  }


  // -----------------------------
  // GENERATE CONTENT IDEAS
  // -----------------------------

  async function handleGenerateIdeas(project) {
    try {

      // Project must first be analyzed
      if (!project.analysis) {
        setAnalysisError(
          "Analyze the project before generating ideas."
        );

        return;
      }


      setGeneratingIdeasProjectId(
        project.id
      );

      setAnalysisError("");


      // Send analysis + creator profile
      // to FastAPI → OpenAI
      const contentIdeas =
        await generateContentIdeas({
          title:
            project.title,

          sourceText:
            project.source_text,

          niche:
            profile.niche,

          audience:
            profile.audience,

          language:
            profile.language,

          tone:
            profile.tone,

          analysis:
            project.analysis,
        });


      // Save ideas inside Supabase
      const updatedProject =
        await saveProjectIdeas(
          project.id,
          contentIdeas
        );


      // Update React immediately
      setProjects((currentProjects) =>
        currentProjects.map((item) =>
          item.id === project.id
            ? updatedProject
            : item
        )
      );

    } catch (error) {
      console.error(error);

      setAnalysisError(
        error.message
      );

    } finally {
      setGeneratingIdeasProjectId(null);
    }
  }


  // -----------------------------
  // UI
  // -----------------------------

  return (
    <main>

      <h1>
        Creator Content OS
      </h1>


      <h2>
        Welcome, {profile.creator_name} 👋
      </h2>


      <p>
        Niche: {profile.niche}
      </p>


      <p>
        Language: {profile.language}
      </p>


      {/* NEW PROJECT BUTTON */}
      <button
        onClick={() =>
          navigate("/new-project")
        }
      >
        + New Project
      </button>


      <hr />


      <h2>
        Your Projects
      </h2>


      {/* PROJECT LOADING */}
      {loading && (
        <p>
          Loading projects...
        </p>
      )}


      {/* NO PROJECTS */}
      {!loading &&
        projects.length === 0 && (
          <p>
            You haven't created any
            projects yet.
          </p>
        )}


      {/* AI ERROR */}
      {analysisError && (
        <p>
          {analysisError}
        </p>
      )}


      {/* ------------------------- */}
      {/* PROJECT LIST */}
      {/* ------------------------- */}

      {projects.map((project) => (
        <div key={project.id}>

          <h3>
            {project.title}
          </h3>


          <p>
            Type: {project.source_type}
          </p>


          <p>
            Status: {project.status}
          </p>


          {/* --------------------- */}
          {/* ANALYZE BUTTON */}
          {/* --------------------- */}

          <button
            onClick={() =>
              handleAnalyze(project)
            }

            disabled={
              analyzingProjectId ===
              project.id
            }
          >

            {
              analyzingProjectId ===
              project.id

                ? "Analyzing..."

                : project.analysis

                  ? "Re-analyze Content"

                  : "Analyze Content"
            }

          </button>


          {/* --------------------- */}
          {/* GENERATE IDEAS BUTTON */}
          {/* --------------------- */}

          {project.analysis && (
            <>
              <br />
              <br />

              <button
                onClick={() =>
                  handleGenerateIdeas(project)
                }

                disabled={
                  generatingIdeasProjectId ===
                  project.id
                }
              >

                {
                  generatingIdeasProjectId ===
                    project.id

                    ? "Generating Ideas..."

                    : project.content_ideas

                      ? "Regenerate Ideas"

                      : "Generate Content Ideas"
                }

              </button>
            </>
          )}


          {/* --------------------- */}
          {/* CONTENT ANALYSIS */}
          {/* --------------------- */}

          {project.analysis && (
            <div>

              <h4>
                Content Analysis
              </h4>


              <p>
                <strong>
                  Main Topic:
                </strong>{" "}

                {
                  project.analysis
                    .main_topic
                }
              </p>


              <p>
                <strong>
                  Target Audience:
                </strong>{" "}

                {
                  project.analysis
                    .target_audience
                }
              </p>


              <p>
                <strong>
                  Summary:
                </strong>{" "}

                {
                  project.analysis
                    .summary
                }
              </p>


              {/* KEY POINTS */}

              <h4>
                Key Points
              </h4>

              <ul>

                {
                  project.analysis
                    .key_points
                    ?.map(
                      (point, index) => (
                        <li key={index}>
                          {point}
                        </li>
                      )
                    )
                }

              </ul>


              {/* POTENTIAL HOOKS */}

              <h4>
                Potential Hooks
              </h4>

              <ul>

                {
                  project.analysis
                    .hooks
                    ?.map(
                      (hook, index) => (
                        <li key={index}>
                          {hook}
                        </li>
                      )
                    )
                }

              </ul>


              {/* CONTENT ANGLES */}

              <h4>
                Content Angles
              </h4>

              <ul>

                {
                  project.analysis
                    .content_angles
                    ?.map(
                      (angle, index) => (
                        <li key={index}>
                          {angle}
                        </li>
                      )
                    )
                }

              </ul>

            </div>
          )}


          {/* --------------------- */}
          {/* CONTENT IDEAS */}
          {/* --------------------- */}

          {project.content_ideas && (
            <div>

              <h4>
                Content Ideas
              </h4>


              {
                project.content_ideas
                  .ideas
                  ?.map(
                    (idea, index) => (

                      <div key={index}>

                        <h5>
                          {index + 1}.{" "}
                          {idea.title}
                        </h5>


                        <p>
                          <strong>
                            Core Message:
                          </strong>{" "}

                          {
                            idea.core_message
                          }
                        </p>


                        <p>
                          <strong>
                            Hook:
                          </strong>{" "}

                          {
                            idea.hook
                          }
                        </p>


                        <p>
                          <strong>
                            Recommended Format:
                          </strong>{" "}

                          {
                            idea.recommended_format
                          }
                        </p>


                        <p>
                          <strong>
                            Why it works:
                          </strong>{" "}

                          {
                            idea.why_it_works
                          }
                        </p>


                        <hr />

                      </div>

                    )
                  )
              }

            </div>
          )}


          <hr />

        </div>
      ))}


      {/* LOGOUT */}

      <button
        onClick={handleLogout}
      >
        Logout
      </button>

    </main>
  );
}


export default DashboardPage;

// Project
//    ↓
// Analyze Content
//    ↓
// Content Analysis appears
//    ↓
// Generate Content Ideas
//    ↓
// Generating Ideas...
//    ↓
// 8 ideas appear