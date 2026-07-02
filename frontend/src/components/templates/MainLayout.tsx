"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { NavigationBar } from "../organisms/NavigationBar";
import { PINLockOverlay } from "../organisms/PINLockOverlay";
import { apiRequest } from "@/utils/api";
import { Spinner } from "../atoms/Spinner";

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(300);

  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const shouldLock = (overrideTimeout?: number) => {
    if (typeof window === "undefined") return true;
    const unlockedAtStr = localStorage.getItem("pin_unlocked_at");
    if (!unlockedAtStr) return true;
    const unlockedAt = parseInt(unlockedAtStr, 10);
    const now = Date.now();
    
    const timeout = overrideTimeout ?? timeoutSeconds;
    // Grace period based on timeout setting
    if (now - unlockedAt < timeout * 1000) {
      return false;
    }
    return true;
  };

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth");
      return;
    }

    setIsAuthenticated(true);
    
    // Fetch settings to check if PIN lock is enabled
    try {
      const settings = await apiRequest("/settings");
      if (settings) {
        setPinEnabled(settings.pin_enabled);
        const fetchedTimeout = settings.idle_timeout_seconds || 300;
        setTimeoutSeconds(fetchedTimeout);
        
        if (settings.pin_enabled && shouldLock(fetchedTimeout)) {
          setIsLocked(true);
        } else {
          setIsLocked(false);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Idle timeout detector
  useEffect(() => {
    if (!isAuthenticated || !pinEnabled || isLocked) return;

    const resetIdleTimeout = () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = setTimeout(() => {
        if (shouldLock()) {
          setIsLocked(true);
        }
      }, timeoutSeconds * 1000);
    };

    // Listen to user activities
    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimeout));

    resetIdleTimeout();

    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimeout));
    };
  }, [isAuthenticated, pinEnabled, isLocked, timeoutSeconds]);

  // Tab visibility lock detector
  useEffect(() => {
    if (!isAuthenticated || !pinEnabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (shouldLock()) {
          setIsLocked(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, pinEnabled, timeoutSeconds]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090e17] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (pinEnabled && isLocked) {
    return (
      <PINLockOverlay
        onUnlock={() => {
          localStorage.setItem("pin_unlocked_at", Date.now().toString());
          setIsLocked(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#090e17] text-foreground font-sans relative antialiased overflow-x-hidden w-full max-w-[100vw]">
      {/* Decorative Radial Background Blobs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-sky-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

      {/* App Sidebar */}
      <NavigationBar />

      {/* Main Content Area */}
      <main className="flex-1 w-full p-4 sm:p-6 md:p-8 pb-28 md:pb-8 overflow-y-auto overflow-x-hidden max-h-screen">
        {children}
      </main>
    </div>
  );
};
