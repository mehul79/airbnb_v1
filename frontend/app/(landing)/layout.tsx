import { Header } from "@/components/layout/header"

export default function LandingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header variant="landing" />
      {children}
    </>
  )
}
