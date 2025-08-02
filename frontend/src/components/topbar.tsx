import { Link } from "react-router-dom"
import { Logo } from "@/components/logo"
import Component from "@/components/comp-130"

export default function Topbar() {
  return (
    <div className="bg-primary-foreground sticky top-0 z-50 flex h-14 items-center justify-between border-b px-4">
      <Link to="/" className="flex items-center gap-2">
        {/* <ArrowLeft className="h-5 w-5" /> */}
        <Logo size={16} />
      </Link>
      <Component />
    </div>
  )
}
