"use client"

import { UserProfile } from "@clerk/nextjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <UserProfile 
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none",
                }
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about your agents
                  </p>
                </div>
                <div className="h-6 w-11 rounded-full bg-primary relative cursor-pointer">
                  <div className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Transaction Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified of new transactions
                  </p>
                </div>
                <div className="h-6 w-11 rounded-full bg-primary relative cursor-pointer">
                  <div className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Security Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Important security notifications
                  </p>
                </div>
                <div className="h-6 w-11 rounded-full bg-primary relative cursor-pointer">
                  <div className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium">API Key</p>
                <p className="text-sm text-muted-foreground">
                  Use this key to authenticate API requests
                </p>
                <div className="mt-2 flex gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                    al_test_xxxxxxxxxxxx
                  </code>
                  <button className="text-sm text-primary hover:underline">
                    Regenerate
                  </button>
                </div>
              </div>
              <Separator />
              <div>
                <p className="font-medium">Webhook URL</p>
                <p className="text-sm text-muted-foreground">
                  Receive real-time event notifications
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    type="url"
                    placeholder="https://your-app.com/webhook"
                    className="flex-1 rounded border bg-background px-3 py-2 text-sm"
                  />
                  <button className="text-sm text-primary hover:underline">
                    Save
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
