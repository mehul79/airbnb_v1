"use client"

import { useState, type FormEvent } from "react"
import { IconX } from "@tabler/icons-react"
import { toast } from "sonner"

import { FloatingField } from "@/components/auth/floating-field"
import { Logo } from "@/components/icons/logo"
import { useAppStore } from "@/components/providers/app-store-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field"
import { ApiError, apiPost } from "@/lib/api"
import type { SessionUser } from "@/lib/stores/app-store"

// AUTH-01 (PRD): email/password against FastAPI. One form that toggles between logging in
// (email + password) and signing up (name, age, email, password), like Airbnb's dialog.
type Mode = "login" | "signup"

function AuthFlow() {
  const setUser = useAppStore((s) => s.setUser)
  const close = useAppStore((s) => s.closeAuthDialog)

  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const signup = mode === "signup"

  const switchMode = () => {
    setErrors({})
    setMode(signup ? "login" : "signup")
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setErrors({})
    try {
      const user = signup
        ? await apiPost<SessionUser>("/auth/signup", { email, password, display_name: name, age: Number(age) })
        : await apiPost<SessionUser>("/auth/signin", { email, password })
      setUser(user)
      close()
      toast(signup ? `Welcome to Airbnb, ${user.display_name}` : `Welcome back, ${user.display_name}`)
    } catch (err) {
      if (err instanceof ApiError) {
        // Field-level errors when the API names them, otherwise one message under the form.
        setErrors(Object.keys(err.fields).length ? err.fields : { form: err.message })
      } else {
        setErrors({ form: "Something went wrong. Please try again." })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="mt-10 flex flex-col items-center gap-6 text-center">
        <Logo className="size-12" />
        <DialogTitle className="text-[26px] leading-8 font-semibold text-ink">
          {signup ? "Sign up" : "Log in"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {signup ? "Create an account with your name, age, email and a password." : "Log in with your email and password."}
        </DialogDescription>
      </div>

      {/* key remounts the form on mode change so autoFocus lands on the first field */}
      <form key={mode} className="mt-2 flex flex-col gap-4" onSubmit={submit} noValidate>
        <FieldGroup className="gap-3">
          {signup && (
            <>
              <Field data-invalid={!!errors.display_name}>
                <FloatingField
                  label="Name"
                  autoComplete="name"
                  autoFocus
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  invalid={!!errors.display_name}
                />
                <FieldError>{errors.display_name}</FieldError>
              </Field>
              <Field data-invalid={!!errors.age}>
                <FloatingField
                  label="Age"
                  type="number"
                  inputMode="numeric"
                  min={18}
                  max={120}
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  invalid={!!errors.age}
                />
                {errors.age ? (
                  <FieldError>{errors.age}</FieldError>
                ) : (
                  <FieldDescription>You must be at least 18 to sign up.</FieldDescription>
                )}
              </Field>
            </>
          )}

          <Field data-invalid={!!errors.email}>
            <FloatingField
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus={!signup}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!errors.email}
            />
            <FieldError>{errors.email}</FieldError>
          </Field>

          <Field data-invalid={!!errors.password}>
            <FloatingField
              label="Password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={signup ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!errors.password}
            />
            {errors.password ? (
              <FieldError>{errors.password}</FieldError>
            ) : (
              signup && <FieldDescription>At least 8 characters.</FieldDescription>
            )}
          </Field>

          {errors.form && <FieldError>{errors.form}</FieldError>}
        </FieldGroup>

        {signup && (
          <p className="text-xs text-ink">
            By selecting <strong>Agree and continue</strong>, you agree to the Terms of Service and acknowledge the
            Privacy Policy.
          </p>
        )}

        <Button type="submit" variant="auth" size="lg" className="w-full" disabled={pending}>
          {signup ? "Agree and continue" : "Log in"}
        </Button>
      </form>

      <p className="text-center text-sm text-ink">
        {signup ? "Already have an account?" : "Don\u2019t have an account?"}{" "}
        <button type="button" className="font-semibold underline" onClick={switchMode}>
          {signup ? "Log in" : "Sign up"}
        </button>
      </p>
    </>
  )
}

export function AuthDialog() {
  const open = useAppStore((s) => s.authDialogOpen)
  const close = useAppStore((s) => s.closeAuthDialog)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {/* Radix unmounts the content on close, so AuthFlow's state resets each time. */}
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] max-w-[480px] gap-6 overflow-y-auto rounded-[32px] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.1)] ring-0 sm:max-w-[480px]"
      >
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 size-8 rounded-full" aria-label="Close">
            <IconX className="size-4" />
          </Button>
        </DialogClose>
        <AuthFlow />
      </DialogContent>
    </Dialog>
  )
}
