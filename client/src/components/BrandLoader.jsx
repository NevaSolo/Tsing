/**
 * Animation de chargement Tsing (logo « TS » + « TSING » + barre). Mêmes styles que l'écran affiché
 * avant le démarrage de React (index.html, classes .ts-*) : aucune coupure visuelle entre les deux.
 * `inline` : dans la page (sans recouvrir l'en-tête) au lieu de plein écran.
 */
const BrandLoader = ({ inline = false, label = "Chargement de Tsing" }) => (
  <div className={inline ? "ts-splash ts-inline" : "ts-splash"} role="status" aria-label={label}>
    <svg className="ts-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect className="tile" x="1" y="1" width="62" height="62" rx="14" strokeWidth="2" />
      <g className="ts t">
        <rect x="7" y="13" width="23" height="8" rx="1.5" />
        <rect x="14.5" y="13" width="8" height="38" rx="1.5" />
      </g>
      <g className="ts s">
        <rect x="34" y="13" width="23" height="8" rx="1.5" />
        <rect x="34" y="13" width="8" height="22" rx="1.5" />
        <rect x="34" y="28" width="23" height="8" rx="1.5" />
        <rect x="49" y="28" width="8" height="23" rx="1.5" />
        <rect x="34" y="43" width="23" height="8" rx="1.5" />
      </g>
    </svg>
    <div className="ts-word" aria-hidden="true">
      {["T", "S", "I", "N", "G"].map((letter) => (
        <span key={letter}>{letter}</span>
      ))}
    </div>
    <div className="ts-bar" aria-hidden="true" />
  </div>
);

export default BrandLoader;
