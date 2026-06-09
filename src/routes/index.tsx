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
      className="relative flex min-h-dvh items-center justify-center px-4 py-12 sm:py-20"
      style={{ backgroundImage: "var(--gradient-mesh)" }}
    >
      <div className="absolute inset-0 -z-10 bg-background" />
      <div className="w-full max-w-2xl">
        <header className="mb-10 text-center">
          <span className="inline-flex items-center rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-md">
            Premium uploader
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            Upload your files
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Securely upload PDFs and images with elegant feedback.
          </p>
        </header>
        <FileUpload />
      </div>
    </main>
  );
}
