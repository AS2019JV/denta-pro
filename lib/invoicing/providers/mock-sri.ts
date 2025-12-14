
import { InvoiceProvider, SRIInvoice } from "@/lib/invoicing/types";

export class MockSRIProvider implements InvoiceProvider {
  async generateInvoice(invoice: SRIInvoice): Promise<{
    accessKey: string;
    authorizationDate: string;
    xml: string;
    pdfUrl?: string;
  }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate a fake 49-digit access key
    // Format: date(8) + type(2) + ruc(13) + env(1) + estab(3) + pto(3) + seq(9) + code(8) + check(1)
    const date = invoice.issueDate.replace(/-/g, '');
    const random = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const accessKey = `${date}0117921612340011001001${invoice.sequential}${random}1`;

    const authorizationDate = new Date().toISOString();

    const mockXml = `
<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.0.0">
  <infoTributaria>
    <ambiente>1</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>DENTA PRO MOCK</razonSocial>
    <ruc>1792161234001</ruc>
    <claveAcceso>${accessKey}</claveAcceso>
    <estab>${invoice.establishment}</estab>
    <ptoEmi>${invoice.emissionPoint}</ptoEmi>
    <secuencial>${invoice.sequential}</secuencial>
    <dirMatriz>Av. Amazonas y Naciones Unidas</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${invoice.issueDate}</fechaEmision>
    <dirEstablecimiento>Av. Amazonas y Naciones Unidas</dirEstablecimiento>
    <obligadoContabilidad>NO</obligadoContabilidad>
    <tipoIdentificacionComprador>05</tipoIdentificacionComprador>
    <razonSocialComprador>${invoice.patientName}</razonSocialComprador>
    <identificacionComprador>${invoice.patientIndentifier}</identificacionComprador>
    <totalSinImpuestos>${invoice.subtotal.toFixed(2)}</totalSinImpuestos>
    <totalDescuento>${invoice.totalDiscount.toFixed(2)}</totalDescuento>
    <importeTotal>${invoice.total.toFixed(2)}</importeTotal>
  </infoFactura>
</factura>
    `.trim();

    return {
      accessKey,
      authorizationDate,
      xml: mockXml,
      pdfUrl: `https://mock-sri.ec/comprobantes/${accessKey}.pdf`
    };
  }

  async checkStatus(accessKey: string) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      status: 'AUTHORIZED' as const,
      authorizationDate: new Date().toISOString()
    };
  }
}
