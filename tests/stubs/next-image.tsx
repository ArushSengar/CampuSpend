import type { ImgHTMLAttributes } from "react";

/** next/image without the optimiser. */
export default function Image(props: ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} />;
}
