import { useEffect, useState } from "react"
import liff from "@line/liff"

interface JWTPayload {
  name: string
  picture: string
  statusMessage: string
  userId: string
  email: string
}

function HomePage() {
  const [profile, setProfile] = useState<JWTPayload | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    liff
      .init({ liffId: import.meta.env.VITE_LIFF_ID }) // Use VITE_ for environment variables in Vite
      .then(() => {
        if (liff.isLoggedIn()) {
          // liff.getProfile().then((profile) => {
          //   setProfile(profile);
          // });
          const idToken = liff.getDecodedIDToken()
          console.log(idToken) // print decoded idToken object
          setProfile(idToken as JWTPayload)
        } else {
          liff.login()
        }
        const accessToken = liff.getAccessToken()
        console.log(accessToken)
      })
      .catch((err) => console.error("LIFF Initialization failed", err))
    try {
      console.log(liff.getAppLanguage())
      console.log(liff.getVersion())
      // console.log(liff.isInClient());
      console.log(liff.getOS())
      console.log(liff.getLineVersion())
    } catch (error) {
      console.log(error)
    }
  }, [])

  function getProfile() {
    console.log(profile)
    const accessToken = liff.getAccessToken()
    console.log(accessToken)
    setMessage(accessToken || "No access token")
  }

  function hangleLogout() {
    liff.logout()
  }

  return (
    <div>
      <h1>Welcome to LIFF App</h1>
      <h1 className="text-3xl font-bold underline">สวัสดี!</h1>

      {profile ? (
        <div className="flex flex-col items-center gap-2">
          <img className="logo react" src={profile.picture} alt="Profile" />
          <p>Name: {profile.name}</p>
          <p>Status message: {profile.statusMessage}</p>
          <p>User ID: {profile.userId}</p>
          <p>Email: {profile.email}</p>
          <button className="p-4 pt-2" onClick={getProfile}>
            Get Profile
          </button>
          <button onClick={hangleLogout}>Logout</button>
          <textarea
            id="message"
            rows={10}
            className="mt-2 block w-full rounded-lg border-2 border-gray-600 bg-gray-50 text-sm text-gray-900 focus:border-indigo-500 focus:outline-2 focus:outline-offset-2 focus:outline-violet-500"
            value={"Bearer " + message}
          ></textarea>
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  )
}

export default HomePage
