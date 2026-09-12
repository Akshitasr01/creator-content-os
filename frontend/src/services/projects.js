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
export async function saveProjectAnalysis(
  projectId,
  analysis
) {
  const { data, error } = await supabase
    .from("projects")
    .update({
      analysis: analysis,
      status: "analyzed",
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", projectId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveProjectIdeas(
  projectId,
  contentIdeas
) {
  const { data, error } = await supabase
    .from("projects")
    .update({
      content_ideas: contentIdeas,
      status: "ideas_generated",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}