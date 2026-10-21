import thaisevaLogo from "../assets/logo-thaiseva.jpg";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const money = (value) => {
  const amount = Number(value);
  return `฿${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
};

const displayValue = (value, fallback = "-") => {
  const text = String(value ?? "").trim();
  return escapeHtml(text || fallback);
};

const compactInvoiceNumber = (value) => {
  const text = String(value ?? "").trim();
  if (text.length <= 22) return text;
  const shaOrderId = text.match(/^ORD-([a-f0-9]{64})$/i);
  if (shaOrderId) return `ORD-${shaOrderId[1].slice(0, 8).toUpperCase()}`;
  return `${text.slice(0, 12)}…${text.slice(-6)}`;
};

/**
 * Creates a small, dependency-free invoice document that works for customer,
 * restaurant, and order invoices. Pass only the fields relevant to the invoice.
 */
export const buildInvoiceHtml = ({
  invoiceNumber,
  title = "Invoice",
  invoiceDate,
  orderDate,
  billedTo = {},
  suppliedBy = {},
  items = [],
  subtotal,
  deliveryFee = 0,
  discount = 0,
  commission,
  total,
  status,
  contactInfo = {},
  note = "Thank you for your order.",
  logoUrl = thaisevaLogo,
} = {}) => {
  const compactNumber = compactInvoiceNumber(invoiceNumber);
  const normalizedItems = items.length
    ? items
    : [{ description: "Food order", quantity: 1, price: subtotal ?? total ?? 0 }];

  const itemRows = normalizedItems
    .map((item) => {
      const quantity = Number(item.quantity ?? item.Quantity ?? 1) || 1;
      const price = Number(item.price ?? item.Price ?? 0) || 0;
      const lineTotal = Number(item.total ?? quantity * price) || 0;
      return `<tr>
        <td>${displayValue(item.description ?? item.ItemName ?? item.name, "Item")}</td>
        <td class="number">${escapeHtml(quantity)}</td>
        <td class="number">${money(price)}</td>
        <td class="number strong">${money(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const calculatedSubtotal = normalizedItems.reduce((sum, item) => {
    const quantity = Number(item.quantity ?? item.Quantity ?? 1) || 1;
    const price = Number(item.price ?? item.Price ?? 0) || 0;
    return sum + quantity * price;
  }, 0);
  const subtotalValue = Number(subtotal ?? calculatedSubtotal) || 0;
  const totalValue = Number(total ?? subtotalValue + Number(deliveryFee) - Number(discount)) || 0;

  const optionalRow = (label, value, show = Number(value) !== 0) =>
    show
      ? `<div class="total-row"><span>${escapeHtml(label)}</span><span>${money(value)}</span></div>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${displayValue(title)} ${displayValue(compactNumber, "")}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #172033; background: #eef2f6; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 16px; }
    .invoice { width: min(210mm, 100%); min-height: 297mm; margin: auto; background: #fff; padding: 14mm; border-radius: 14px; box-shadow: 0 12px 35px rgba(15, 23, 42, .10); }
    header { position: relative; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 24px; border-bottom: 2px solid #172033; }
    header::after { position: absolute; right: 0; bottom: -2px; width: 82px; height: 2px; background: #e25420; content: ""; }
    h1 { margin: 12px 0 0; font-size: 27px; letter-spacing: -.5px; }
    .brand-lockup { display: flex; align-items: center; gap: 14px; }
    .logo { display: block; width: 88px; height: 58px; border-radius: 9px; object-fit: contain; background: #fff; }
    .brand-name { color: #e25420; font-weight: 800; font-size: 19px; letter-spacing: .04em; }
    .brand-tagline { margin-top: 3px; color: #7a8699; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
    .meta { text-align: right; font-size: 13px; line-height: 1.7; color: #526075; }
    .meta strong { color: #172033; }
    .invoice-number { display: inline-block; max-width: 190px; overflow: hidden; vertical-align: bottom; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .status { display: inline-block; margin-top: 5px; padding: 3px 9px; border: 1px solid #f2c8b8; border-radius: 999px; color: #a83b15; background: #fff5f0; font-size: 10px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 28px 0; }
    .label { margin-bottom: 8px; color: #e25420; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .party { font-size: 13px; line-height: 1.65; }
    .party strong { display: block; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { padding: 11px 10px; color: #fff; background: #172033; font-size: 10px; text-align: left; text-transform: uppercase; letter-spacing: .07em; }
    td { padding: 14px 10px; border-bottom: 1px solid #e7ebf0; }
    .number { text-align: right; white-space: nowrap; }
    .strong { font-weight: 700; }
    .summary { width: min(320px, 100%); margin: 24px 0 0 auto; }
    .total-row { display: flex; justify-content: space-between; gap: 20px; padding: 6px 0; font-size: 13px; }
    .grand-total { margin-top: 8px; padding: 13px 12px; border-radius: 8px; color: #fff; background: #172033; font-size: 18px; font-weight: 800; }
    footer { margin-top: 38px; padding: 18px 20px; border-left: 3px solid #e25420; color: #68758a; background: #f8fafc; font-size: 12px; line-height: 1.7; }
    .actions { width: min(210mm, 100%); display: flex; justify-content: flex-end; gap: 8px; margin: 0 auto 12px; }
    button { border: 0; border-radius: 8px; padding: 10px 16px; color: #fff; background: #172033; font: 600 14px Arial, sans-serif; cursor: pointer; }
    @media (max-width: 600px) { body { padding: 0; } .actions { padding: 12px; } .invoice { min-height: 100vh; padding: 26px 18px; border-radius: 0; box-shadow: none; } header, .parties { grid-template-columns: 1fr; flex-direction: column; } .meta { text-align: left; } .logo { width: 74px; height: 50px; } }
    @media print { @page { size: A4 portrait; margin: 0; } html, body { width: 210mm; min-height: 297mm; padding: 0; background: #fff; } .actions { display: none; } .invoice { width: 210mm; min-height: 297mm; padding: 14mm; border-radius: 0; box-shadow: none; } thead { display: table-header-group; } tr { break-inside: avoid; page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="actions"><button type="button" onclick="window.print()">Print / Save PDF</button></div>
  <main class="invoice">
    <header>
      <div>
        <div class="brand-lockup">
          <img class="logo" src="${escapeHtml(logoUrl)}" alt="ThaiSeva logo">
          <div><div class="brand-name">THAISEVA</div><div class="brand-tagline">Food delivery service</div></div>
        </div>
        <h1>${displayValue(title)}</h1>
      </div>
      <div class="meta">
        <div><strong>Invoice:</strong> <span class="invoice-number" title="${displayValue(invoiceNumber)}">${displayValue(compactNumber)}</span></div>
        <div><strong>Issued:</strong> ${displayValue(invoiceDate)}</div>
        ${orderDate ? `<div><strong>Order date:</strong> ${displayValue(orderDate)}</div>` : ""}
        ${status ? `<div class="status">${displayValue(status)}</div>` : ""}
      </div>
    </header>
    <section class="parties">
      <div class="party"><div class="label">Billed to</div><strong>${displayValue(billedTo.name)}</strong><div>${displayValue(billedTo.address, "")}</div><div>${displayValue(billedTo.phone, "")}</div><div>${displayValue(billedTo.email, "")}</div></div>
      <div class="party"><div class="label">Supplied by</div><strong>${displayValue(suppliedBy.name, "Thaiseva")}</strong><div>${displayValue(suppliedBy.address, "")}</div><div>${displayValue(suppliedBy.phone, "")}</div><div>${displayValue(suppliedBy.email, "")}</div></div>
    </section>
    <table>
      <thead><tr><th>Description</th><th class="number">Qty</th><th class="number">Price</th><th class="number">Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <section class="summary">
      ${optionalRow("Subtotal", subtotalValue, true)}
      ${optionalRow("Delivery fee", deliveryFee)}
      ${optionalRow("Discount", -Math.abs(Number(discount) || 0))}
      ${optionalRow("Commission", commission, commission !== undefined && commission !== null)}
      <div class="total-row grand-total"><span>Total</span><span>${money(totalValue)}</span></div>
    </section>
    <footer><strong>${displayValue(note)}</strong><br>${displayValue(contactInfo.email, "")} ${contactInfo.phone ? ` · ${displayValue(contactInfo.phone)}` : ""}</footer>
  </main>
</body>
</html>`;
};

export const openInvoiceWindow = (data) => {
  const invoiceWindow = window.open("", "_blank");
  if (!invoiceWindow) throw new Error("Pop-up blocked. Allow pop-ups to open the invoice.");
  invoiceWindow.opener = null;
  invoiceWindow.document.open();
  invoiceWindow.document.write(buildInvoiceHtml(data));
  invoiceWindow.document.close();
  return invoiceWindow;
};

export const legacyInvoiceToHtmlData = (invoice, type, orderId, contactInfo) => {
  const table = invoice?.paymentTable || {};
  const recipient = invoice?.paymentTo || {};
  const otherParty = invoice?.partnerInfo || {};
  return {
    invoiceNumber: orderId,
    title: type === "partner" ? "Restaurant Invoice" : "Customer Invoice",
    invoiceDate: invoice?.invoiceDate,
    orderDate: invoice?.paymentDate,
    billedTo: {
      name: recipient.partnerName,
      address: recipient.partnerAddress,
      phone: recipient.partnerPhone,
      email: recipient.partnerEmail,
    },
    suppliedBy: {
      name: type === "partner" ? "Thaiseva" : otherParty.name,
      phone: type === "partner" ? contactInfo?.phone : otherParty.contact,
      email: contactInfo?.email,
    },
    items: [{ description: table.description || "Food order", quantity: 1, price: table.subTotal }],
    subtotal: table.subTotal,
    commission: type === "partner" ? table.totalCommission : undefined,
    deliveryFee: type === "user" ? table.totalCommission : 0,
    total: table.total,
    contactInfo,
  };
};
