import { createFileRoute } from "@tanstack/react-router";
import { FileUpload } from "@/components/file-upload";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Upload — Premium File Uploader" },
      { name: "description", content: "A premium drag-and-drop file uploader for PDF and images." },
      { property: "og:title", content: "Upload — Premium File Uploader" },
      { property: "og:description", content: "A premium drag-and-drop file uploader for PDF and images." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main
      className="relative flex min-h-dvh items-start justify-center px-4 py-12 sm:py-16"
      style={{ backgroundImage: "var(--gradient-mesh)" }}
    >
      <div className="absolute inset-0 -z-10 bg-background" />
      <div className="w-full max-w-3xl">
        <header className="mb-8">
          <span className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Invoice Intelligence
          </span>
          <h1 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Upload an invoice to extract data
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Drop a PDF or image. We'll parse the document and return structured invoice fields.
          </p>
        </header>
        <FileUpload />
      </div>
    </main>
  );
}
