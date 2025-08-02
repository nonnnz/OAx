import { create } from "zustand"
import liff from "@line/liff"

interface Profile {
  displayName: string
  userId: string
  picture: string
}

interface LiffState {
  accessToken: any | null
  isLoggedIn: boolean
  profile: Profile | null
  initializeLiff: () => Promise<void>
  login: () => void
  logout: () => void
}

interface JWTPayload {
  iss?: string
  sub?: string
  aud?: string
  exp?: number
  iat?: number
  auth_time?: number
  nonce?: string
  amr?: string[]
  name?: string
  picture?: string
  email?: string
}

export const useLiffStore = create<LiffState>((set) => ({
  accessToken: null,
  isLoggedIn: false,
  profile: null,
  initializeLiff: async () => {
    try {
      console.log("init")
      await liff.init({ liffId: import.meta.env.VITE_LIFF_ID })
      if (liff.isLoggedIn()) {
        console.log("logged in")
        const accessToken = liff.getAccessToken()
        console.log(accessToken)
        const profileToken = liff.getDecodedIDToken() as JWTPayload
        console.log(profileToken) // print decoded idToken object
        set({
          accessToken,
          isLoggedIn: true,
          profile: {
            displayName: profileToken?.name,
            userId: profileToken.sub,
            picture: profileToken?.picture,
          } as Profile,
        })
      } else {
        console.log("not logged in")
        liff.login()
        // set({ isLoggedIn: false })
      }
    } catch (error) {
      console.error("LIFF Initialization failed:", error)
      set({ isLoggedIn: false })
    }
  },
  login: () => {
    liff.login()
  },
  logout: () => {
    liff.logout()
    set({ accessToken: null, isLoggedIn: false })
  },
}))
