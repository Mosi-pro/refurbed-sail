/** Operator-specific settings. Nothing here is invented: unset values hide the related UI. */
export const site = {
  name: "REFURBED SAIL",
  slogan: "Buy better. Sail further.",
  instagramUrl: (import.meta.env.VITE_INSTAGRAM_URL as string | undefined) || "https://www.instagram.com/",
  contactEmail: (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) || "",
};
