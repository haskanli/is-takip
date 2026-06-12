import { supabase } from "./supabase.js";

const PUBLIC_API_ORIGIN = "https://is-takip-sx1v.onrender.com";
const publicHosts = new Set(["corject.com", "www.corject.com"]);

export const isPublicCorjectHost =
  typeof window !== "undefined" && publicHosts.has(window.location.hostname);

export const apiUrl = (path) => {
  const env = import.meta.env || {};
  const base =
    env.VITE_API_BASE_URL ||
    (isPublicCorjectHost ? PUBLIC_API_ORIGIN : "");
  return `${base.replace(/\/+$/, "")}${path}`;
};

export const apiHeaders = async (headers = {}) => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token
    ? { ...headers, Authorization: `Bearer ${data.session.access_token}` }
    : headers;
};
