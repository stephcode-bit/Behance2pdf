export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function truncateMiddle(s: string, max = 70): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(s.length - half)}`;
}

export function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 3 && parts[1] === "gallery") {
      const slug = parts[2].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return slug;
    }
    return parts.map((p) => p.replace(/-/g, " ")).join(" — ") || u.hostname;
  } catch {
    return url;
  }
}
