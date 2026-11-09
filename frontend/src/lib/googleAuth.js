/**
 * "Sign in with Google" for YouTube caption access, using Google Identity Services.
 *
 * The browser receives a short-lived access token (about 1 hour) limited to the
 * YouTube scope and sends it to our backend once to fetch captions. Nothing is
 * stored. The Client ID is a public value supplied by the backend (/videos/capabilities).
 */
const GIS_SRC = "https://accounts.google.com/gsi/client";
export const YOUTUBE_CAPTION_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

let loading = null;

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null;
        reject(new Error("Couldn't load Google sign-in. Check your internet connection or ad blocker."));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

/** Opens Google's consent popup and resolves with an access token. */
export async function requestYouTubeAccessToken(clientId) {
  await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: YOUTUBE_CAPTION_SCOPE,
      callback: (response) => {
        if (response.error) reject(new Error(response.error_description || "Google sign-in was not completed."));
        else resolve(response.access_token);
      },
      error_callback: (error) =>
        reject(new Error(error?.type === "popup_closed" ? "The Google sign-in window was closed." : "Google sign-in failed.")),
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}
