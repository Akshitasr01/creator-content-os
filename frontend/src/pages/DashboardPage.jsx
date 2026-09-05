import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { logoutUser } from "../services/auth";
import { getProjects } from "../services/projects";

function DashboardPage({ user, profile }) {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

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

  async function handleLogout() {
    try {
      await logoutUser();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <main>
      <h1>Creator Content OS</h1>

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

      <h2>Your Projects</h2>

      {loading && (
        <p>Loading projects...</p>
      )}

      {!loading &&
        projects.length === 0 && (
          <p>
            You haven't created any
            projects yet.
          </p>
        )}

      {projects.map((project) => (
        <div key={project.id}>
          <h3>{project.title}</h3>

          <p>
            Type: {project.source_type}
          </p>

          <p>
            Status: {project.status}
          </p>

          <hr />
        </div>
      ))}

      <button onClick={handleLogout}>
        Logout
      </button>
    </main>
  );
}

export default DashboardPage;