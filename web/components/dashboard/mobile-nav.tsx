"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          className="size-9 shrink-0 transition-all duration-300 hover:scale-105 hover:bg-secondary lg:hidden"
        >
          <Menu className="size-5" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Pharos x402 Paywalled API navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Jump to overview, endpoints, explorer, facilitator, proof, or documentation.
        </SheetDescription>
        <Sidebar mobile onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
