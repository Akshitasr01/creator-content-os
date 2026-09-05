import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { logoutUser } from "../services/auth";

import {
  getProjects,
  saveProjectAnalysis,
} from "../services/projects";

import {
  analyzeContent,
} from "../services/api";


function DashboardPage({ user, profile }) {
  const navigate = useNavigate();


  // Stores all projects belonging to the user
  const [projects, setProjects] = useState([]);


  // Used while loading projects from Supabase
  const [loading, setLoading] = useState(true);


  // Stores the ID of the project currently being analyzed
  const [
    analyzingProjectId,
    setAnalyzingProjectId,
  ] = useState(null);


  // Stores AI analysis errors
  const [
    analysisError,
    setAnalysisError,
  ] = useState("");


  // Load user's projects when Dashboard opens
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


  // Logout
  async function handleLogout() {
    try {
      await logoutUser();

    } catch (error) {
      console.error(error);
    }
  }


  // Analyze one project using FastAPI → OpenAI
  async function handleAnalyze(project) {
    try {
      // Remember which project is currently being analyzed
      setAnalyzingProjectId(project.id);

      // Remove previous error
      setAnalysisError("");


      // STEP 1:
      // Send project data to FastAPI
      // FastAPI then sends it to OpenAI
      const analysis = await analyzeContent({
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


      // STEP 2:
      // Save OpenAI result inside Supabase
      const updatedProject =
        await saveProjectAnalysis(
          project.id,
          analysis
        );


      // STEP 3:
      // Update the project in React immediately
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
      // Analysis finished
      setAnalyzingProjectId(null);
    }
  }


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


      {/* Loading projects */}
      {loading && (
        <p>
          Loading projects...
        </p>
      )}


      {/* No projects */}
      {!loading &&
        projects.length === 0 && (
          <p>
            You haven't created any
            projects yet.
          </p>
        )}


      {/* AI error */}
      {analysisError && (
        <p>
          {analysisError}
        </p>
      )}


      {/* Display all projects */}
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


          {/* Analyze button */}
          <button

            onClick={() =>
              handleAnalyze(project)
            }

            disabled={
              analyzingProjectId ===
              project.id
            }

          >

            {analyzingProjectId ===
            project.id

              ? "Analyzing..."

              : project.analysis

              ? "Re-analyze Content"

              : "Analyze Content"}

          </button>


          {/* Show analysis only when it exists */}
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


              <h4>
                Key Points
              </h4>


              <ul>
                {project.analysis
                  .key_points
                  ?.map(
                    (point, index) => (
                      <li key={index}>
                        {point}
                      </li>
                    )
                  )}
              </ul>


              <h4>
                Potential Hooks
              </h4>


              <ul>
                {project.analysis
                  .hooks
                  ?.map(
                    (hook, index) => (
                      <li key={index}>
                        {hook}
                      </li>
                    )
                  )}
              </ul>


              <h4>
                Content Angles
              </h4>


              <ul>
                {project.analysis
                  .content_angles
                  ?.map(
                    (angle, index) => (
                      <li key={index}>
                        {angle}
                      </li>
                    )
                  )}
              </ul>

            </div>
          )}


          <hr />

        </div>
      ))}


      <button
        onClick={handleLogout}
      >
        Logout
      </button>

    </main>
  );
}


export default DashboardPage;