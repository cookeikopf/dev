import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = auth()
  
  if (!userId) {
    redirect("/sign-in")
  }
  
  return <DashboardShell>{children}</DashboardShell>
}
