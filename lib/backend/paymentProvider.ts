import crypto from "node:crypto";
import { PaymentIntentRecord } from "@/lib/backend/types";

export interface PaymentIntentRequest {
  bookingId: string;
  amount: number;
  currency: string;
}

export interface PaymentConfirmationRequest {
  bookingId: string;
  paymentIntent: PaymentIntentRecord;
  providerPaymentId?: string;
}

export interface PaymentProvider {
  createIntent(input: PaymentIntentRequest): Promise<{
    provider: string;
    providerClientSecret?: string;
    providerPaymentId?: string;
  }>;
  confirmPayment(input: PaymentConfirmationRequest): Promise<{
    provider: string;
    providerPaymentId: string;
    status: "succeeded" | "failed";
  }>;
}

class ManualPaymentProvider implements PaymentProvider {
  async createIntent(): Promise<{
    provider: string;
    providerClientSecret?: string;
    providerPaymentId?: string;
  }> {
    return {
      provider: "manual",
      providerClientSecret: `manual_secret_${crypto.randomBytes(10).toString("hex")}`,
    };
  }

  async confirmPayment(input: PaymentConfirmationRequest): Promise<{
    provider: string;
    providerPaymentId: string;
    status: "succeeded" | "failed";
  }> {
    return {
      provider: "manual",
      providerPaymentId:
        input.providerPaymentId ?? `manual_txn_${crypto.randomBytes(8).toString("hex")}`,
      status: "succeeded",
    };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new ManualPaymentProvider();
}

