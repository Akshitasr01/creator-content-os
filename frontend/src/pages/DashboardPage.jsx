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
  generateReel,
} from "../services/api";

import {
  saveGeneratedContent,
  getGeneratedContent,
} from "../services/generatedContent";


function DashboardPage({ user, profile }) {
  const navigate = useNavigate();


  // --------------------------------
  // STATE
  // --------------------------------

  // All projects
  const [projects, setProjects] = useState([]);

  // Initial dashboard loading
  const [loading, setLoading] = useState(true);

  // All generated content from Supabase
  const [
    generatedContent,
    setGeneratedContent,
  ] = useState([]);

  // Tracks which Reel is currently being generated
  const [
    generatingReelKey,
    setGeneratingReelKey,
  ] = useState(null);

  // Tracks which project is being analyzed
  const [
    analyzingProjectId,
    setAnalyzingProjectId,
  ] = useState(null);

  // Tracks which project is generating ideas
  const [
    generatingIdeasProjectId,
    setGeneratingIdeasProjectId,
  ] = useState(null);

  // AI / API error
  const [
    analysisError,
    setAnalysisError,
  ] = useState("");


  // --------------------------------
  // LOAD DASHBOARD DATA
  // --------------------------------

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const projectData =
          await getProjects(user.id);

        const generatedData =
          await getGeneratedContent(
            user.id
          );

        setProjects(projectData);

        setGeneratedContent(
          generatedData
        );

      } catch (error) {
        console.error(error);

      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();

  }, [user.id]);


  // --------------------------------
  // LOGOUT
  // --------------------------------

  async function handleLogout() {
    try {
      await logoutUser();

    } catch (error) {
      console.error(error);
    }
  }


  // --------------------------------
  // ANALYZE PROJECT
  // --------------------------------

  async function handleAnalyze(project) {
    try {
      setAnalyzingProjectId(
        project.id
      );

      setAnalysisError("");


      // React → FastAPI → OpenAI
      const analysis =
        await analyzeContent({
          title:
            project.title,

          sourceType:
            project.source_type,

          sourceText:
            project.source_text,

          niche:
            profile.niche,

          audience:
            profile.audience,
        });


      // Save analysis in Supabase
      const updatedProject =
        await saveProjectAnalysis(
          project.id,
          analysis
        );


      // Update project in React
      setProjects(
        (currentProjects) =>
          currentProjects.map(
            (item) =>
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


  // --------------------------------
  // GENERATE CONTENT IDEAS
  // --------------------------------

  async function handleGenerateIdeas(
    project
  ) {
    try {

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


      // React → FastAPI → OpenAI
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
          
          styleDescription:profile.style_description,

          thingsToAvoid:profile.things_to_avoid,
          samplePosts:profile.sample_posts || [],

          analysis:
            project.analysis,
        });


      // Save ideas in Supabase
      const updatedProject =
        await saveProjectIdeas(
          project.id,
          contentIdeas
        );


      // Update project immediately
      setProjects(
        (currentProjects) =>
          currentProjects.map(
            (item) =>
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
      setGeneratingIdeasProjectId(
        null
      );
    }
  }


  // --------------------------------
  // GENERATE REEL
  // --------------------------------

  async function handleGenerateReel(
    project,
    idea,
    ideaIndex
  ) {

    // Makes each idea unique
    const reelKey =
      `${project.id}-${ideaIndex}`;


    try {
      setGeneratingReelKey(
        reelKey
      );

      setAnalysisError("");


      // React → FastAPI → OpenAI
      const reel =
        await generateReel({
          title:
            project.title,

          sourceText:
            project.source_text,

          idea:
            idea,

          niche:
            profile.niche,

          audience:
            profile.audience,

          language:
            profile.language,

          tone:
            profile.tone,

          styleDescription:
            profile.style_description,

          thingsToAvoid:
            profile.things_to_avoid,
          samplePosts:
            profile.sample_posts || [],  
        });


      // Save generated Reel in Supabase
      const savedContent =
        await saveGeneratedContent({
          userId:
            user.id,

          projectId:
            project.id,

          ideaIndex:
            ideaIndex,

          contentType:
            "reel",

          platform:
            "instagram",

          content:
            reel,
        });


      // Show generated Reel immediately
      setGeneratedContent(
        (currentContent) => [
          savedContent,
          ...currentContent,
        ]
      );

    } catch (error) {
      console.error(error);

      setAnalysisError(
        error.message
      );

    } finally {
      setGeneratingReelKey(null);
    }
  }


  // --------------------------------
  // UI
  // --------------------------------

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
      
      {" "}

      <button
        onClick={() =>
          navigate("/creator-voice")
        }
      >
        Creator Voice
      </button>


      <hr />


      <h2>
        Your Projects
      </h2>


      {/* DASHBOARD LOADING */}

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


      {/* ERROR */}

      {analysisError && (
        <p>
          {analysisError}
        </p>
      )}


      {/* -------------------------------- */}
      {/* PROJECT LIST */}
      {/* -------------------------------- */}

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


          {/* -------------------------- */}
          {/* ANALYZE BUTTON */}
          {/* -------------------------- */}

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


          {/* -------------------------- */}
          {/* GENERATE IDEAS BUTTON */}
          {/* -------------------------- */}

          {project.analysis && (
            <>
              <br />
              <br />

              <button
                onClick={() =>
                  handleGenerateIdeas(
                    project
                  )
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


          {/* -------------------------- */}
          {/* CONTENT ANALYSIS */}
          {/* -------------------------- */}

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
                      (
                        point,
                        index
                      ) => (
                        <li
                          key={
                            index
                          }
                        >
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
                      (
                        hook,
                        index
                      ) => (
                        <li
                          key={
                            index
                          }
                        >
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
                      (
                        angle,
                        index
                      ) => (
                        <li
                          key={
                            index
                          }
                        >
                          {angle}
                        </li>
                      )
                    )
                }

              </ul>

            </div>
          )}


          {/* -------------------------------- */}
          {/* CONTENT IDEAS */}
          {/* -------------------------------- */}

          {project.content_ideas && (
            <div>

              <h4>
                Content Ideas
              </h4>


              {
                project.content_ideas
                  .ideas
                  ?.map(
                    (
                      idea,
                      index
                    ) => {

                      // Reel generated from this exact idea
                      const ideaReels =
                        generatedContent.filter(
                          (item) =>
                            item.project_id ===
                              project.id &&

                            item.idea_index ===
                              index &&

                            item.content_type ===
                              "reel"
                        );


                      const reelKey =
                        `${project.id}-${index}`;


                      return (

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


                          {/* ------------------ */}
                          {/* GENERATE REEL */}
                          {/* STEP 103 */}
                          {/* ------------------ */}

                          <button
                            onClick={() =>
                              handleGenerateReel(
                                project,
                                idea,
                                index
                              )
                            }

                            disabled={
                              generatingReelKey ===
                              reelKey
                            }
                          >

                            {
                              generatingReelKey ===
                              reelKey

                                ? "Generating Reel..."

                                : "Generate Reel"
                            }

                          </button>


                          {/* ------------------ */}
                          {/* DISPLAY REELS */}
                          {/* STEP 104 */}
                          {/* ------------------ */}

                          {
                            ideaReels.map(
                              (item) => (

                                <div
                                  key={
                                    item.id
                                  }
                                >

                                  <h6>
                                    Generated Reel
                                  </h6>


                                  <p>
                                    <strong>
                                      Hook:
                                    </strong>{" "}

                                    {
                                      item
                                        .content
                                        .hook
                                    }
                                  </p>


                                  <p>
                                    <strong>
                                      Script:
                                    </strong>
                                  </p>

                                  <p>
                                    {
                                      item
                                        .content
                                        .script
                                    }
                                  </p>


                                  <p>
                                    <strong>
                                      Caption:
                                    </strong>{" "}

                                    {
                                      item
                                        .content
                                        .caption
                                    }
                                  </p>


                                  <p>
                                    <strong>
                                      CTA:
                                    </strong>{" "}

                                    {
                                      item
                                        .content
                                        .cta
                                    }
                                  </p>


                                  <p>
                                    <strong>
                                      Hashtags:
                                    </strong>{" "}

                                    {
                                      item
                                        .content
                                        .hashtags
                                        ?.join(" ")
                                    }
                                  </p>


                                  <p>
                                    <strong>
                                      Estimated Duration:
                                    </strong>{" "}

                                    {
                                      item
                                        .content
                                        .estimated_duration_seconds
                                    }{" "}
                                    seconds
                                  </p>


                                  {/* COPY SCRIPT */}

                                  <button
                                    onClick={() =>
                                      navigator
                                        .clipboard
                                        .writeText(
                                          item
                                            .content
                                            .script
                                        )
                                    }
                                  >
                                    Copy Script
                                  </button>


                                  <hr />

                                </div>

                              )
                            )
                          }


                          <hr />

                        </div>

                      );
                    }
                  )
              }

            </div>
          )}


          <hr />

        </div>

      ))}


      {/* -------------------------------- */}
      {/* LOGOUT */}
      {/* -------------------------------- */}

      <button
        onClick={handleLogout}
      >
        Logout
      </button>

    </main>
  );
}


export default DashboardPage;