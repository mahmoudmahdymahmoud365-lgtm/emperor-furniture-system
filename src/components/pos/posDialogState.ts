// ==============================
// Tiny global store for the POS dialog so any page/button can open it
// without navigating to a route.
// ==============================
import { useSyncExternalStore } from "react";

type PosState = { open: boolean; customer: string };

let state: PosState = { open: false, customer: "" };
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}

export function subscribePos(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPosState(): PosState {
  return state;
}

export function openPOS(customer = "") {
  state = { open: true, customer };
  emit();
}

export function closePOS() {
  state = { open: false, customer: "" };
  emit();
}

export function usePosDialog(): PosState {
  return useSyncExternalStore(subscribePos, getPosState, getPosState);
}
