"use client";

/** Triggers a file download without navigating the SPA away. */
export function downloadFile(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
