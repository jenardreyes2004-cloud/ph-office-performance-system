import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
  withCredentials: true,
});

// On 401, let the authentication context handle the logout/session state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // The JWT is stored in an HTTP-only cookie,
      // so we intentionally do not try to remove it from localStorage.
    }

    return Promise.reject(error);
  },
);
