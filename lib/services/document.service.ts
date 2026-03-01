import { createHash, randomUUID } from "node:crypto";
import {
  DocumentsRepository,
  SupabaseDocumentsRepository,
} from "@/lib/core/booking-lifecycle.repository";
import { SupabaseRestClient } from "@/lib/core/supabase-rest";
import { DocumentType, GenerateDocumentInput, TosDocument } from "@/types/tos";

interface DocumentServiceDeps {
  documentsRepository: DocumentsRepository;
  storageClient: SupabaseRestClient;
}

const DEFAULT_BUCKET = "documents";

function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function buildPseudoPdfContent(type: DocumentType, payload: Record<string, unknown>): string {
  const header = `YONO DMC - ${type.toUpperCase()}`;
  const generatedAt = new Date().toISOString();
  return `${header}\nGenerated At: ${generatedAt}\n\n${JSON.stringify(payload, null, 2)}\n`;
}

function resolveDeps(deps?: Partial<DocumentServiceDeps>): DocumentServiceDeps {
  return {
    documentsRepository: deps?.documentsRepository ?? new SupabaseDocumentsRepository(),
    storageClient: deps?.storageClient ?? new SupabaseRestClient(),
  };
}

async function findExistingDocument(
  storageClient: SupabaseRestClient,
  bookingId: string,
  type: DocumentType
): Promise<TosDocument | null> {
  try {
    return await storageClient.selectSingle<TosDocument>(
      "documents",
      new URLSearchParams({
        select: "*",
        booking_id: `eq.${bookingId}`,
        type: `eq.${type}`,
        order: "created_at.desc",
        limit: "1",
      })
    );
  } catch {
    return null;
  }
}

async function generateDocument(
  input: GenerateDocumentInput,
  deps?: Partial<DocumentServiceDeps>
): Promise<TosDocument> {
  const { documentsRepository, storageClient } = resolveDeps(deps);
  const existing = await findExistingDocument(storageClient, input.bookingId, input.type);
  if (existing) {
    return existing;
  }

  const documentId = randomUUID();
  const filePrefix = input.fileNamePrefix ?? input.type;
  const fileName = `${filePrefix}-${documentId}.pdf`;
  const objectPath = `${input.bookingId}/${input.type}/${fileName}`;

  const content = buildPseudoPdfContent(input.type, {
    bookingId: input.bookingId,
    ...input.payload,
  });

  await storageClient.uploadFile(
    DEFAULT_BUCKET,
    objectPath,
    content,
    "application/pdf"
  );

  return documentsRepository.createDocument({
    id: documentId,
    booking_id: input.bookingId,
    customer_id: input.customerId ?? null,
    type: input.type,
    status: "uploaded",
    version: 1,
    storage_bucket: DEFAULT_BUCKET,
    storage_path: objectPath,
    public_url: storageClient.publicUrl(DEFAULT_BUCKET, objectPath),
    mime_type: "application/pdf",
    checksum: checksum(content),
    generated_by: input.generatedBy ?? null,
    generated_at: new Date().toISOString(),
    metadata: input.payload,
  });
}

export async function generateInvoicePdf(
  input: Omit<GenerateDocumentInput, "type">
): Promise<TosDocument> {
  return generateDocument({ ...input, type: "invoice", fileNamePrefix: "invoice" });
}

export async function generateVoucherPdf(
  input: Omit<GenerateDocumentInput, "type">
): Promise<TosDocument> {
  return generateDocument({ ...input, type: "voucher", fileNamePrefix: "voucher" });
}

export async function generateItineraryPdf(
  input: Omit<GenerateDocumentInput, "type">
): Promise<TosDocument> {
  return generateDocument({ ...input, type: "itinerary", fileNamePrefix: "itinerary" });
}
