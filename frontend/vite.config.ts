import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
// import mkcert from "vite-plugin-mkcert"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), "")
  console.log(`VITE_PUBLIC_URL: https://${env.VITE_PUBLIC_URL}`)
  return defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: true,
      port: 5173,
      allowedHosts: ["localhost", "127.0.0.1", env.VITE_PUBLIC_URL || ""],
    },
    // server: {
    //   proxy: {
    //     "/api": {
    //       target: process.env.VITE_API_URL,
    //     },
    //   },
    // },
  })
}
