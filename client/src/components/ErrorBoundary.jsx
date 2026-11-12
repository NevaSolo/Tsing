import { Component } from "react";

/** Intercepte une erreur de rendu (ex. modèle 3D introuvable) au lieu de faire planter toute la page. */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erreur interceptée :", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center">
            <p className="text-muted-foreground">L'aperçu 3D n'a pas pu être chargé.</p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-[var(--radius-control)] bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
            >
              Réessayer
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
