import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";

/** Hero de la page d'accueil. */
export const Desktop = () => (
  <section className="relative overflow-hidden">
    <div className="mx-auto grid max-w-[1280px] items-center gap-8 px-4 pb-12 pt-[104px] md:grid-cols-2 md:px-8 md:pb-20 lg:min-h-[calc(100dvh-8px)]">
      <div className="animate-fade-in-up">
        <p className="mb-4 inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-ink">
          Personnalisation 3D en temps réel
        </p>
        <h1 className="font-display text-7xl leading-none text-foreground sm:text-8xl lg:text-[160px]">TSING</h1>
        <p className="mt-4 max-w-[520px] text-lg text-muted-foreground md:text-xl">
          Créez votre propre marque de t-shirts : imaginez votre design en 3D, publiez-le et vendez-le
          en quelques minutes.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/ecommerce">
              Découvrir la boutique <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline-brand">
            <Link to="/auth?role=designer">Devenir designer</Link>
          </Button>
        </div>
      </div>

      <div className="flex justify-center">
        <img
          className="max-h-[70vh] w-auto animate-fade-in-up object-contain [animation-delay:150ms]"
          alt="Homme portant un t-shirt blanc uni, prêt à être personnalisé"
          src="/chatgpt-image-9-avr-photoroom-1.png"
          width="800"
          height="1000"
          fetchPriority="high"
        />
      </div>
    </div>
  </section>
);
