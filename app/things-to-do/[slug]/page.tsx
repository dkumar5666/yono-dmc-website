import AttractionDetailsPage, {
  generateMetadata as baseGenerateMetadata,
} from "@/app/attractions/[slug]/page";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: Parameters<typeof baseGenerateMetadata>[0]
) {
  return baseGenerateMetadata(props);
}

export default AttractionDetailsPage;
