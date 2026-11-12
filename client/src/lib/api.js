import axios from "axios";
import { API_URL } from "../config/api";

const ACCESS_KEY = "auth.access";
const REFRESH_KEY = "auth.refresh";

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Client HTTP unique pour toute l'application. */
const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use((config) => {
  const access = tokens.access;
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// Rafraîchit le jeton d'accès une seule fois en cas de 401, puis rejoue la requête.
let refreshPromise = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status !== 401 ||
      original?._retried ||
      !tokens.refresh ||
      original?.url?.startsWith("/token/")
    ) {
      return Promise.reject(error);
    }
    original._retried = true;
    try {
      refreshPromise ??= axios
        .post(`${API_URL}/api/token/refresh/`, { refresh: tokens.refresh })
        .finally(() => {
          refreshPromise = null;
        });
      const { data } = await refreshPromise;
      tokens.set({ access: data.access });
      return api(original);
    } catch (refreshError) {
      tokens.clear();
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(refreshError);
    }
  }
);

/** Transforme une erreur axios/DRF en message lisible. */
export function getErrorMessage(error, fallback = "Une erreur est survenue.") {
  const data = error?.response?.data;
  if (!data) return error?.message === "Network Error" ? "Serveur injoignable." : fallback;
  if (typeof data === "string") return fallback;
  if (data.detail) return data.detail;
  const messages = Object.entries(data).flatMap(([field, value]) => {
    const list = Array.isArray(value) ? value : [value];
    return list.map((msg) =>
      field === "non_field_errors" || field === "items" ? String(msg) : `${field} : ${msg}`
    );
  });
  return messages.join(" ") || fallback;
}

export function isCancel(error) {
  return axios.isCancel(error);
}

export default api;
