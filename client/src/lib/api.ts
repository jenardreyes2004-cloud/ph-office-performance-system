import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
  // The backend issues an httpOnly session cookie on login — this makes
  // axios send and accept it on cross-origin requests (client :5173,
  // server :4000). The server's CORS config already allows credentials
  // for CORS_ORIGIN (see server/src/app.ts).
  withCredentials: true,
});
