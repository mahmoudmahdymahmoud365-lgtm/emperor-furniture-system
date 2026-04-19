import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { logout, isAuthenticated, addSecurityEvent, getCurrentUser } from "@/data/store";
import { useToast } from "@/hooks/use-toast";

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE = 2 * 60 * 1000; // warn 2 min before

export function useInactivityLogout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnedRef = useRef(false);

  const doLogout = useCallback(() => {
    if (!isAuthenticated()) return;
    const user = getCurrentUser();
    if (user) {
      addSecurityEvent("session_expired", user.email, user.name);
    }
    logout();
    navigate("/login", { replace: true });
    toast({
      title: "انتهت الجلسة",
      description: "تم تسجيل الخروج تلقائياً بسبب عدم النشاط",
      variant: "destructive",
    });
  }, [navigate, toast]);

  const showWarning = useCallback(() => {
    if (warnedRef.current) return;
    warnedRef.current = true;
    toast({
      title: "⚠️ تنبيه",
      description: "سيتم تسجيل خروجك خلال دقيقتين بسبب عدم النشاط",
    });
  }, [toast]);

  const resetTimers = useCallback(() => {
    if (!isAuthenticated()) return;
    warnedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    warningRef.current = setTimeout(showWarning, INACTIVITY_TIMEOUT - WARNING_BEFORE);
    timerRef.current = setTimeout(doLogout, INACTIVITY_TIMEOUT);
  }, [doLogout, showWarning]);

  useEffect(() => {
    if (!isAuthenticated()) return;

    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
    const handler = () => resetTimers();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [resetTimers]);
}
