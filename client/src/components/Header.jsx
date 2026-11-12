import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { MessageCircle, Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { useUnreadCount } from "../lib/messages";
import { useCart } from "../context/CartContext";
import { dashboardPath, useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import Cart from "./Cart";
import ThemeToggle, { ThemeSegmented } from "./ThemeToggle";

const navLinkClass = ({ isActive }) =>
  cn(
    "font-display text-lg transition-colors hover:text-brand-ink",
    isActive ? "text-brand-ink" : "text-foreground"
  );

/**
 * En-tête unique du site (fixe, 72 px).
 * `transparent` : fond translucide pour la page d'accueil.
 */
const Header = ({ transparent = false }) => {
  const { user } = useAuth();
  const { setIsCartOpen, getTotalItems } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const itemCount = getTotalItems();
  const unread = useUnreadCount(Boolean(user));

  // Ferme le menu mobile à chaque changement de page.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const links = [
    { to: "/ecommerce", label: "Boutique" },
    { to: "/designers", label: "Designers" },
    ...(user?.role === "designer" ? [{ to: "/archive", label: "Mes créations" }] : []),
  ];

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 h-[72px] border-b transition-colors",
          transparent
            ? "border-transparent bg-background/80 backdrop-blur-md"
            : "border-border bg-background"
        )}
      >
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-4 md:px-8">
          <Link to="/" className="font-display text-2xl tracking-[2px] text-brand-ink" aria-label="Tsing, accueil">
            TSING
          </Link>

          <nav aria-label="Navigation principale" className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle className="hidden md:inline-flex" />
            {user && (
              <Button asChild variant="ghost" size="icon" className="relative">
                <Link to="/messages" aria-label={unread ? `Messages (${unread} non lu${unread > 1 ? "s" : ""})` : "Messages"}>
                  <MessageCircle className="!size-5" />
                  {unread > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white" aria-hidden="true">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setIsCartOpen(true)}
              aria-label={`Ouvrir le panier (${itemCount} article${itemCount > 1 ? "s" : ""})`}
            >
              <ShoppingBag className="!size-5" />
              {itemCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex min-w-5 h-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white">
                  {itemCount}
                </span>
              )}
            </Button>

            {user ? (
              <Button asChild variant="ghost" className="hidden px-3 md:inline-flex">
                <Link to={dashboardPath(user)}>
                  <UserRound className="!size-5" />
                  <span className="max-w-[140px] truncate">{user.name || user.email}</span>
                </Link>
              </Button>
            ) : (
              <Button asChild className="hidden md:inline-flex">
                <Link to="/auth">Se connecter</Link>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {menuOpen ? <X className="!size-6" /> : <Menu className="!size-6" />}
            </Button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="mobile-menu"
            aria-label="Navigation mobile"
            className="border-b border-border bg-background px-4 pb-4 shadow-[var(--shadow-card)] md:hidden"
          >
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className={(state) => cn(navLinkClass(state), "block border-b border-border py-3")}
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <ThemeSegmented className="mt-4" />
            <Button asChild className="mt-4 w-full">
              <Link to={user ? dashboardPath(user) : "/auth"}>
                {user ? "Mon espace" : "Se connecter"}
              </Link>
            </Button>
          </nav>
        )}
      </header>
      <Cart />
    </>
  );
};

export default Header;
