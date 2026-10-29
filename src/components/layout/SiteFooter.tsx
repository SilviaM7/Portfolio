import { site } from '@/config/site';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <p className="max-w-prose">
          All datasets, figures, and conclusions in the projects are <strong className="text-foreground">synthetic demonstrations</strong> created to show analytical methods. They are not real company data
          and not empirical findings. No analytics or tracking scripts are used on this site.
        </p>
        <p className="mt-3">© {new Date().getFullYear()} {site.name}</p>
      </div>
    </footer>
  );
}
