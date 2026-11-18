import { useEffect, useState } from "react";

export function InterestImage({ src, className = "interest-shot" }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return null;

  return (
    <img
      className={className}
      src={src}
      alt=""
      width={72}
      height={72}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
