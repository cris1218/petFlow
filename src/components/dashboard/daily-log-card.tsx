"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, PawPrint, Send, Upload } from "lucide-react";
import { createDailyLog } from "@/actions/daily-logs";
import { QUICK_STATUS_NOTES, SPECIES_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export type DailyLogStay = {
  bookingId: string;
  petName: string;
  species: "DOG" | "CAT" | "OTHER" | string;
  tutorName: string;
  tutorPhone: string;
  recentLogs: Array<{
    id: string;
    photoUrl: string;
    statusNote: string;
    sentToWhatsApp: boolean;
    createdAt: Date | string;
  }>;
};

type DailyLogCardProps = {
  stays: DailyLogStay[];
};

export function DailyLogCard({ stays }: DailyLogCardProps) {
  const [bookingId, setBookingId] = useState(stays[0]?.bookingId ?? "");
  const [statusNote, setStatusNote] = useState<string>(QUICK_STATUS_NOTES[0]);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => stays.find((stay) => stay.bookingId === bookingId),
    [stays, bookingId],
  );

  function onFileChange(nextFile: File | undefined) {
    if (!nextFile) return;
    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
    setError(null);
    setMessage(null);
  }

  function handleSubmit() {
    if (!bookingId || !file) {
      setError("Selecione o pet e uma foto para enviar o diário.");
      return;
    }

    const formData = new FormData();
    formData.set("bookingId", bookingId);
    formData.set("statusNote", statusNote);
    formData.set("photo", file);

    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await createDailyLog(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        result.sentToWhatsApp
          ? "Diário enviado no WhatsApp do tutor."
          : "Diário registrado. O WhatsApp não confirmou o envio.",
      );
      setFile(null);
      setPreview(result.photoUrl);
    });
  }

  if (stays.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhum pet hospedado</CardTitle>
          <CardDescription>
            O diário de bordo só fica disponível após o check-in.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/40">
        <CardTitle className="flex items-center gap-2">
          <PawPrint className="h-5 w-5 text-primary" />
          Enviar diário no WhatsApp
        </CardTitle>
        <CardDescription>
          Tire uma foto, escolha um status rápido e avise o tutor na hora.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pet">Pet hospedado</Label>
            <select
              id="pet"
              value={bookingId}
              onChange={(event) => setBookingId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {stays.map((stay) => (
                <option key={stay.bookingId} value={stay.bookingId}>
                  {stay.petName} · {stay.tutorName}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-muted-foreground">
                {SPECIES_LABELS[selected.species as keyof typeof SPECIES_LABELS] ??
                  selected.species}{" "}
                · WhatsApp {selected.tutorPhone}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Status rápido</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_STATUS_NOTES.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => setStatusNote(note)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    statusNote === note
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  }`}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Subir foto
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => onFileChange(event.target.files?.[0])}
              />
              <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">
                <Camera className="h-4 w-4" />
                Tirar foto
              </span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => onFileChange(event.target.files?.[0])}
            />
          </div>

          <Button onClick={handleSubmit} disabled={isPending} className="w-full sm:w-auto">
            <Send className="h-4 w-4" />
            {isPending ? "Enviando..." : "Enviar Diário no WhatsApp"}
          </Button>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-md bg-accent/10 px-3 py-2 text-sm text-accent">
              {message}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Prévia do diário"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Camera className="h-8 w-8" />
                <span className="text-sm">Prévia da foto</span>
              </div>
            )}
          </div>
          {selected?.recentLogs[0] && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">Último envio</span>
                <Badge variant={selected.recentLogs[0].sentToWhatsApp ? "success" : "warning"}>
                  {selected.recentLogs[0].sentToWhatsApp ? "WhatsApp" : "Pendente"}
                </Badge>
              </div>
              <p className="text-muted-foreground">{selected.recentLogs[0].statusNote}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
