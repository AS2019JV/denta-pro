
export interface InvoiceItem {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number; // 12% usually, or 15% now in Ecuador
  total: number;
}

export interface InvoiceTax {
  code: string; // "2" for VAT
  percentageCode: string; // "2" for 12%, "4" for 15%
  baseAmount: number;
  amount: number;
}

export interface SRIInvoice {
  accessKey?: string; // Clave de Acceso (49 digits)
  authorizationDate?: string;
  xmlContent?: string;
  status: 'DRAFT' | 'GENERATED' | 'SIGNED' | 'AUTHORIZED' | 'REJECTED';
  environment: 'TEST' | 'PRODUCTION';
  issueDate: string;
  establishment: string; // 001
  emissionPoint: string; // 001
  sequential: string; // 000000001
  
  // Patient Info
  patientId: string;
  patientName: string;
  patientIdType: 'RUC' | 'CEDULA' | 'PASAPORTE';
  patientIndentifier: string;
  patientEmail: string;
  patientAddress: string;

  // Amounts
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  total: number;

  items: InvoiceItem[];
}

export interface InvoiceProvider {
  generateInvoice(invoice: SRIInvoice): Promise<{
    accessKey: string;
    authorizationDate: string;
    xml: string;
    pdfUrl?: string;
  }>;
  
  checkStatus(accessKey: string): Promise<{
    status: SRIInvoice['status'];
    authorizationDate?: string;
    rejectionReason?: string;
  }>;
}
