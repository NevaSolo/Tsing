import { Link } from "react-router-dom";
import { Box, Palette, Rocket } from "lucide-react";
import { About, LatestCreations } from "../section";
import { Footer } from "../layout";
import ScrollProgressBar from "../components/ScrollProgressBar";
import Header from "../components/Header";
import { Desktop } from "./Desktop";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/feedback";

const STEPS = [
  { icon: Palette, title: "Imaginez", text: "Ajoutez votre texte, votre logo et choisissez la couleur de votre t-shirt." },
  { icon: Box, title: "Visualisez en 3D", text: "Faites pivoter le t-shirt, vérifiez la face et le dos avant de publier." },
  { icon: Rocket, title: "Vendez", text: "Publiez dans la boutique et suivez vos ventes depuis votre tableau de bord." },
];

const StepCard = ({ icon, title, text, index }) => {
  const Icon = icon;
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-brand text-white">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="font-display text-sm text-muted-foreground">Étape {index + 1}</span>
      </div>
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="mt-2 text-muted-foreground">{text}</p>
    </Card>
  );
};

const Landin = () => (
  <div className="min-h-screen w-full bg-background">
    <Header transparent />
    <ScrollProgressBar />
    <main>
      <Desktop />

      <section aria-labelledby="how-title" className="bg-muted/50 py-16 md:py-24">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <h2 id="how-title" className="text-center font-display text-4xl md:text-5xl">
            Comment ça marche
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <StepCard key={step.title} {...step} index={index} />
            ))}
          </div>
        </div>
      </section>

      <About />

      <LatestCreations />

      <section className="px-4 pb-16 md:px-8 md:pb-24">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 rounded-[var(--radius-card)] bg-brand px-6 py-12 text-center text-white md:py-16">
          <h2 className="font-display text-4xl md:text-5xl">Prêt à lancer votre marque ?</h2>
          <p className="max-w-xl text-white/85">
            Créez un compte designer gratuitement et publiez votre premier t-shirt dès aujourd'hui.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-white text-brand hover:bg-white/90">
              <Link to="/auth?role=designer">Commencer gratuitement</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <Link to="/ecommerce">Voir la boutique</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
    <Footer />
  </div>
);

export default Landin;
