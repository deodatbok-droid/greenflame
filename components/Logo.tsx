import Image from 'next/image'

export default function Logo({
  size = 40,
  variant = 'onDark',
  className = '',
}: {
  size?: number
  variant?: 'onDark' | 'onLight'
  className?: string
}) {
  const src = '/logo-transparent.png'
  return (
    <Image
      src={src}
      alt="GreenFlame"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  )
}
