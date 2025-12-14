
import { MockSRIProvider } from "./providers/mock-sri";
import { InvoiceProvider } from "./types";

// Factory to get the configured provider
// In the future, this can switch based on env vars
export const getInvoiceProvider = (): InvoiceProvider => {
  // const providerName = process.env.NEXT_PUBLIC_INVOICE_PROVIDER;
  // if (providerName === 'facturapi') return new FacturapiProvider();
  
  return new MockSRIProvider();
};

export * from "./types";
