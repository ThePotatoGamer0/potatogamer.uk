import { useState } from "react";
import { avatarUrl, decorationUrl, defaultAvatarUrl } from "../lib/discord";
import { STATUS_LABEL, type DiscordStatus, type DiscordUser } from "../lib/lanyard";
import { StatusDot } from "./StatusDot";

export function Avatar({
  user,
  status,
  statusTitle,
  size = "lg",
}: {
  user: DiscordUser;
  status?: DiscordStatus;
  statusTitle?: string;
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
      {status ? <StatusDot status={status} label={statusTitle || STATUS_LABEL[status]} /> : null}
    </div>
  );
}
