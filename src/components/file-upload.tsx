import { useCallback, useId, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
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

interface UploadItem {
  id: string;
  file: File;
  status: Status;
  error?: string;
  rawData?: Record<string, any>;
}

function cleanStringValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && !Array.isArray(val)) return JSON.stringify(val);
  let str = String(val).trim();
  while (str.startsWith("|") || str.endsWith("|")) {
    if (str.startsWith("|")) str = str.substring(1).trim();
    if (str.endsWith("|")) str = str.substring(0, str.length - 1).trim();
  }
  return str;
}

function validate(file: File): string | null {
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  const allowedExtensions = Object.values(ACCEPTED).flat();
  if (!allowedExtensions.includes(extension as any)) return "Unsupported file type.";
  if (file.size > MAX_SIZE) return "File exceeds maximum 20MB payload boundary.";
  return null;
}

function normalizeKeyStr(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deepFindInvoiceData(root: any): Record<string, any> {
  const extracted: Record<string, any> = {};
  const lineItemsPool: any[][] = [];

  function traverse(current: any) {
    if (!current || typeof current !== "object") return;
    if (Array.isArray(current)) { current.forEach(item => traverse(item)); return; }
    if (Array.isArray(current.line_items) || Array.isArray(current.lineItems)) {
      lineItemsPool.push(current.line_items || current.lineItems);
    }
    Object.entries(current).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        if (typeof val === "object" && !Array.isArray(val)) {
          traverse(val);
        } else if (!Array.isArray(val)) {
          const cleanKey = normalizeKeyStr(key);
          if (extracted[cleanKey] === undefined) extracted[cleanKey] = val;
        }
      }
    });
  }

  traverse(root);
  if (lineItemsPool.length > 0) extracted["line_items"] = lineItemsPool[0];
  return extracted;
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
      if (err) { errors.push(`${file.name}: ${err}`); continue; }
      next.push({ id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`, file, status: "queued" });
    }
    if (errors.length) setGlobalError(errors.join(" "));
    if (next.length) setItems(next);
  }, []);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items?.length) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); }
  };

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const processOne = async (item: UploadItem) => {
    updateItem(item.id, { status: "uploading", error: undefined });
    await new Promise((resolve) => setTimeout(resolve, 300));
    updateItem(item.id, { status: "extracting" });

    try {
      const formData = new FormData();
      formData.append("file", item.file);

      const response = await fetch("https://smeet.app.n8n.cloud/webhook/extract-invoice", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
      const rawJson = await response.json();

      const harvestedFields = deepFindInvoiceData(rawJson);
      Object.keys(harvestedFields).forEach(key => {
        if (!Array.isArray(harvestedFields[key])) {
          harvestedFields[key] = cleanStringValue(harvestedFields[key]);
        }
      });

      updateItem(item.id, { status: "success", rawData: harvestedFields });
    } catch (e) {
      console.error(e);
      updateItem(item.id, {
        status: "error",
        error: e instanceof Error ? e.message : "Extraction failed.",
      });
    }
  };

  const processAll = async () => {
    const queued = items.filter((i) => i.status === "queued" || i.status === "error");
    if (!queued.length) return;
    await Promise.all(queued.map(processOne));
  };

  return (
    <section className="w-full max-w-5xl mx-auto p-4 space-y-6">
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Invoice Processing Control Center</h2>
          </div>
        </div>

        <div className="p-5">
          <div
            role="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-10 text-center cursor-pointer transition-colors",
              isDragging ? "border-primary bg-accent/60" : "border-border hover:border-muted-foreground/40 hover:bg-muted/40"
            )}
          >
            <UploadCloud className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Click or drag source documents here to extract form values</p>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          {globalError && (
            <p className="mt-3 text-xs font-medium text-destructive">{globalError}</p>
          )}

          {items.length > 0 && (
            <ul className="mt-5 space-y-2">
              {items.map((item) => (
                <li key={item.id} className="rounded-md border border-border p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-medium text-foreground truncate">{item.file.name}</p>
                      <StatusLine item={item} />
                    </div>
                  </div>
                  <button type="button" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">{items.length} file(s) selected</span>
          <Button size="sm" onClick={processAll} disabled={items.some((i) => i.status === "uploading" || i.status === "extracting")}>
            Invoice Extraction
          </Button>
        </div>
      </div>

      <ResultsPanel items={items} />
    </section>
  );
}

function StatusLine({ item }: { item: UploadItem }) {
  if (item.status === "extracting" || item.status === "uploading") return <p className="text-xs text-muted-foreground animate-pulse">Running data recognition processes...</p>;
  if (item.status === "success") return <p className="text-xs text-emerald-600 font-medium">Completed Successfully</p>;
  if (item.status === "error") return <p className="text-xs text-destructive truncate">{item.error}</p>;
  return <p className="text-xs text-muted-foreground">Queued</p>;
}

function ResultsPanel({ items }: { items: UploadItem[] }) {
  const finished = items.filter((i) => i.status === "success" && i.rawData);
  if (!finished.length) return null;

  return (
    <div className="space-y-6">
      {finished.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {item.file.name}
            </h3>
          </div>
          <DynamicInvoiceView data={item.rawData!} />
        </div>
      ))}
    </div>
  );
}

function DynamicInvoiceView({ data }: { data: Record<string, any> }) {
  const { line_items, ...fields } = data;
  const entries = Object.entries(fields).filter(([, v]) => v !== "" && v !== null && v !== undefined);

  return (
    <div className="space-y-4">
      {entries.length > 0 && (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {entries.map(([key, value]) => (
            <div key={key} className="border-b border-muted/40 pb-2">
              <dt className="text-[11px] font-semibold text-muted-foreground/90 uppercase tracking-wider">
                {key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")}
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">{cleanStringValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {Array.isArray(line_items) && line_items.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden bg-card shadow-sm">
          <div className="bg-muted/50 px-4 py-2.5 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Line Items
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {Object.keys(line_items[0]).map(h => <th key={h} className="px-4 py-2">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {line_items.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/5">
                    {Object.keys(line_items[0]).map(h => (
                      <td key={h} className="px-4 py-2.5 font-medium text-foreground">{cleanStringValue(row[h]) || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
