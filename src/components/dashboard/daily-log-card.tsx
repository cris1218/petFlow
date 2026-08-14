"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, PawPrint, Send, Upload } from "lucide-react";
import { createDailyLog } from "@/actions/daily-logs";
import { QUICK_STATUS_NOTES, SPECIES_LABELS } from "@/lib/constants";
import { formatWhatsAppMask } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useFeedback } from "@/components/app-feedback";

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
  const [statusNote, setStatusNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const { success } = useFeedback();

  const selected = useMemo(
    () => stays.find((stay) => stay.bookingId === bookingId),
    [stays, bookingId],
  );

  function clearPhoto() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function resetFormKeepPet() {
    clearPhoto();
    setStatusNote("");
    setError(null);
  }

  function onFileChange(nextFile: File | undefined) {
    if (!nextFile) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(nextFile);
    previewUrlRef.current = url;
    setFile(nextFile);
    setPreview(url);
    setError(null);
  }

  function handleSubmit() {
    if (!bookingId || !file) {
      setError("Selecione o pet e uma foto para enviar o diário.");
      return;
    }
    if (!statusNote) {
      setError("Escolha um status rápido.");
      return;
    }

    const formData = new FormData();
    formData.set("bookingId", bookingId);
    formData.set("statusNote", statusNote);
    formData.set("photo", file);

    startTransition(async () => {
      setError(null);
      const result = await createDailyLog(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      success(
        result.sentToWhatsApp
          ? "Diário enviado com sucesso."
          : "Diário salvo com sucesso. O WhatsApp não confirmou o envio.",
      );
      resetFormKeepPet();
    });
  }

  if (stays.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhum pet hospedado</CardTitle>
          <CardDescription>
            O diário de bordo só fica disponível após a entrada.
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
      <CardContent className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pet">Pet hospedado</Label>
            <Select value={bookingId} onValueChange={setBookingId}>
              <SelectTrigger id="pet">
                <SelectValue placeholder="Escolha o pet" />
              </SelectTrigger>
              <SelectContent>
                {stays.map((stay) => (
                  <SelectItem key={stay.bookingId} value={stay.bookingId}>
                    {stay.petName} · {stay.tutorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-muted-foreground">
                {SPECIES_LABELS[selected.species as keyof typeof SPECIES_LABELS] ??
                  selected.species}{" "}
                · WhatsApp {formatWhatsAppMask(selected.tutorPhone)}
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
                  className={`min-h-11 rounded-full border px-3 py-1.5 text-sm transition-colors ${
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

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Subir foto
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Tirar foto
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => onFileChange(event.target.files?.[0])}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => onFileChange(event.target.files?.[0])}
            />
          </div>

          <Button onClick={handleSubmit} loading={isPending} className="w-full sm:w-auto">
            <Send className="h-4 w-4" />
            {isPending ? "Enviando..." : "Enviar Diário no WhatsApp"}
          </Button>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
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
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
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
