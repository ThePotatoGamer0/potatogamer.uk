import { useState } from "react";
import { avatarUrl, decorationUrl, defaultAvatarUrl } from "../lib/discord";
import type { DiscordStatus, DiscordUser } from "../lib/lanyard";

export function Avatar({
  user,
  status,
  size = "lg",
}: {
  user: DiscordUser;
  status?: DiscordStatus;
  size?: "lg" | "sm";
}) {
  const [src, setSrc] = useState(() => avatarUrl(user, size === "lg" ? 256 : 128));
  const decoration = user.avatar_decoration_data?.asset;

  return (
    <div className={`avatar-stack ${size}${decoration ? " decorated" : ""}`}>
      <img
        className="avatar"
        src={src}
        alt=""
        width={size === "lg" ? 84 : 44}
        height={size === "lg" ? 84 : 44}
        fetchPriority={size === "lg" ? "high" : "auto"}
        onError={() => setSrc(defaultAvatarUrl(user.id))}
      />
      {decoration ? <img className="decoration" src={decorationUrl(decoration)} alt="" /> : null}
      {status ? <span className={`status-dot ${status}`} title={status} /> : null}
    </div>
  );
}
