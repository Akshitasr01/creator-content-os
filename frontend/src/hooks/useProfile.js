import { useContext } from "react";

import { ProfileContext } from "../context/contexts";

export function useProfile() {
  return useContext(ProfileContext);
}
