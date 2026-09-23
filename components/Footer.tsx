import Image from "next/image"
import { FooterMenu } from "./FooterMenu"
export function Logo({ className = 'h-8 w-8 text-black/40 relative' }: { className?: string }) {
  return (
	<div className={className}>
		<Image src={"/logo.png"} alt="C" fill={true} />
	</div>
  )
}

export function Footer() {
  return (
    <footer className="w-full px-6 py-6">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-x-4 gap-y-3 text-xs text-black/35 uppercase">
        <span className="flex items-start gap-1 text-black/60">
          <Logo />
          <span className="max-w-md normal-case tracking-normal text-black/40">
            <span className="block font-bold uppercase">Coven</span>
            ARC Trading Infrastructure
          </span>
        </span>
        <FooterMenu />
      </div>
    </footer>
  )
}
