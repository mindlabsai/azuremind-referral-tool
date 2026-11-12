"use client";

import { useState } from "react";
import Link from "next/link";
import { OLIVER_VIGNETTE } from "@/lib/oliver-vignette";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SignOutButton } from "@/components/SignOutButton";
import { Brain } from "lucide-react";
import { EngineAssistant } from "./components/EngineAssistant";
import { SAMPLE_NOTE } from "./asd-engine-core";

export default function ASDLiveFormulationEnginePage() {
  const [notes, setNotes] = useState(SAMPLE_NOTE);

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="h-7 w-7" />
              <h1 className="text-3xl font-semibold tracking-tight">ASD Live Formulation Engine</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Raw clinical notes become DSM-linked markers, missing-evidence prompts, contradiction alerts, and
              report-ready formulation blocks while the assessor types.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setNotes("")}>
              Clear
            </Button>
            <Button type="button" variant="outline" onClick={() => setNotes(SAMPLE_NOTE)}>
              Load demo
            </Button>
            <Button type="button" onClick={() => setNotes(OLIVER_VIGNETTE)}>
              Load Oliver vignette
            </Button>
            <Button type="button" variant="secondary" asChild>
              <Link href="/asd-engine/report">Texlex Live Report Generator</Link>
            </Button>
            <SignOutButton className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Card className="rounded-2xl shadow-sm lg:col-span-5">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Live raw notes</h2>
                <Badge variant="secondary">{notes.length.toLocaleString()} characters</Badge>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={50000}
                placeholder="Type live ASD/ADHD assessment notes here..."
                className="min-h-[560px] resize-none rounded-xl bg-white text-base leading-7"
              />
            </CardContent>
          </Card>

          <div className="lg:col-span-7">
            <EngineAssistant rawNotes={notes} />
          </div>
        </div>
      </div>
    </div>
  );
}
