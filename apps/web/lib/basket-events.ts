export const basketChangedEvent = 'angadi:basket-changed';

export function notifyBasketChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(basketChangedEvent));
  }
}
