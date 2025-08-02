// import { Navbar } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner"

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {/* <div className="h-16">
        <Navbar />
      </div> */}
      <main className="">{children}</main>
      <Toaster richColors position="top-right" />
    </>
  )
}

export default Layout
