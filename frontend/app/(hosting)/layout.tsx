import { Header } from "@/components/layout/header"

// Hosting screens: the same compact header, in "hosting" mode (its switch says "Switch to travelling").
export default function HostingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header variant="compact" mode="hosting" />
      {children}
    </>
  )
}
