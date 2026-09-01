import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
});

// Attach the JWT (once auth exists) to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("opmps_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the stale token so the app falls back to the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("opmps_token");
    }
    return Promise.reject(error);
  }
);
