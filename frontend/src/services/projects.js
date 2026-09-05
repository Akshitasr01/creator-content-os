import { supabase } from "../lib/supabaseClient";

export async function createProject({
  userId,
  profileId,
  title,
  sourceType,
  sourceText,
}) {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      creator_profile_id: profileId,
      title: title,
      source_type: sourceType,
      source_text: sourceText,
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getProjects(userId) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
}