import { useCallback, useReducer } from "react";

const HISTORY_LIMIT = 100;
const COALESCE_MS = 800;

/*
 * État des calques avec historique (annuler / rétablir).
 * - `commit` enregistre un état dans l'historique (fin de trait, ajout, suppression…)
 * - `preview` modifie l'état affiché SANS l'historique (trait en cours, déplacement en cours) :
 *   le `commit` final ne crée qu'une seule étape d'annulation.
 */
function reducer(state, action) {
  switch (action.type) {
    case "preview":
      return { ...state, present: action.layers };
    case "commit": {
      const base = action.from ?? state.present;
      if (action.layers === base && !action.from) return state;
      // Modifications rapprochées du même élément (frappe, curseur) = une seule étape d'annulation.
      if (action.coalesceKey && action.coalesceKey === state.lastKey && action.at - state.lastAt < COALESCE_MS) {
        return { ...state, present: action.layers, future: [], lastAt: action.at };
      }
      return {
        past: [...state.past, base].slice(-HISTORY_LIMIT),
        present: action.layers,
        future: [],
        lastKey: action.coalesceKey ?? null,
        lastAt: action.at ?? 0,
      };
    }
    case "undo": {
      if (!state.past.length) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
        lastKey: null,
      };
    }
    case "redo": {
      if (!state.future.length) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
        lastKey: null,
      };
    }
    case "reset":
      return { past: [], present: action.layers, future: [] };
    default:
      return state;
  }
}

export default function useLayersEditor(initial = []) {
  const [state, dispatch] = useReducer(reducer, { past: [], present: initial, future: [] });

  return {
    layers: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    preview: useCallback((layers) => dispatch({ type: "preview", layers }), []),
    /** `from` : état de départ d'une interaction prévisualisée (pour une seule étape d'annulation). */
    commit: useCallback(
      (layers, from, coalesceKey) => dispatch({ type: "commit", layers, from, coalesceKey, at: performance.now() }),
      []
    ),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
    reset: useCallback((layers) => dispatch({ type: "reset", layers }), []),
  };
}
