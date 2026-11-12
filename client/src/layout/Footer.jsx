import { Link } from "react-router-dom";

const COLUMNS = [
  {
    title: "Boutique",
    links: [
      { to: "/ecommerce", label: "Tous les t-shirts" },
      { to: "/ecommerce?tri=price-asc", label: "Petits prix" },
      { to: "/designers", label: "Nos designers" },
    ],
  },
  {
    title: "Créer",
    links: [
      { to: "/auth?role=designer", label: "Devenir designer" },
      { to: "/customizer", label: "Personnaliser un t-shirt" },
      { to: "/archive", label: "Mes créations" },
    ],
  },
  {
    title: "Mon compte",
    links: [
      { to: "/auth", label: "Connexion" },
      { to: "/auth?role=client", label: "Créer un compte client" },
      { to: "/checkout", label: "Mon panier" },
    ],
  },
];

const Footer = () => (
  <footer className="border-t border-border bg-muted/50">
    <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 md:grid-cols-4 md:px-8">
      <div>
        <Link to="/" className="font-display text-2xl tracking-[2px] text-brand-ink">
          TSING
        </Link>
        <p className="mt-3 max-w-xs text-sm text-muted-foreground">
          Créez votre propre marque de t-shirts : personnalisez en 3D, publiez, vendez.
        </p>
      </div>
      {COLUMNS.map((col) => (
        <nav key={col.title} aria-label={col.title}>
          <h2 className="font-display text-lg text-foreground">{col.title}</h2>
          <ul className="mt-3 space-y-2">
            {col.links.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-muted-foreground transition-colors hover:text-brand-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
    <div className="border-t border-border">
      <p className="mx-auto max-w-[1280px] px-4 py-5 text-sm text-muted-foreground md:px-8">
        © {new Date().getFullYear()} Tsing. Tous droits réservés.
      </p>
    </div>
  </footer>
);

export default Footer;
