export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <p>
          Built for designers who want to keep what they love. Not affiliated with Behance or Adobe.
        </p>
        <div className="flex items-center gap-4">
          <a href="#how-it-works" className="hover:text-foreground">How it works</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
          <a
            href="https://www.behance.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Behance ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
