import { supabase } from "./supabase.js";

export const apiHeaders = async (headers = {}) => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token
    ? { ...headers, Authorization: `Bearer ${data.session.access_token}` }
    : headers;
};
