import { logoutUser } from "../services/auth";

function DashboardPage({ user }) {
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

      <h2>Dashboard</h2>

      <p>
        Logged in as:
        {" "}
        {user?.email}
      </p>

      <button>
        + New Project
      </button>

      <br />
      <br />

      <button onClick={handleLogout}>
        Logout
      </button>
    </main>
  );
}

export default DashboardPage;