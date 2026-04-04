import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isApiConnected, initializeStore } from "@/data/store";

export function ConnectionStatus() {
  const [connected, setConnected] = useState(isApiConnected());
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setConnected(isApiConnected());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await initializeStore();
      setConnected(isApiConnected());
    } catch {}
    setRetrying(false);
  };

  if (connected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 text-success text-xs font-medium">
            <Wifi className="h-3 w-3" />
            <span className="hidden sm:inline">متصل</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>متصل بالخادم</TooltipContent>
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
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>غير متصل بالخادم — اضغط لإعادة المحاولة</TooltipContent>
    </Tooltip>
  );
}
