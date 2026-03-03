import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50">
      <div className="w-full max-w-md p-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Welcome to AgentLink</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to manage your AI agents
          </p>
        </div>
        <SignIn 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-lg",
            }
          }}
        />
      </div>
    </div>
  )
}
