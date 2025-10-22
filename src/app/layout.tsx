import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import '@xyflow/react/dist/style.css'
import { AuthProvider } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NbS LLM",
  description: "AI experimental of Data Lab Indonesia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} antialiased`}>
        <AuthProvider>
          <Header />
          <Toaster />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
