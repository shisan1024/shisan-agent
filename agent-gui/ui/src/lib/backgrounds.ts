// Shared registry of pet background gifs, used by both the main pet window
// (App.tsx) and the chat window (ChatWindow.tsx) so gif keys stay consistent
// across webviews.
export const GIF_CHANGED_EVENT = "gif-changed";

export const backgrounds = import.meta.glob("../assets/background/*.gif", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const backgroundKeys = Object.keys(backgrounds);

export const INITIAL_KEY = "../assets/background/angelina_ride.gif";

export const INITIAL_URL =
  backgrounds[INITIAL_KEY] ??
  (backgroundKeys[0] ? backgrounds[backgroundKeys[0]] : "");

export function resolveBackground(key: string | null | undefined): string {
  if (key && backgrounds[key]) {
    return backgrounds[key];
  }
  return INITIAL_URL;
}
