const DEFAULT_APP_URL = "https://143campusflow.vercel.app";

export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL
).replace(/\/$/, "");

export function appUrl(path = "") {
  if (!path) return APP_URL;

  return `${APP_URL}/${path.replace(/^\//, "")}`;
}
