import { Header } from "@/components/layout/header"

export default function CompactLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header variant="compact" />
      {children}
    </>
  )
}
