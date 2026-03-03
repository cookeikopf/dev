import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryProvider } from "@/components/providers/react-query-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AgentLink Dashboard",
  description: "Manage your AI agents and transactions",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ReactQueryProvider>
            {children}
          </ReactQueryProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
