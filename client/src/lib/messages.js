/*
 * Messagerie client ↔ designer : appels API, compteur de non-lus partagé, rafraîchissement automatique.
 * Pas de serveur temps réel : le navigateur interroge l'API à intervalle régulier, et seulement quand
 * l'onglet est visible (aucune requête inutile en arrière-plan).
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import api from "./api";

export const MESSAGE_MAX_LENGTH = 2000;
export const THREAD_POLL_MS = 4000;
export const INBOX_POLL_MS = 10000;
const UNREAD_POLL_MS = 30000;

export const messagesApi = {
  list: (signal) => api.get("/conversations/", { signal }).then((r) => r.data),
  get: (id, signal) => api.get(`/conversations/${id}/`, { signal }).then((r) => r.data),
  contact: (designerId, signal) => api.get("/conversations/contact/", { params: { designer: designerId }, signal }).then((r) => r.data),
  start: (payload) => api.post("/conversations/", payload).then((r) => r.data),
  messages: (id, after, signal) =>
    api.get(`/conversations/${id}/messages/`, { params: after ? { after } : {}, signal }).then((r) => r.data),
  send: (id, payload) => api.post(`/conversations/${id}/messages/`, payload).then((r) => r.data),
  read: (id) => api.post(`/conversations/${id}/read/`).then((r) => r.data),
  unread: () => api.get("/conversations/unread/").then((r) => r.data.count),
};

// ------------------------------------------------------------------ Compteur de non-lus (en-tête, tableaux de bord)

let unread = 0;
const listeners = new Set();
const setUnread = (n) => {
  if (n === unread) return;
  unread = n;
  listeners.forEach((l) => l());
};
let inflight = null;
/** Recharge le compteur (après lecture d'une conversation, par exemple). */
export const refreshUnread = () =>
  (inflight ??= messagesApi
    .unread()
    .then(setUnread)
    .catch(() => {})
    .finally(() => {
      inflight = null;
    }));

/** Nombre de messages non lus, rafraîchi toutes les 30 s (onglet visible) tant qu'un composant l'affiche. */
export function useUnreadCount(enabled) {
  const count = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => unread
  );
  usePolling(refreshUnread, UNREAD_POLL_MS, enabled);
  useEffect(() => {
    if (!enabled) setUnread(0);
  }, [enabled]);
  return enabled ? count : 0;
}

/**
 * Appelle `fn` tout de suite puis toutes les `ms` millisecondes, seulement si l'onglet est visible ;
 * relance immédiatement au retour sur l'onglet.
 */
export function usePolling(fn, ms, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    const tick = () => {
      if (document.visibilityState === "visible") fnRef.current();
    };
    const start = () => {
      clearInterval(timer);
      timer = setInterval(tick, ms);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      }
    };
    tick();
    start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}

// ------------------------------------------------------------------ Affichage

export const initials = (name = "") =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

/** « 14:32 » aujourd'hui, « hier », « lun. 14:32 » cette semaine, sinon « 3 nov. ». */
export function formatMessageTime(iso, { short = false } = {}) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (days === 0) return time;
  if (days === 1) return short ? "hier" : `hier ${time}`;
  if (days < 7) return short ? date.toLocaleDateString("fr-FR", { weekday: "short" }) : `${date.toLocaleDateString("fr-FR", { weekday: "short" })} ${time}`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

/** Aperçu d'une conversation dans la liste. */
export function previewText(last) {
  if (!last) return "Nouvelle conversation";
  const body = last.body || (last.has_shirt ? "Design joint" : "");
  return `${last.mine ? "Vous : " : ""}${body}`;
}
