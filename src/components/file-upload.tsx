import { useCallback, useId, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  ImageIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  FileCheck2,
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
const MAX_SIZE = 20 * 1024 * 1024;

type Status = "queued" | "uploading" | "extracting" | "success" | "error";

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

interface ExtractedInvoice {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  vendor: { name: string; address: string; taxId: string };
  billTo: { name: string; address: string };
  currency: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: Status;
  error?: string;
  data?: ExtractedInvoice;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatMoney(n: number, ccy = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy }).format(n);
}

function FileTypeIcon({ file }: { file: File }) {
  const isPdf = file.type === "application/pdf";
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground"
      aria-hidden="true"
    >
      {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
    </div>
  );
}

function validate(file: File): string | null {
  const okType = (Object.keys(ACCEPTED) as string[]).includes(file.type);
  if (!okType) return "Unsupported format. Use PDF, JPG, PNG or WEBP.";
  if (file.size > MAX_SIZE) return "File exceeds the 20 MB limit.";
  return null;
}

// Demo "API" — simulates an OCR/extraction service call.
// Replace with a real fetch() to your invoice parsing endpoint.
function mockExtract(file: File): Promise<ExtractedInvoice> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // ~10% simulated failure for realistic UX
      if (Math.random() < 0.1) {
        reject(new Error("Extraction service was unable to parse this document."));
        return;
      }
      const seed = file.name.length;
      const items: LineItem[] = [
        { description: "Professional services — Q2", qty: 40, unitPrice: 125, amount: 5000 },
        { description: "Cloud infrastructure", qty: 1, unitPrice: 1240.5, amount: 1240.5 },
        { description: "Support & maintenance", qty: 3, unitPrice: 320, amount: 960 },
      ];
      const subtotal = items.reduce((s, i) => s + i.amount, 0);
      const tax = +(subtotal * 0.085).toFixed(2);
      resolve({
        invoiceNumber: `INV-2026-${1000 + (seed % 9000)}`,
        issueDate: "2026-05-28",
        dueDate: "2026-06-27",
        vendor: {
          name: "Northwind Consulting LLC",
          address: "200 Market Street, Suite 1400, San Francisco, CA 94105",
          taxId: "US-84-2910337",
        },
        billTo: {
          name: "Acme Corporation",
          address: "1 Infinite Loop, Cupertino, CA 95014",
        },
        currency: "USD",
        lineItems: items,
        subtotal,
        tax,
        total: +(subtotal + tax).toFixed(2),
      });
    }, 1100 + Math.random() * 900);
  });
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
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
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

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const runProgress = (id: string) =>
    new Promise<void>((resolve) => {
      const tick = () => {
        let done = false;
        setItems((prev) => {
          const idx = prev.findIndex((i) => i.id === id);
          if (idx === -1) {
            done = true;
            return prev;
          }
          const cur = prev[idx];
          if (cur.status !== "uploading") {
            done = true;
            return prev;
          }
          const inc = Math.random() * 20 + 8;
          const next = Math.min(100, cur.progress + inc);
          done = next >= 100;
          const copy = [...prev];
          copy[idx] = { ...cur, progress: next };
          return copy;
        });
        if (done) resolve();
        else setTimeout(tick, 180);
      };
      tick();
    });

  const processOne = async (item: UploadItem) => {
    updateItem(item.id, { status: "uploading", progress: 4, error: undefined });
    await runProgress(item.id);
    updateItem(item.id, { status: "extracting", progress: 100 });
    try {
      const data = await mockExtract(item.file);
      updateItem(item.id, { status: "success", data });
    } catch (e) {
      updateItem(item.id, {
        status: "error",
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  const processAll = async () => {
    const queued = items.filter((i) => i.status === "queued" || i.status === "error");
    if (!queued.length) return;
    await Promise.all(queued.map(processOne));
  };

  const retry = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (it) void processOne(it);
  };

  const reset = () => {
    setItems([]);
    setGlobalError(null);
  };

  const hasActionable = items.some((i) => i.status === "queued" || i.status === "error");
  const isBusy = items.some((i) => i.status === "uploading" || i.status === "extracting");

  return (
    <section className="w-full" aria-label="Invoice upload">
      <div className="rounded-lg border border-border bg-card shadow-[var(--shadow-soft)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Documents</h2>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={reset}
              disabled={isBusy}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="p-5">
          {/* Dropzone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload invoice: drag and drop or press Enter to browse"
            aria-describedby={`${inputId}-hint`}
            onClick={onBrowse}
            onKeyDown={onKeyDown}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-10 text-center cursor-pointer",
              "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isDragging
                ? "border-primary bg-accent/60"
                : "border-border hover:border-muted-foreground/40 hover:bg-muted/40",
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Drop invoice here or{" "}
                <span className="underline underline-offset-4">browse</span>
              </p>
              <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
                PDF, JPG, PNG, WEBP · up to 20 MB
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
              className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{globalError}</span>
            </div>
          )}

          {items.length > 0 && (
            <ul className="mt-5 space-y-2" aria-label="Uploaded documents">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border border-border bg-background"
                >
                  <div className="flex items-center gap-3 px-3 py-3">
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
                      <div className="mt-1">
                        <StatusLine item={item} />
                      </div>
                      {(item.status === "uploading" || item.status === "extracting") && (
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full bg-primary transition-all duration-200",
                              item.status === "extracting" && "animate-pulse",
                            )}
                            style={{ width: `${item.status === "extracting" ? 100 : item.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {item.status === "error" && (
                        <button
                          type="button"
                          onClick={() => retry(item.id)}
                          aria-label={`Retry ${item.file.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={item.status === "uploading" || item.status === "extracting"}
                        aria-label={`Remove ${item.file.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {items.length === 0
              ? "No documents added"
              : `${items.length} document${items.length > 1 ? "s" : ""} · ${items.filter((i) => i.status === "success").length} extracted`}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={processAll}
            disabled={!hasActionable || isBusy}
            className="h-9 rounded-md px-4 text-xs font-medium"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Processing
              </>
            ) : (
              <>Extract data</>
            )}
          </Button>
        </div>
      </div>

      {/* Results panel */}
      <ResultsPanel items={items} />
    </section>
  );
}

function StatusLine({ item }: { item: UploadItem }) {
  switch (item.status) {
    case "queued":
      return <p className="text-xs text-muted-foreground">Ready · awaiting extraction</p>;
    case "uploading":
      return (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Uploading… {Math.round(item.progress)}%
        </p>
      );
    case "extracting":
      return (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Extracting invoice data…
        </p>
      );
    case "success":
      return (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--success)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Extracted successfully
        </p>
      );
    case "error":
      return (
        <p className="inline-flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {item.error ?? "Extraction failed"}
        </p>
      );
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function ExtractedView({ data }: { data: ExtractedInvoice }) {
  return (
    <div className="border-t border-border bg-muted/30 px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Extracted invoice
        </h3>
        <span className="rounded-sm border border-border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Verified
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Field label="Invoice #" value={data.invoiceNumber} />
        <Field label="Issue date" value={data.issueDate} />
        <Field label="Due date" value={data.dueDate} />
        <Field label="Currency" value={data.currency} />
      </dl>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Vendor
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{data.vendor.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{data.vendor.address}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Tax ID: {data.vendor.taxId}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Bill to
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{data.billTo.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{data.billTo.address}</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((li, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-foreground">{li.description}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{li.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {formatMoney(li.unitPrice, data.currency)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {formatMoney(li.amount, data.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/40">
            <tr>
              <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-muted-foreground">
                Subtotal
              </td>
              <td className="px-3 py-1.5 text-right text-sm tabular-nums text-foreground">
                {formatMoney(data.subtotal, data.currency)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-muted-foreground">
                Tax
              </td>
              <td className="px-3 py-1.5 text-right text-sm tabular-nums text-foreground">
                {formatMoney(data.tax, data.currency)}
              </td>
            </tr>
            <tr className="border-t border-border">
              <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total
              </td>
              <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-foreground">
                {formatMoney(data.total, data.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default FileUpload;