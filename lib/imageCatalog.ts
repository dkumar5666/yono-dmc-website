export const imageCatalog = {
  hero: {
    query: "dubai skyline sunset travel",
    fallback:
      "https://images.unsplash.com/photo-1768069794857-9306ac167c6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920",
  },
  dubai: {
    query: "dubai skyline night",
    fallback:
      "https://images.unsplash.com/photo-1768069794857-9306ac167c6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  bali: {
    query: "bali temple travel",
    fallback:
      "https://images.unsplash.com/photo-1648999637610-a0604610e23f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  singapore: {
    query: "singapore marina bay evening",
    fallback:
      "https://images.unsplash.com/photo-1686455746285-4a921419bc6c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  malaysia: {
    query: "kuala lumpur skyline petronas",
    fallback:
      "https://images.unsplash.com/photo-1706249085166-bc6e8a0691cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  testimonial: {
    query: "happy travelers vacation portrait",
    fallback:
      "https://images.unsplash.com/photo-1614505241347-7f4765c1035e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
} as const;

export type ImageKey = keyof typeof imageCatalog;

export function isImageKey(value: string): value is ImageKey {
  return value in imageCatalog;
}
