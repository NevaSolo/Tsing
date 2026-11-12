import * as Dialog from "@radix-ui/react-dialog";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { formatPrice } from "../lib/format";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/feedback";

/** Panier en panneau latéral accessible (focus piégé, Échap pour fermer). */
const Cart = () => {
  const navigate = useNavigate();
  const { cart, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, getTotalPrice } = useCart();

  const goTo = (path) => {
    setIsCartOpen(false);
    navigate(path);
  };

  return (
    <Dialog.Root open={isCartOpen} onOpenChange={setIsCartOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[420px] flex-col border-l border-border bg-card shadow-[var(--shadow-card-hover)] focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <Dialog.Title className="font-display text-2xl">Panier</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fermer le panier">
                <X className="!size-5" />
              </Button>
            </Dialog.Close>
          </div>

          {cart.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Votre panier est vide"
              description="Parcourez la boutique et ajoutez vos t-shirts préférés."
              action={<Button onClick={() => goTo("/ecommerce")}>Voir la boutique</Button>}
              className="flex-1"
            />
          ) : (
            <>
              <ul data-lenis-prevent className="flex-1 divide-y divide-border overflow-y-auto px-6">
                {cart.map((item) => (
                  <li key={item.key} className="flex gap-4 py-4">
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted">
                      <span
                        className="size-9 rounded-full border border-border"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">Taille {item.size}</p>
                      <div className="mt-2 flex items-center gap-1" role="group" aria-label={`Quantité de ${item.name}`}>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Diminuer la quantité"
                        >
                          <Minus />
                        </Button>
                        <span className="w-8 text-center tabular-nums" aria-live="polite">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          disabled={item.stock != null && item.quantity >= item.stock}
                          aria-label="Augmenter la quantité"
                        >
                          <Plus />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <span className="font-medium tabular-nums">{formatPrice(item.price * item.quantity)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFromCart(item.key)}
                        aria-label={`Retirer ${item.name} du panier`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t border-border p-6">
                <div className="mb-4 flex items-center justify-between text-lg">
                  <span>Total</span>
                  <span className="font-semibold tabular-nums">{formatPrice(getTotalPrice())}</span>
                </div>
                <Button size="lg" className="w-full" onClick={() => goTo("/checkout")}>
                  Passer la commande
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Cart;
