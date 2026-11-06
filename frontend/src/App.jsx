import {
  useEffect,
  useState,
} from "react";

import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  supabase,
} from "./lib/supabaseClient";

import AuthPage from "./pages/AuthPage";

import DashboardPage from "./pages/DashboardPage";

import CreatorOnboarding from "./pages/CreatorOnboarding";

import NewProjectPage from "./pages/NewProjectPage";

import CreatorVoicePage from "./pages/CreatorVoicePage";


function App() {
  const [user, setUser] =
    useState(null);

  const [profile, setProfile] =
    useState(null);

  const [loading, setLoading] =
    useState(true);


  async function loadProfile(userId) {
    const {
      data,
      error,
    } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error(error);
    }

    setProfile(data);
  }


  useEffect(() => {
    async function initialize() {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      setUser(user);

      if (user) {
        await loadProfile(user.id);
      }

      setLoading(false);
    }

    initialize();


    const {
      data: { subscription },
    } =
      supabase.auth
        .onAuthStateChange(
          async (
            _event,
            session
          ) => {
            const currentUser =
              session?.user ?? null;

            setUser(currentUser);

            if (currentUser) {
              await loadProfile(
                currentUser.id
              );
            } else {
              setProfile(null);
            }
          }
        );


    return () => {
      subscription.unsubscribe();
    };
  }, []);


  if (loading) {
    return <p>Loading...</p>;
  }


  if (!user) {
    return <AuthPage />;
  }


  if (!profile) {
    return (
      <CreatorOnboarding
        user={user}
        onComplete={setProfile}
      />
    );
  }


  return (
    <Routes>
      <Route
        path="/dashboard"
        element={
          <DashboardPage
            user={user}
            profile={profile}
          />
        }
      />

      <Route
        path="/new-project"
        element={
          <NewProjectPage
            user={user}
            profile={profile}
          />
        }
      />
      <Route
        path="/creator-voice"
        element={
          <CreatorVoicePage
            user={user}
            profile={profile}
            onProfileUpdate={setProfile}
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;