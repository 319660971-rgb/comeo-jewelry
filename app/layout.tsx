import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "Hello Jewelry | Stainless Steel Jewelry Wholesale", template: "%s | Hello Jewelry" },
  description: "No-MOQ stainless steel jewelry wholesale, mixed orders and store-ready assortments for retailers worldwide.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><Header /><main>{children}</main><Footer /></body></html>;
}
