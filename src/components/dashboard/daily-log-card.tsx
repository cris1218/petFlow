"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Camera, Clock, PawPrint, Send, Upload } from "lucide-react";
import {
  createDailyLog,
  removeQueuedDailyLog,
  sendQueuedDailyLog,
} from "@/actions/daily-logs";
import { QUICK_STATUS_NOTES, SPECIES_LABELS } from "@/lib/constants";
import { formatDateTime, formatWhatsAppMask } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
};

export type DailyLogQueueItem = {
  id: string;
  photoUrl: string;
  statusNote: string;
  scheduledAt: Date | string;
  petName: string;
};

type DailyLogCardProps = {
  stays: DailyLogStay[];
  queue: DailyLogQueueItem[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTimeValue(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addOneHour(dateKey: string, time: string) {
  const next = new Date(`${dateKey}T${time}:00`);
  next.setHours(next.getHours() + 1);
  return { dateKey: localDateKey(next), time: localTimeValue(next) };
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function QueueCountdown({ scheduledAt }: { scheduledAt: Date | string }) {
  const target = new Date(scheduledAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (now === null) {
    return <span>vai enviar em --:--:--</span>;
  }

  const remaining = target - now;
  if (remaining <= 0) {
    return <span>enviando agora</span>;
  }

  return (
    <span>
      vai enviar em{" "}
      <span className="tabular-nums">{formatRemaining(remaining)}</span>
    </span>
  );
}

export function DailyLogCard({ stays, queue }: DailyLogCardProps) {
  const [bookingId, setBookingId] = useState(stays[0]?.bookingId ?? "");
  const [statusNote, setStatusNote] = useState("");
  const [scheduledDate, setScheduledDate] = useState(localDateKey);
  const [scheduledTime, setScheduledTime] = useState(localTimeValue);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQueuePending, startQueue] = useTransition();
  const [, startItem] = useTransition();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
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
    const next = addOneHour(scheduledDate, scheduledTime);
    setScheduledDate(next.dateKey);
    setScheduledTime(next.time);
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

  function handleQueue() {
    if (!bookingId || !file) {
      setError("Selecione o pet e uma foto para agendar o diário.");
      return;
    }
    if (!statusNote) {
      setError("Escolha um status rápido.");
      return;
    }

    const formData = new FormData();
    formData.set("bookingId", bookingId);
    formData.set("statusNote", statusNote);
    formData.set("scheduledDate", scheduledDate);
    formData.set("scheduledTime", scheduledTime);
    formData.set(
      "scheduledAt",
      new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString(),
    );
    formData.set("photo", file);

    startQueue(async () => {
      setError(null);
      const result = await createDailyLog(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      success(
        result.sentNow
          ? "Diário enviado no WhatsApp."
          : "Foto na fila, vai sair no horário marcado.",
      );
      resetFormKeepPet();
    });
  }

  function handleSendNow(logId: string) {
    setSendingId(logId);
    startItem(async () => {
      const result = await sendQueuedDailyLog(logId);
      setSendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      success("Diário enviado com sucesso.");
    });
  }

  function handleRemove(logId: string) {
    setRemovingId(logId);
    startItem(async () => {
      const result = await removeQueuedDailyLog(logId);
      setRemovingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      success("Foto retirada da fila.");
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
      <CardContent className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="send-date">Dia do envio</Label>
                <Input
                  id="send-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-time">Horário</Label>
                <Input
                  id="send-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                />
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

            <Button onClick={handleQueue} loading={isQueuePending} className="w-full sm:w-auto">
              <Clock className="h-4 w-4" />
              {isQueuePending ? "Adicionando..." : "Adicionar à fila"}
            </Button>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

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
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Fila de envio</h3>
            <p className="text-xs text-muted-foreground">
              As fotos saem no horário agendado. Use enviar agora se quiser antecipar.
            </p>
          </div>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma foto aguardando envio.</p>
          ) : (
            <div className="space-y-2">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.photoUrl}
                    alt={item.statusNote}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {item.petName} · {item.statusNote}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="warning">Aguardando envio</Badge>
                      <span>Envia {formatDateTime(item.scheduledAt)}</span>
                      <span>
                        <QueueCountdown scheduledAt={item.scheduledAt} />
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      size="sm"
                      loading={sendingId === item.id}
                      disabled={removingId === item.id}
                      onClick={() => handleSendNow(item.id)}
                    >
                      <Send className="h-4 w-4" />
                      Enviar agora
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={removingId === item.id}
                      disabled={sendingId === item.id}
                      onClick={() => handleRemove(item.id)}
                    >
                      {removingId === item.id ? "Tirando..." : "Tirar da fila"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
