import { useCallback, useId, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  ImageIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
} as const;

const ACCEPT_ATTR = Object.values(ACCEPTED).flat().join(",");
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

type Status = "queued" | "uploading" | "success" | "error";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: Status;
  error?: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function FileTypeIcon({ file }: { file: File }) {
  const isPdf = file.type === "application/pdf";
  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
        isPdf
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary",
      )}
      aria-hidden="true"
    >
      {isPdf ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
    </div>
  );
}

function validate(file: File): string | null {
  const okType = (Object.keys(ACCEPTED) as string[]).includes(file.type);
  if (!okType) return "Unsupported format. Use PDF, JPG, PNG or WEBP.";
  if (file.size > MAX_SIZE) return "File exceeds the 20 MB limit.";
  return null;
}

export function FileUpload() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (!incoming.length) return;
    setGlobalError(null);
    const next: UploadItem[] = [];
    const errors: string[] = [];
    for (const file of incoming) {
      const err = validate(file);
      if (err) {
        errors.push(`${file.name}: ${err}`);
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        status: "queued",
      });
    }
    if (errors.length) setGlobalError(errors.join(" "));
    if (next.length) setItems((prev) => [...prev, ...next]);
  }, []);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items?.length) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const onBrowse = () => inputRef.current?.click();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onBrowse();
    }
  };

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const simulateUpload = (id: string) =>
    new Promise<void>((resolve) => {
      const tick = () => {
        setItems((prev) => {
          const idx = prev.findIndex((i) => i.id === id);
          if (idx === -1) return prev;
          const current = prev[idx];
          if (current.status !== "uploading") return prev;
          const inc = Math.random() * 18 + 6;
          const nextProgress = Math.min(100, current.progress + inc);
          const done = nextProgress >= 100;
          const updated: UploadItem = {
            ...current,
            progress: nextProgress,
            status: done ? "success" : "uploading",
          };
          const copy = [...prev];
          copy[idx] = updated;
          if (done) setTimeout(resolve, 0);
          else setTimeout(tick, 220);
          return copy;
        });
      };
      tick();
    });

  const uploadAll = async () => {
    const queued = items.filter((i) => i.status === "queued");
    if (!queued.length) return;
    setItems((prev) =>
      prev.map((i) =>
        i.status === "queued" ? { ...i, status: "uploading", progress: 4 } : i,
      ),
    );
    await Promise.all(queued.map((i) => simulateUpload(i.id)));
  };

  const hasQueued = items.some((i) => i.status === "queued");
  const isUploading = items.some((i) => i.status === "uploading");
  const allDone = items.length > 0 && items.every((i) => i.status === "success");

  return (
    <section
      className="w-full max-w-2xl mx-auto"
      aria-label="File upload"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 sm:p-8 backdrop-blur-xl",
          "shadow-[var(--shadow-soft)] transition-all duration-300",
        )}
        style={{ background: "var(--gradient-surface)" }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload files: drag and drop here or press Enter to browse"
          aria-describedby={`${inputId}-hint`}
          onClick={onBrowse}
          onKeyDown={onKeyDown}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={cn(
            "group relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-12 sm:py-16 text-center cursor-pointer",
            "transition-all duration-300 outline-none",
            "focus-visible:ring-4 focus-visible:ring-ring/30",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01] shadow-[var(--shadow-glow)]"
              : "border-border hover:border-primary/60 hover:bg-primary/[0.03]",
          )}
        >
          <div
            className={cn(
              "relative flex h-20 w-20 items-center justify-center rounded-2xl transition-transform duration-300",
              "group-hover:-translate-y-1",
              isDragging && "-translate-y-1 scale-110",
            )}
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
            aria-hidden="true"
          >
            <UploadCloud className="h-9 w-9 text-primary-foreground" />
            <span
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ boxShadow: "var(--shadow-glow)" }}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              Drag &amp; Drop your files here
            </p>
            <p id={`${inputId}-hint`} className="text-sm text-muted-foreground">
              or{" "}
              <span className="font-medium text-primary underline-offset-4 group-hover:underline">
                click to browse
              </span>{" "}
              · PDF, JPG, PNG, WEBP up to 20 MB
            </p>
          </div>

          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {globalError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive animate-fade-in"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {items.length > 0 && (
          <ul className="mt-6 space-y-3" aria-label="Selected files">
            {items.map((item) => (
              <li
                key={item.id}
                className="group/item flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-3 sm:p-4 backdrop-blur-sm transition-all hover:border-border animate-fade-in"
              >
                <FileTypeIcon file={item.file} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.file.name}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatSize(item.file.size)}
                    </span>
                  </div>

                  {item.status === "uploading" && (
                    <div className="mt-2 space-y-1">
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(item.progress)}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${item.progress}%`,
                            background: "var(--gradient-primary)",
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Uploading… {Math.round(item.progress)}%
                      </p>
                    </div>
                  )}

                  {item.status === "queued" && (
                    <p className="mt-1 text-xs text-muted-foreground">Ready to upload</p>
                  )}

                  {item.status === "success" && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Uploaded successfully
                    </p>
                  )}

                  {item.status === "error" && item.error && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {item.error}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={item.status === "uploading"}
                  aria-label={`Remove ${item.file.name}`}
                  className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {items.length === 0
              ? "No files selected"
              : allDone
                ? `All ${items.length} file${items.length > 1 ? "s" : ""} uploaded`
                : `${items.length} file${items.length > 1 ? "s" : ""} selected`}
          </p>
          <Button
            type="button"
            size="lg"
            onClick={uploadAll}
            disabled={!hasQueued || isUploading}
            className="relative h-12 rounded-xl px-6 text-sm font-semibold text-primary-foreground border-0 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)] disabled:hover:translate-y-0"
            style={{
              background: "var(--gradient-primary)",
              boxShadow: "var(--shadow-elegant)",
            }}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : allDone ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Done
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Upload Files
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default FileUpload;