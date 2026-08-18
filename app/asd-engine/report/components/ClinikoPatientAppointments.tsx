"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClinikoPatientAppointment } from "@/lib/cliniko";

function formatAppointmentWhen(iso: string | null): string {
  if (!iso) return "Unknown time";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${weekdays[date.getDay()]} ${pad(date.getDate())} ${months[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isActiveAppointment(appointment: ClinikoPatientAppointment): boolean {
  return !appointment.cancelled_at && !appointment.archived_at;
}

export function ClinikoPatientAppointments({
  patientId,
  className,
}: {
  patientId: string | null | undefined;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<ClinikoPatientAppointment[]>([]);

  useEffect(() => {
    if (!patientId) {
      setAppointments([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/cliniko/appointments?patientId=${encodeURIComponent(patientId)}`
        );
        const data = (await response.json()) as {
          appointments?: ClinikoPatientAppointment[];
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(data.error ?? "Could not load Cliniko appointments.");
          setAppointments([]);
          return;
        }
        setAppointments(data.appointments ?? []);
      } catch {
        if (!cancelled) {
          setError("Could not load Cliniko appointments.");
          setAppointments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const { upcoming, recent } = useMemo(() => {
    const now = Date.now();
    const active = appointments.filter(isActiveAppointment);
    const upcomingList = active
      .filter((a) => {
        if (!a.starts_at) return false;
        const t = new Date(a.starts_at).getTime();
        return Number.isFinite(t) && t >= now;
      })
      .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())
      .slice(0, 5);
    const recentList = active
      .filter((a) => {
        if (!a.starts_at) return false;
        const t = new Date(a.starts_at).getTime();
        return Number.isFinite(t) && t < now;
      })
      .sort((a, b) => new Date(b.starts_at!).getTime() - new Date(a.starts_at!).getTime())
      .slice(0, 5);
    return { upcoming: upcomingList, recent: recentList };
  }, [appointments]);

  if (!patientId) return null;

  return (
    <div
      className={cn("rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5", className)}
      data-testid="cliniko-appointments"
    >
      <div className="mb-2 flex items-center gap-2">
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
        <h4 className="text-sm font-semibold text-foreground">Cliniko appointments</h4>
        {loading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
      </div>

      {error ? (
        <p className="text-sm text-amber-900 dark:text-amber-100" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && upcoming.length === 0 && recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No appointments found for this patient.</p>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="mb-2 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Upcoming
          </p>
          <ul className="space-y-1">
            {upcoming.map((appointment) => (
              <li key={appointment.id} className="text-sm text-foreground">
                {formatAppointmentWhen(appointment.starts_at)}
                {appointment.notes?.trim() ? (
                  <span className="text-muted-foreground"> · {appointment.notes.trim()}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent
          </p>
          <ul className="space-y-1">
            {recent.map((appointment) => (
              <li key={appointment.id} className="text-sm text-foreground">
                {formatAppointmentWhen(appointment.starts_at)}
                {appointment.notes?.trim() ? (
                  <span className="text-muted-foreground"> · {appointment.notes.trim()}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
