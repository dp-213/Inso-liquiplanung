"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

export function useMobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const scrollYRef = useRef(0);
  const wasOpenRef = useRef(false);

  // Schließen bei Route-Wechsel
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // ESC-Key schließt Drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Body scroll lock (iOS Safari kompatibel)
  useEffect(() => {
    if (isOpen) {
      scrollYRef.current = window.scrollY;
      document.body.classList.add("drawer-open");
      document.body.style.top = `-${scrollYRef.current}px`;
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      // Nur restoren wenn Drawer vorher offen war (nicht beim Initial Mount)
      document.body.classList.remove("drawer-open");
      document.body.style.top = "";
      window.scrollTo(0, scrollYRef.current);
      wasOpenRef.current = false;
    }
    return () => {
      document.body.classList.remove("drawer-open");
      document.body.style.top = "";
    };
  }, [isOpen]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle };
}
