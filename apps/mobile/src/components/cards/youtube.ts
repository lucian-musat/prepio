/** Props shared by the native (WebView) and web (iframe) players. */
export type YouTubePlayerProps = {
  videoId: string;
  start: number | null;
  end: number | null;
  /** Starts muted (the only way autoplay is allowed); turning it false unmutes the running player. */
  muted: boolean;
  onError: () => void;
};

export const thumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
