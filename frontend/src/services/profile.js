import { supabase } from "../lib/supabaseClient";


export async function updateCreatorVoice({
  userId,
  styleDescription,
  thingsToAvoid,
  samplePosts,
}) {

  const { data, error } = await supabase
    .from("creator_profiles")
    .update({
      style_description:
        styleDescription,

      things_to_avoid:
        thingsToAvoid,

      sample_posts:
        samplePosts,

      updated_at:
        new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select()
    .single();


  if (error) {
    throw error;
  }


  return data;
}