import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isApiConnected, initializeStore } from "@/data/store";
import { api } from "@/data/apiClient";

export function ConnectionStatus() {
  const [connected, setConnected] = useState(isApiConnected());
  const [retrying, setRetrying] = useState(false);
  const [lastError, setLastError] = useState("");

  useEffect(() => {
    const check = async () => {
      try {
        await api.health();
        setConnected(true);
        setLastError("");
      } catch {
        setConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setLastError("");
    try {
      await api.health();
      await initializeStore();
      setConnected(true);
    } catch (e: any) {
      setConnected(false);
      setLastError(e?.message || "فشل الاتصال");
    }
    setRetrying(false);
  }, []);

  if (connected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
            <Wifi className="h-3 w-3" />
            <span className="hidden sm:inline">متصل</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>متصل بالخادم — جميع الخدمات تعمل بشكل طبيعي</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium">
            <WifiOff className="h-3 w-3" />
            <span className="hidden sm:inline">غير متصل</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRetry}
            disabled={retrying}
            title="إعادة الاتصال بالخادم"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-center">
          <p>غير متصل بالخادم</p>
          <p className="text-xs opacity-70">اضغط زر إعادة المحاولة للاتصال مرة أخرى</p>
          {lastError && <p className="text-xs text-destructive mt-1">{lastError}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
