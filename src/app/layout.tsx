import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider, themeScript } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "CampuSpend — AI expense tracker for college students",
    template: "%s · CampuSpend",
  },
  description:
    "Track UPI and cash spending in plain language. Say “chai 20 yesterday” and CampuSpend files it, categorises it and shows you where your money goes.",
  applicationName: "CampuSpend",
  keywords: ["expense tracker", "student budget", "UPI", "cash", "India", "AI", "money manager"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08090f" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <head>
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
      </head>
      <body className="min-h-full font-sans antialiased">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
