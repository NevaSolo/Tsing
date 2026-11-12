// URL du backend Django. Surchargeable via VITE_API_URL (voir client/.env.local).
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
