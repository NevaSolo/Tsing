import { Link } from "react-router-dom";
import { ArrowRight, Box, Layers, Rocket } from "lucide-react";
import { Button } from "../components/ui/button";

const FEATURES = [
  {
    icon: Layers,
    title: "Texte, image, couleur",
    text: "Importez votre logo, choisissez la police, placez-le sur la poitrine, le ventre ou le dos.",
  },
  {
    icon: Box,
    title: "Aperçu 3D face & dos",
    text: "Faites pivoter le t-shirt et vérifiez chaque détail avant de le publier.",
  },
  {
    icon: Rocket,
    title: "En boutique en un clic",
    text: "Fixez votre prix et votre stock : votre création est en vente immédiatement.",
  },
];

const SWATCHES = ["#111111", "#ffffff", "#a40000", "#1d4ed8", "#15803d"];

/** Pastille d'interface flottante (évoque le personnaliseur réel). */
const Chip = ({ className, children }) => (
  <div
    className={`absolute rounded-2xl border border-border bg-background/95 px-3 py-2 shadow-[var(--shadow-card-hover)] backdrop-blur ${className}`}
    aria-hidden="true"
  >
    {children}
  </div>
);

/** Visuel : t-shirt face (avec un design en surimpression) et dos, plus éléments d'interface. */
const Showcase = () => (
  <div className="relative mx-auto aspect-[5/6] w-full max-w-[520px]">
    {/* Halo de marque */}
    <div className="absolute inset-[8%] rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />

    {/* Dos, en retrait */}
    <figure className="absolute right-0 top-0 w-[52%] rotate-[5deg] overflow-hidden rounded-[var(--radius-card)] bg-muted shadow-[var(--shadow-card-hover)]">
      <img src="/landing/tee-back.webp" alt="" loading="lazy" width="800" height="800" className="aspect-square w-full object-cover" />
      <figcaption className="absolute right-2 top-2 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-medium">
        Dos
      </figcaption>
    </figure>

    {/* Face, au premier plan, avec le design imprimé */}
    <figure className="absolute bottom-0 left-0 w-[72%] -rotate-[3deg] overflow-hidden rounded-[var(--radius-card)] border-4 border-background bg-muted shadow-[var(--shadow-card-hover)]">
      <img
        src="/landing/tee-front.webp"
        alt="T-shirt noir personnalisé avec le logo TSING sur la poitrine"
        loading="lazy"
        width="800"
        height="800"
        className="aspect-square w-full object-cover"
      />
      {/* Zone d'impression + design (superposé à la photo) */}
      <div className="absolute left-1/2 top-[30%] flex w-[34%] -translate-x-1/2 flex-col items-center rounded-md border border-dashed border-white/40 px-2 py-3">
        <span className="font-display text-[clamp(18px,4.2vw,40px)] leading-none tracking-[3px] text-white">TSING</span>
        <span className="mt-1 h-[3px] w-2/3 rounded-full bg-brand" />
      </div>
      <figcaption className="absolute bottom-2 left-2 rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">
        Face
      </figcaption>
    </figure>

    {/* Éléments d'interface flottants */}
    <Chip className="-left-2 top-[14%] sm:-left-6">
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Couleur du t-shirt</p>
      <div className="flex gap-1.5">
        {SWATCHES.map((c, i) => (
          <span
            key={c}
            className={`size-5 rounded-full border border-input ${i === 0 ? "ring-2 ring-brand ring-offset-1" : ""}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </Chip>

    <Chip className="-right-1 bottom-[22%] flex items-center gap-2 sm:-right-4">
      <Box className="size-4 text-brand-ink" />
      <span className="text-sm font-medium">Aperçu 3D</span>
      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">live</span>
    </Chip>

    <Chip className="bottom-[-4%] right-[18%] px-4">
      <p className="text-[11px] text-muted-foreground">Prix de vente</p>
      <p className="font-display text-xl text-brand-ink">24,90 €</p>
    </Chip>
  </div>
);

const FeatureItem = ({ icon, title, text }) => {
  const Icon = icon;
  return (
    <li className="flex gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </li>
  );
};

const About = () => (
  <section aria-labelledby="vision-title" className="overflow-hidden">
    <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-20">
      <div className="order-2 lg:order-1">
        <Showcase />
      </div>

      <div className="order-1 lg:order-2">
        <p className="mb-4 inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-ink">
          Artistes · Marques · Passionnés
        </p>
        <h2 id="vision-title" className="font-display text-5xl leading-[0.95] text-foreground md:text-6xl">
          Ton idée.
          <br />
          Ton t-shirt.
          <br />
          <span className="text-brand-ink">Ta marque.</span>
        </h2>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
          Tsing transforme une simple idée en vêtement prêt à vendre. Pas besoin de logiciel de
          design ni de stock : tu crées, tu publies, tes clients commandent.
        </p>

        <ul className="mt-8 space-y-5">
          {FEATURES.map((f) => (
            <FeatureItem key={f.title} {...f} />
          ))}
        </ul>

        <Button asChild size="lg" className="mt-10">
          <Link to="/customizer">
            Lancer le personnaliseur <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  </section>
);

export default About;
