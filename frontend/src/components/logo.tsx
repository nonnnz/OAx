import imgUrl1 from "../assets/logo-dark.svg"
import imgUrl2 from "../assets/logo-light.svg"

export const Logo = ({ size = 16 }: { size?: number }) => {
  return (
    <div className="flex items-center space-x-2">
      <img
        src={imgUrl1}
        alt="Logo"
        style={{ height: size, width: "auto" }}
        className="dark:hidden"
      />
      <img
        src={imgUrl2}
        alt="Logo"
        style={{ height: size, width: "auto" }}
        className="hidden dark:block"
      />
    </div>
  )
}
