import { useEffect, useSyncExternalStore } from "react";
import { checkAvailability, getState, subscribe } from "./localAI";

/** État de l'IA locale pour React ; vérifie la disponibilité (sans rien télécharger) au premier usage. */
export default function useLocalAI() {
  const state = useSyncExternalStore(subscribe, getState, getState);
  useEffect(() => {
    if (getState().status === "idle") checkAvailability();
  }, []);
  return state;
}
