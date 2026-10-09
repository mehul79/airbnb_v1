import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { AppStoreProvider } from "@/components/providers/app-store-provider";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Inter stands in for Airbnb Cereal VF (DESIGN.md "Note on Font Substitutes").
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Airbnb Clone",
  description: "Stays marketplace built for the fullstack assignment",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        {/* class strategy: next-themes puts .dark on <html>; suppressHydrationWarning is for that. */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <AppStoreProvider>
          <TooltipProvider>
            {children}
            <Footer />
            <AuthDialog />
            <Toaster position="bottom-left" />
          </TooltipProvider>
        </AppStoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
