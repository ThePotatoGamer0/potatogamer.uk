import bluesky from "simple-icons/icons/bluesky.svg?raw";
import discord from "simple-icons/icons/discord.svg?raw";
import facebook from "simple-icons/icons/facebook.svg?raw";
import github from "simple-icons/icons/github.svg?raw";
import instagram from "simple-icons/icons/instagram.svg?raw";
import kick from "simple-icons/icons/kick.svg?raw";
import kofi from "simple-icons/icons/kofi.svg?raw";
import mastodon from "simple-icons/icons/mastodon.svg?raw";
import patreon from "simple-icons/icons/patreon.svg?raw";
import pinterest from "simple-icons/icons/pinterest.svg?raw";
import reddit from "simple-icons/icons/reddit.svg?raw";
import snapchat from "simple-icons/icons/snapchat.svg?raw";
import soundcloud from "simple-icons/icons/soundcloud.svg?raw";
import spotify from "simple-icons/icons/spotify.svg?raw";
import steam from "simple-icons/icons/steam.svg?raw";
import telegram from "simple-icons/icons/telegram.svg?raw";
import threads from "simple-icons/icons/threads.svg?raw";
import tiktok from "simple-icons/icons/tiktok.svg?raw";
import tumblr from "simple-icons/icons/tumblr.svg?raw";
import twitch from "simple-icons/icons/twitch.svg?raw";
import whatsapp from "simple-icons/icons/whatsapp.svg?raw";
import x from "simple-icons/icons/x.svg?raw";
import youtube from "simple-icons/icons/youtube.svg?raw";
import type { IconName } from "../../shared/site";

const STROKE: ReadonlySet<string> = new Set(["link", "mail"]);

function iconPath(svg: string): string {
  const match = /d="([^"]+)"/.exec(svg);
  if (!match?.[1]) throw new Error("Simple Icon is missing a path");
  return match[1];
}

export function Icon({ name }: { name: IconName | string }) {
  const path = PATHS[name as IconName] ?? PATHS.link;
  return (
    <svg className={STROKE.has(name) ? "icon stroke" : "icon"} viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const PATHS: Record<IconName, string> = {
  discord: iconPath(discord),
  github: iconPath(github),
  youtube: iconPath(youtube),
  twitch: iconPath(twitch),
  kick: iconPath(kick),
  instagram: iconPath(instagram),
  facebook: iconPath(facebook),
  x: iconPath(x),
  tiktok: iconPath(tiktok),
  threads: iconPath(threads),
  bluesky: iconPath(bluesky),
  mastodon: iconPath(mastodon),
  reddit: iconPath(reddit),
  telegram: iconPath(telegram),
  whatsapp: iconPath(whatsapp),
  snapchat: iconPath(snapchat),
  pinterest: iconPath(pinterest),
  tumblr: iconPath(tumblr),
  steam: iconPath(steam),
  spotify: iconPath(spotify),
  soundcloud: iconPath(soundcloud),
  patreon: iconPath(patreon),
  kofi: iconPath(kofi),
  link: "M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1",
  mail: "M3 5h18v14H3V5zm0 0 9 7 9-7",
};
