"use client";

import Navbar from "@/app/components/Navbar";
import CapabilitiesPanel from "./CapabilitiesPanel";

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
        <CapabilitiesPanel />
      </div>
    </main>
  );
}
