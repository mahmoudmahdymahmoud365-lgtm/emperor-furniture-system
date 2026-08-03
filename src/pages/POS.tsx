// ==============================
// /pos — legacy route. POS is now an overlay, so this simply opens the
// POS dialog over the dashboard instead of rendering a separate page.
// ==============================
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { openPOS } from "@/components/pos/posDialogState";

export default function POS() {
  useEffect(() => { openPOS(); }, []);
  return <Navigate to="/" replace />;
}
