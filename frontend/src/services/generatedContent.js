import { supabase } from "../lib/supabaseClient";


export async function saveGeneratedContent({
  userId,
  projectId,
  ideaIndex,
  contentType,
  platform,
  content,
}) {
  const { data, error } = await supabase
    .from("generated_content")
    .insert({
      user_id: userId,

      project_id: projectId,

      idea_index: ideaIndex,

      content_type: contentType,

      platform: platform,

      content: content,
    })
    .select()
    .single();


  if (error) {
    throw error;
  }


  return data;
}


export async function getGeneratedContent(
  userId
) {
  const { data, error } = await supabase
    .from("generated_content")
    .select("*")
    .eq("user_id", userId)
    .order(
      "created_at",
      {
        ascending: false,
      }
    );


  if (error) {
    throw error;
  }


  return data;
}