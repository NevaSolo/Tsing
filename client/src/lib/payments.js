/*
 * Paiement Stripe Checkout côté site : on crée la commande, le serveur ouvre une session de paiement
 * Stripe, et le navigateur y est redirigé (aucune donnée de carte ne passe par Tsing).
 */
import api from "./api";

export const paymentsApi = {
  config: () => api.get("/payments/config/").then((r) => r.data),
  pay: (orderId) => api.post(`/orders/${orderId}/pay/`).then((r) => r.data.url),
  confirm: (orderId) => api.post(`/orders/${orderId}/confirm/`).then((r) => r.data),
  cancel: (orderId) => api.post(`/orders/${orderId}/cancel/`).then((r) => r.data),
};

/** Redirige vers la page de paiement Stripe de la commande. */
export async function goToPayment(orderId) {
  const url = await paymentsApi.pay(orderId);
  // Seule une adresse Stripe est acceptée (jamais de redirection arbitraire).
  if (!/^https:\/\/checkout\.stripe\.com\//.test(url)) throw new Error("Adresse de paiement inattendue.");
  window.location.assign(url);
}

// Commande en attente pour CE panier : si le client revient de Stripe (bouton Retour) et repaye,
// on reprend la même commande au lieu d'en créer une seconde (et de réserver le stock deux fois).
const PENDING_KEY = "checkout.pending";

export const cartSignature = (cart) =>
  cart
    .map((i) => `${i.shirtId}:${i.size}:${i.quantity}`)
    .sort()
    .join("|");

export const pendingOrder = {
  get(cart) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
      return saved && saved.signature === cartSignature(cart) ? saved.orderId : null;
    } catch {
      return null;
    }
  },
  set(orderId, cart) {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ orderId, signature: cartSignature(cart) }));
    } catch {
      /* stockage indisponible : au pire une seconde commande en attente, annulée au délai */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* rien à faire */
    }
  },
};
