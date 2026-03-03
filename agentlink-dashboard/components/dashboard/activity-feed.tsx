"use client"

import { 
  ArrowRightLeft, 
  Bot, 
  RefreshCw, 
  CheckCircle,
  AlertCircle 
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatRelativeTime } from "@/lib/utils"
import type { ActivityItem } from "@/types"

interface ActivityFeedProps {
  activities: ActivityItem[]
}

const activityIcons: Record<ActivityItem['type'], React.ReactNode> = {
  transaction: <ArrowRightLeft className="h-4 w-4" />,
  agent_created: <Bot className="h-4 w-4" />,
  agent_updated: <RefreshCw className="h-4 w-4" />,
  status_change: <CheckCircle className="h-4 w-4" />,
}

const activityColors: Record<ActivityItem['type'], string> = {
  transaction: "bg-blue-500/10 text-blue-500",
  agent_created: "bg-green-500/10 text-green-500",
  agent_updated: "bg-yellow-500/10 text-yellow-500",
  status_change: "bg-purple-500/10 text-purple-500",
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Latest updates from your agents
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={`rounded-full p-2 ${activityColors[activity.type]}`}>
                {activityIcons[activity.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{activity.title}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {activity.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatRelativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
