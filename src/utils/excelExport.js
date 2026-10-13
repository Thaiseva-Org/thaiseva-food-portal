import ExcelJS from "exceljs";
import { formatDisplayOrderId } from "./orderData.js";
import { safeCsvFilenamePart, formatOrderDateTime } from "./financeCsv.js";

/**
 * Common styling constants for professional, publication-grade Excel spreadsheets.
 */
export const EXCEL_STYLES = {
  fontFamily: "Segoe UI",
  colors: {
    // Official ThaiSeva Brand Blue Theme Tokens (Tailwind & CSS Variables)
    primaryNavy: "1E3A8A",     // Brand Blue 900 (Main Table Headers, Structural Lines)
    brandDark: "172554",        // Brand Blue 950 (Main Title Banners & Footers)
    brand800: "1E40AF",         // Brand Blue 800 (Section Headers, Pill Text, Highlighted IDs)
    brandBlue: "1D4ED8",        // Brand Blue 700 (Key Totals, Accents & Primary Currency)
    brandMid: "2563EB",         // Brand Blue 600 (Vibrant Brand Blue Accent & Tab Colors)
    brand500: "3B82F6",         // Brand Blue 500 (Vibrant Highlights)
    brandLight: "EFF6FF",       // Brand Blue 50 (Soft Subtitle & Total Row Fill)
    brandBadgeFill: "DBEAFE",   // Brand Blue 100 (Badge Pill & Revenue Card Highlight Fill)
    brandBadgeText: "1E40AF",   // Brand Blue 800 (Badge Pill Text)
    headerText: "FFFFFF",       // Pure White
    subHeaderFill: "EFF6FF",    // Brand Blue 50
    subHeaderText: "1E3A8A",    // Brand Blue 900
    zebraRow: "F4F8FD",         // Subtle Brand Blue Tint (Clean Alternate Data Rows)
    borderColor: "E2E8F0",      // Slate 200 (Clean Table Gridlines)
    borderBlue: "BFDBFE",       // Brand Blue 200 (Brand Blue Divider Borders)
    borderBlueMedium: "93C5FD", // Brand Blue 300 (Accent Borders)
    borderBlueDark: "1E3A8A",   // Brand Blue 900 (Structural Double Underline)
    accentBlue: "2563EB",       // Brand Blue 600
    accentGreen: "16A34A",      // Green 600
    accentRed: "DC2626",        // Red 600
    accentAmber: "D97706",      // Amber 600
    summaryFill: "FEF3C7",      // Amber 100
    totalRowFill: "EFF6FF",     // Brand Blue 50 Total Row Fill
  },
};

/**
 * Triggers a download of an ExcelJS workbook in the browser.
 */
export async function downloadWorkbook(workbook, filename) {
  const cleanName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = cleanName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Applies professional header styling to a given row with Brand Blue borders.
 */
export function styleHeaderRow(
  row,
  {
    height = 26,
    bgColor = EXCEL_STYLES.colors.primaryNavy,
    textColor = EXCEL_STYLES.colors.headerText,
    borderColor = EXCEL_STYLES.colors.borderBlue,
    bottomBorderColor = EXCEL_STYLES.colors.brandDark,
  } = {}
) {
  row.height = height;
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = {
      name: EXCEL_STYLES.fontFamily,
      size: 10.5,
      bold: true,
      color: { argb: `FF${textColor}` },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${bgColor}` },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: cell.alignment?.horizontal || "left",
      wrapText: false,
    };
    cell.border = {
      top: { style: "thin", color: { argb: `FF${borderColor}` } },
      bottom: { style: "medium", color: { argb: `FF${bottomBorderColor}` } },
      left: { style: "thin", color: { argb: `FF${borderColor}` } },
      right: { style: "thin", color: { argb: `FF${borderColor}` } },
    };
  });
}

/**
 * Automatically adjusts column widths based on cell contents with a minimum padding.
 */
export function autoFitColumns(worksheet, minWidths = {}, padding = 4) {
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      // Skip merged banner cells (row 1 or 2) when calculating column width
      if (cell.row <= 2 && cell.value && String(cell.value).length > 40) return;
      const valStr = cell.value != null ? String(cell.value) : "";
      if (valStr.length > maxLength) {
        maxLength = valStr.length;
      }
    });
    const colKey = column.key;
    const minW = (colKey && minWidths[colKey]) || 12;
    column.width = Math.max(maxLength + padding, minW);
  });
}

/**
 * ============================================================================
 * 1. MENU BULK IMPORT TEMPLATE (.xlsx)
 * ============================================================================
 */
export function createMenuImportTemplateWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ThaiSeva Food Portal";
  wb.lastModifiedBy = "ThaiSeva";
  wb.created = new Date();

  // --- SHEET 1: Menu Import Template ---
  const ws = wb.addWorksheet("Menu Import Template", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 4 }],
  });
  ws.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` };

  // Title Banner
  ws.mergeCells("A1:H1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "THAISEVA RESTAURANT - MENU BULK IMPORT TEMPLATE";
  titleCell.font = { name: EXCEL_STYLES.fontFamily, size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 36;

  // Subtitle / Guidance
  ws.mergeCells("A2:H2");
  const subCell = ws.getCell("A2");
  subCell.value = "Instructions: Leave itemId blank to add new items. Provide itemId to update existing items. All prices in THB.";
  subCell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, italic: true, color: { argb: "FF1E40AF" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandLight}` } };
  subCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 22;

  // Empty separator
  ws.getRow(3).height = 8;

  // Headers (Row 4)
  const columns = [
    { header: "itemId", key: "itemId", width: 18 },
    { header: "itemName", key: "itemName", width: 34 },
    { header: "price", key: "price", width: 16 },
    { header: "discount", key: "discount", width: 16 },
    { header: "category", key: "category", width: 22 },
    { header: "itemType", key: "itemType", width: 20 },
    { header: "cuisine", key: "cuisine", width: 18 },
    { header: "description", key: "description", width: 50 },
  ];
  ws.getRow(4).values = columns.map((c) => c.header);
  styleHeaderRow(ws.getRow(4), { height: 28, bgColor: EXCEL_STYLES.colors.primaryNavy });

  // Right-align numeric headers
  ws.getCell("C4").alignment = { vertical: "middle", horizontal: "right" };
  ws.getCell("D4").alignment = { vertical: "middle", horizontal: "right" };
  ws.getCell("F4").alignment = { vertical: "middle", horizontal: "center" };

  // Sample data rows
  const sampleItems = [
    {
      itemId: "",
      itemName: "Pad Thai Goong (Shrimp)",
      price: 120,
      discount: 0,
      category: "Noodles",
      itemType: "Non Veg",
      cuisine: "Thai",
      description: "Classic stir-fried rice noodles with fresh shrimp, tofu, bean sprouts, crushed peanuts, and lime.",
    },
    {
      itemId: "",
      itemName: "Green Curry Chicken",
      price: 150,
      discount: 10,
      category: "Main Course",
      itemType: "Non Veg",
      cuisine: "Thai",
      description: "Creamy aromatic coconut green curry with chicken breast, Thai eggplants, and sweet basil leaves.",
    },
    {
      itemId: "",
      itemName: "Vegetable Spring Rolls (4 pcs)",
      price: 85,
      discount: 0,
      category: "Appetizers",
      itemType: "Veg",
      cuisine: "Thai",
      description: "Crispy fried spring rolls stuffed with glass noodles and shredded cabbage, served with sweet plum sauce.",
    },
    {
      itemId: "",
      itemName: "Mango Sticky Rice",
      price: 95,
      discount: 0,
      category: "Desserts",
      itemType: "Veg",
      cuisine: "Thai",
      description: "Fresh sweet ripe mango slices served with warm sweet coconut sticky rice and roasted sesame.",
    },
    {
      itemId: "",
      itemName: "Traditional Thai Iced Milk Tea",
      price: 45,
      discount: 0,
      category: "Beverages",
      itemType: "Veg",
      cuisine: "Thai",
      description: "Authentic brewed Ceylon black tea with sweetened condensed milk and crushed ice.",
    },
  ];

  sampleItems.forEach((item, idx) => {
    const row = ws.addRow([
      item.itemId,
      item.itemName,
      item.price,
      item.discount,
      item.category,
      item.itemType,
      item.cuisine,
      item.description,
    ]);
    row.height = 24;

    const isZebra = idx % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: EXCEL_STYLES.fontFamily, size: 10, color: { argb: "FF1E293B" } };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
      };
      if (isZebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
      }

      // Column specific alignment & formatting
      if (colNumber === 1) { // itemId
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.numFmt = "@";
      } else if (colNumber === 3) { // price
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"฿"#,##0.00';
      } else if (colNumber === 4) { // discount
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '0"%"';
      } else if (colNumber === 6) { // itemType
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  });

  // Pre-add 10 empty formatted rows for immediate editing
  for (let i = 0; i < 10; i++) {
    const emptyRow = ws.addRow(["", "", "", "", "", "", "", ""]);
    emptyRow.height = 22;
    emptyRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: EXCEL_STYLES.fontFamily, size: 10 };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
      };
      if (colNumber === 1) {
        cell.numFmt = "@";
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (colNumber === 3) {
        cell.numFmt = '"฿"#,##0.00';
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else if (colNumber === 4) {
        cell.numFmt = '0"%"';
        cell.alignment = { vertical: "middle", horizontal: "right" };
      } else if (colNumber === 6) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  }

  // --- SHEET 2: Guidelines & Instructions ---
  const wsGuide = wb.addWorksheet("Instructions & Rules", {
    views: [{ showGridLines: true }],
  });
  wsGuide.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.brandMid}` };

  wsGuide.mergeCells("A1:D1");
  const guideTitle = wsGuide.getCell("A1");
  guideTitle.value = "MENU IMPORT FIELD SPECIFICATIONS & GUIDELINES";
  guideTitle.font = { name: EXCEL_STYLES.fontFamily, size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  guideTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } };
  guideTitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsGuide.getRow(1).height = 32;

  const guideHeaders = ["Column Header", "Required?", "Accepted Values / Format", "Details & Examples"];
  wsGuide.getRow(3).values = guideHeaders;
  styleHeaderRow(wsGuide.getRow(3), { height: 26, bgColor: EXCEL_STYLES.colors.brand800 });

  const guideRules = [
    ["itemId", "Optional", "Text (Alphanumeric)", "Leave completely blank when creating NEW dishes. If updating an existing dish, enter its exact item ID."],
    ["itemName", "REQUIRED (*)", "Text (Max 120 chars)", "The customer-facing name of the dish. Example: 'Tom Yum Kung' or 'Chicken Biryani'."],
    ["price", "REQUIRED (*)", "Number > 0", "Base price in Thai Baht (THB). Example: 120 or 99.50. Do not include currency symbols when typing."],
    ["discount", "Optional", "Number (0 to 100)", "Percentage discount applied to customers. Example: 10 for 10% off. Leave 0 if no discount."],
    ["category", "REQUIRED (*)", "Text", "Menu section where dish belongs. Examples: Appetizers, Main Course, Curries, Noodles, Desserts, Beverages."],
    ["itemType", "REQUIRED (*)", "Veg or Non Veg", "Must be either 'Veg' or 'Non Veg'."],
    ["cuisine", "Optional", "Text", "Cuisine style. Examples: Thai, Indian, Italian, Chinese, Western."],
    ["description", "REQUIRED (*)", "Text", "Appetizing description of ingredients, allergens, preparation, and portion size."],
  ];

  guideRules.forEach((rule, idx) => {
    const row = wsGuide.addRow(rule);
    row.height = 24;
    const isZebra = idx % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5 };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
      };
      if (isZebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
      }
      if (colNumber === 2 && rule[1].includes("REQUIRED")) {
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: "FFDC2626" } };
      }
      if (colNumber === 1) {
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true };
      }
    });
  });

  // Note at bottom
  wsGuide.addRow([]);
  const noteRow2 = wsGuide.addRow([
    "Important Note: Imported items are added as Inactive by default so you can safely upload dish photos and review them in the portal before making them visible to customers.",
  ]);
  wsGuide.mergeCells(`A${noteRow2.number}:D${noteRow2.number}`);
  noteRow2.getCell(1).font = { name: EXCEL_STYLES.fontFamily, size: 9.5, italic: true, color: { argb: "FF1D4ED8" } };
  noteRow2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  noteRow2.height = 26;

  autoFitColumns(wsGuide, { 1: 18, 2: 16, 3: 30, 4: 65 });

  return wb;
}

export async function downloadMenuImportTemplate() {
  const wb = createMenuImportTemplateWorkbook();
  await downloadWorkbook(wb, "thaiseva_menu_import_template.xlsx");
}

/**
 * ============================================================================
 * 2. MENU ITEMS EXPORT (.xlsx)
 * ============================================================================
 */
export async function exportMenuCatalogToExcel({ items = [], restaurantName = "Restaurant" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ThaiSeva Food Portal";
  wb.created = new Date();

  const ws = wb.addWorksheet("Menu Catalog", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 5 }],
  });
  ws.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` };

  // Title Banner
  ws.mergeCells("A1:K1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `${String(restaurantName || "RESTAURANT").toUpperCase()} - MENU CATALOG`;
  titleCell.font = { name: EXCEL_STYLES.fontFamily, size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 36;

  // Metadata summary row
  const activeCount = items.filter((i) => i.active).length;
  const inactiveCount = items.length - activeCount;
  const categoriesCount = new Set(items.map((i) => i.category).filter(Boolean)).size;

  ws.mergeCells("A2:K2");
  const metaCell = ws.getCell("A2");
  metaCell.value = `Exported: ${new Date().toLocaleString()}  |  Total Dishes: ${items.length}  |  Active (Live): ${activeCount}  |  Inactive (Hidden): ${inactiveCount}  |  Categories: ${categoriesCount}`;
  metaCell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, color: { argb: "FF1E40AF" } };
  metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandLight}` } };
  metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 22;

  // Empty separator
  ws.getRow(3).height = 6;

  // Table Headers (Row 4)
  const headers = [
    { key: "id", label: "Item ID", minW: 16 },
    { key: "name", label: "Dish Name", minW: 32 },
    { key: "category", label: "Category", minW: 20 },
    { key: "type", label: "Type", minW: 14 },
    { key: "price", label: "Price (THB)", minW: 16 },
    { key: "discount", label: "Discount", minW: 14 },
    { key: "salePrice", label: "Selling Price", minW: 16 },
    { key: "status", label: "Status", minW: 14 },
    { key: "cuisine", label: "Cuisine", minW: 18 },
    { key: "sales", label: "Sales (THB)", minW: 16 },
    { key: "description", label: "Description", minW: 46 },
  ];

  ws.getRow(4).values = headers.map((h) => h.label);
  styleHeaderRow(ws.getRow(4), { height: 28, bgColor: EXCEL_STYLES.colors.primaryNavy });

  // Alignments on header
  ws.getCell("E4").alignment = { vertical: "middle", horizontal: "right" };
  ws.getCell("F4").alignment = { vertical: "middle", horizontal: "right" };
  ws.getCell("G4").alignment = { vertical: "middle", horizontal: "right" };
  ws.getCell("D4").alignment = { vertical: "middle", horizontal: "center" };
  ws.getCell("H4").alignment = { vertical: "middle", horizontal: "center" };
  ws.getCell("J4").alignment = { vertical: "middle", horizontal: "right" };

  items.forEach((item, idx) => {
    const rawPrice = Number(item.price) || 0;
    const rawDiscount = Number(item.discount) || 0;
    const salePrice = rawDiscount > 0 ? rawPrice * (1 - rawDiscount / 100) : rawPrice;
    const isVeg = item.itemType === "Veg";
    const isActive = Boolean(item.active);

    const row = ws.addRow([
      item.itemId || item.id || "",
      item.itemName || "",
      item.category || "Uncategorized",
      item.itemType || "-",
      rawPrice,
      rawDiscount > 0 ? rawDiscount / 100 : 0,
      salePrice,
      isActive ? "ACTIVE" : "INACTIVE",
      item.cuisine || "-",
      Number(item.earning) || 0,
      item.description || "",
    ]);

    row.height = 24;
    const isZebra = idx % 2 === 1;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, color: { argb: "FF1E293B" } };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
      };

      if (isZebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
      }

      // Column formatting
      if (colNumber === 1) { // Item ID
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.numFmt = "@";
      } else if (colNumber === 4) { // Type
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = {
          name: EXCEL_STYLES.fontFamily,
          size: 9.5,
          bold: true,
          color: { argb: isVeg ? "FF16A34A" : "FFDC2626" },
        };
      } else if (colNumber === 5 || colNumber === 7 || colNumber === 10) { // Prices
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"฿"#,##0.00';
      } else if (colNumber === 6) { // Discount
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "0.0%";
      } else if (colNumber === 8) { // Status
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = {
          name: EXCEL_STYLES.fontFamily,
          size: 9.5,
          bold: true,
          color: { argb: isActive ? "FF16A34A" : "FF94A3B8" },
        };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  });

  const minWidthMap = {};
  headers.forEach((h, i) => {
    minWidthMap[i + 1] = h.minW;
  });
  autoFitColumns(ws, minWidthMap, 4);

  const safeName = safeCsvFilenamePart(restaurantName);
  const dateStr = new Date().toISOString().slice(0, 10);
  await downloadWorkbook(wb, `${safeName}-menu-catalog-${dateStr}.xlsx`);
}

export function getOrderItemsList(order) {
  if (!order) return [];
  if (Array.isArray(order.Items) && order.Items.length > 0) return order.Items;
  if (Array.isArray(order.items) && order.items.length > 0) return order.items;
  if (Array.isArray(order.orderDetails) && order.orderDetails.length > 0) return order.orderDetails;
  if (Array.isArray(order.orderItems) && order.orderItems.length > 0) return order.orderItems;
  if (Array.isArray(order.dishes) && order.dishes.length > 0) return order.dishes;
  if (Array.isArray(order.cart) && order.cart.length > 0) return order.cart;
  if (Array.isArray(order.cartItems) && order.cartItems.length > 0) return order.cartItems;
  if (order.Items && typeof order.Items === "object") {
    const vals = Object.values(order.Items).filter(Boolean);
    if (vals.length > 0) return vals;
  }
  if (order.items && typeof order.items === "object") {
    const vals = Object.values(order.items).filter(Boolean);
    if (vals.length > 0) return vals;
  }
  if (order.orderDetails && typeof order.orderDetails === "object") {
    const vals = Object.values(order.orderDetails).filter(Boolean);
    if (vals.length > 0) return vals;
  }
  return [];
}

export function formatOrderItemsSummary(order) {
  const items = getOrderItemsList(order);
  if (!items || items.length === 0) return "-";
  return items
    .map((item) => {
      const name = item.ItemName || item.itemName || item.name || item.title || item.dishName || "Item";
      const qty = Number(item.Quantity ?? item.quantity ?? item.qty ?? item.count ?? 1) || 1;
      const price = Number(item.Price ?? item.price ?? item.unitPrice ?? item.cost ?? 0) || 0;
      const discount = Number(item.discount ?? item.Discount ?? 0) || 0;
      const lineAmt = discount > 0 ? price * (1 - discount / 100) * qty : price * qty;
      const discountNote = discount > 0 ? ` [${discount}% off]` : "";
      return `${qty}x ${name} (฿${lineAmt.toFixed(2)}${discountNote})`;
    })
    .join("\n");
}

export function getOrderFinancials(order) {
  const gross = Number(order?.Amount ?? order?.amount ?? order?.TotalAmount ?? order?.totalAmount ?? order?.accounting?.amount ?? 0) || 0;
  const delivery = Number(order?.deliveryCharge ?? order?.DeliveryCharge ?? order?.accounting?.deliveryCharge ?? order?.shippingFee ?? 0) || 0;
  let subtotal = order?.foodSubtotal != null && Number(order.foodSubtotal) > 0
    ? Number(order.foodSubtotal)
    : order?.subtotal != null && Number(order.subtotal) > 0
      ? Number(order.subtotal)
      : order?.accounting?.foodSubtotal != null && Number(order.accounting.foodSubtotal) > 0
        ? Number(order.accounting.foodSubtotal)
        : Math.max(0, gross - delivery);

  const items = getOrderItemsList(order);
  let computedItemsSubtotal = 0;
  if (items.length > 0) {
    computedItemsSubtotal = items.reduce((sum, dish) => {
      const q = Number(dish.Quantity ?? dish.quantity ?? dish.qty ?? dish.count ?? 1) || 1;
      const p = Number(dish.Price ?? dish.price ?? dish.unitPrice ?? dish.cost ?? 0) || 0;
      const d = Number(dish.discount ?? dish.Discount ?? 0) || 0;
      const line = d > 0 ? p * (1 - d / 100) * q : p * q;
      return sum + line;
    }, 0);
  }

  if (subtotal === 0 && computedItemsSubtotal > 0) {
    subtotal = computedItemsSubtotal;
  }
  let finalGross = gross;
  if (finalGross === 0 && (subtotal > 0 || delivery > 0)) {
    finalGross = subtotal + delivery;
  }
  if (subtotal === 0 && finalGross > 0 && delivery === 0) {
    subtotal = finalGross;
  }

  const itemsCount = items.length > 0
    ? items.reduce((sum, i) => sum + (Number(i.Quantity ?? i.quantity ?? i.qty ?? i.count ?? 1) || 1), 0)
    : 1;

  return { gross: finalGross, delivery, subtotal, itemsCount };
}

/**
 * ============================================================================
 * 3. ORDERS EXPORT (.xlsx) - MULTI-TAB WITH ALL DETAILS & TOTALS
 * ============================================================================
 */

/**
 * Builds the complete professional multi-tab ExcelJS Workbook for orders.
 * Returns the workbook instance for testing, inspection, or download.
 */
export function buildOrdersWorkbook({
  orders = [],
  restaurantName = "ThaiSeva",
  dateRangeLabel = "",
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ThaiSeva Food Portal";
  wb.lastModifiedBy = "ThaiSeva";
  wb.created = new Date();

  // Aggregate calculations
  let totalGross = 0;
  let totalFoodSubtotal = 0;
  let totalDelivery = 0;
  let totalDishesCount = 0;
  let deliveredCount = 0;
  let preparingCount = 0;
  let readyCount = 0;
  let outCount = 0;
  let newCount = 0;
  let cancelledCount = 0;

  orders.forEach((o) => {
    const fin = getOrderFinancials(o);
    totalGross += fin.gross;
    totalFoodSubtotal += fin.subtotal;
    totalDelivery += fin.delivery;
    totalDishesCount += fin.itemsCount;

    const st = String(o.Status || "").toLowerCase();
    if (st.includes("deliver")) deliveredCount++;
    else if (st.includes("prep")) preparingCount++;
    else if (st.includes("ready")) readyCount++;
    else if (st.includes("out")) outCount++;
    else if (st.includes("cancel")) cancelledCount++;
    else newCount++;
  });

  const avgOrderValue = orders.length > 0 ? totalGross / orders.length : 0;

  // -------------------------------------------------------------------------
  // SHEET 1: All Orders & Totals (Primary Dashboard & Order List)
  // -------------------------------------------------------------------------
  const wsOrders = wb.addWorksheet("All Orders & Totals", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 8 }],
  });
  wsOrders.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` };

  // Row 1: Title Banner
  wsOrders.mergeCells("A1:O1");
  const titleCell = wsOrders.getCell("A1");
  titleCell.value = `THAISEVA ORDERS & REVENUE REPORT - ${String(restaurantName || "RESTAURANT").toUpperCase()}`;
  titleCell.font = { name: EXCEL_STYLES.fontFamily, size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsOrders.getRow(1).height = 36;

  // Row 2: Metadata Subtitle
  wsOrders.mergeCells("A2:O2");
  const metaCell = wsOrders.getCell("A2");
  metaCell.value = `Date Filter: ${dateRangeLabel || "All Records"}  |  Report Generated: ${new Date().toLocaleString()}  |  Total Orders: ${orders.length}  |  Total Revenue: ฿${totalGross.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  metaCell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, color: { argb: "FF1E40AF" } };
  metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandLight}` } };
  metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsOrders.getRow(2).height = 22;

  // Row 3: Spacer
  wsOrders.getRow(3).height = 8;

  // Row 4: Executive KPI Summary Header
  wsOrders.mergeCells("A4:F4");
  const kpiTitle = wsOrders.getCell("A4");
  kpiTitle.value = "EXECUTIVE SUMMARY & TOTALS";
  kpiTitle.font = { name: EXCEL_STYLES.fontFamily, size: 10, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } };
  wsOrders.getRow(4).height = 20;

  // Row 5: KPI Column Names
  const kpiHeaders = [
    "Total Orders",
    "Dishes / Units Sold",
    "Total Food Subtotal",
    "Total Delivery Fees",
    "Grand Total Revenue",
    "Average Order Value",
  ];
  wsOrders.getRow(5).values = kpiHeaders;
  styleHeaderRow(wsOrders.getRow(5), { height: 24, bgColor: EXCEL_STYLES.colors.brand800 });
  wsOrders.getCell("A5").alignment = { vertical: "middle", horizontal: "center" };
  wsOrders.getCell("B5").alignment = { vertical: "middle", horizontal: "center" };
  wsOrders.getCell("C5").alignment = { vertical: "middle", horizontal: "right" };
  wsOrders.getCell("D5").alignment = { vertical: "middle", horizontal: "right" };
  wsOrders.getCell("E5").alignment = { vertical: "middle", horizontal: "right" };
  wsOrders.getCell("F5").alignment = { vertical: "middle", horizontal: "right" };

  // Row 6: KPI Values
  const kpiRow = wsOrders.addRow([
    orders.length,
    totalDishesCount,
    totalFoodSubtotal,
    totalDelivery,
    totalGross,
    avgOrderValue,
  ]);
  kpiRow.height = 25;
  kpiRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: EXCEL_STYLES.fontFamily, size: 10, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandLight}` } };
    cell.border = {
      top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlueMedium}` } },
      bottom: { style: "medium", color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } },
      left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
      right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
    };
    if (colNumber === 1 || colNumber === 2) {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.numFmt = "#,##0";
    } else {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = '"฿"#,##0.00';
    }
  });
  kpiRow.getCell(5).font = { name: EXCEL_STYLES.fontFamily, size: 11, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
  kpiRow.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandBadgeFill}` } };
  kpiRow.getCell(5).border = {
    top: { style: "medium", color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } },
    bottom: { style: "medium", color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } },
    left: { style: "medium", color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } },
    right: { style: "medium", color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } },
  };

  // Row 7: Spacer
  wsOrders.getRow(7).height = 10;

  // Row 8: Main Table Headers (15 Columns)
  const columns = [
    { label: "Order ID", minW: 16 },
    { label: "Full Order ID", minW: 24 },
    { label: "Order Date & Time", minW: 22 },
    { label: "Restaurant", minW: 24 },
    { label: "Customer Name", minW: 22 },
    { label: "Customer Phone", minW: 18 },
    { label: "Customer Email", minW: 24 },
    { label: "Delivery Address", minW: 36 },
    { label: "Dishes / Items Ordered", minW: 46 },
    { label: "Items Qty", minW: 12 },
    { label: "Payment Method", minW: 18 },
    { label: "Status", minW: 16 },
    { label: "Food Subtotal (THB)", minW: 20 },
    { label: "Delivery Fee (THB)", minW: 18 },
    { label: "Order Total (THB)", minW: 22 },
  ];

  const headerRow = wsOrders.getRow(8);
  headerRow.values = columns.map((c) => c.label);
  styleHeaderRow(headerRow, { height: 28, bgColor: EXCEL_STYLES.colors.primaryNavy });
  headerRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  headerRow.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
  headerRow.getCell(10).alignment = { vertical: "middle", horizontal: "center" };
  headerRow.getCell(12).alignment = { vertical: "middle", horizontal: "center" };
  headerRow.getCell(13).alignment = { vertical: "middle", horizontal: "right" };
  headerRow.getCell(14).alignment = { vertical: "middle", horizontal: "right" };
  headerRow.getCell(15).alignment = { vertical: "middle", horizontal: "right" };

  orders.forEach((item, idx) => {
    const fin = getOrderFinancials(item);
    const itemsSummary = formatOrderItemsSummary(item);
    const itemsList = getOrderItemsList(item);
    const linesCount = Math.max(1, itemsList.length);

    const row = wsOrders.addRow([
      `#${formatDisplayOrderId(item.OrderID)}`,
      String(item.OrderID || ""),
      formatOrderDateTime(item),
      item.restaurantName || item.Restaurant?.name || "ThaiSeva Kitchen",
      item.CustomerName || item.Receiver?.name || item.customer?.name || "-",
      String(item.CustomerContact || item.Receiver?.phoneNumber || item.Receiver?.phone || item.customer?.phoneNumber || item.customer?.phone || "-"),
      item.CustomerEmail || item.Receiver?.email || item.customer?.email || "-",
      item.Location || item.Receiver?.address || item.customer?.address || "-",
      itemsSummary,
      fin.itemsCount,
      item.paymentMethod || "Not recorded",
      String(item.Status || "-").toUpperCase(),
      fin.subtotal,
      fin.delivery,
      fin.gross,
    ]);

    row.height = Math.min(120, Math.max(26, 18 + linesCount * 14));
    const isZebra = idx % 2 === 1;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, color: { argb: "FF1E293B" } };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
      };

      if (isZebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
      }

      if (colNumber === 1) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brand800}` } };
      } else if (colNumber === 3) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (colNumber === 2 || colNumber === 6) {
        cell.numFmt = "@";
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else if (colNumber === 8) {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      } else if (colNumber === 9) {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      } else if (colNumber === 10) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.numFmt = "#,##0";
      } else if (colNumber === 12) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9, bold: true };
      } else if (colNumber === 13 || colNumber === 14) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"฿"#,##0.00';
      } else if (colNumber === 15) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"฿"#,##0.00';
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brandBlue}` } };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  });

  // Grand Total Summary Row
  const startDataRow = 9;
  const endDataRow = startDataRow + orders.length - 1;
  const totalRowNumber = endDataRow + 1;

  const summaryRow = wsOrders.addRow([
    `TOTAL (${orders.length} ORDERS)`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "Total Across All Orders",
    orders.length > 0 ? { formula: `SUM(J${startDataRow}:J${endDataRow})`, result: totalDishesCount } : 0,
    "",
    "",
    orders.length > 0 ? { formula: `SUM(M${startDataRow}:M${endDataRow})`, result: totalFoodSubtotal } : 0,
    orders.length > 0 ? { formula: `SUM(N${startDataRow}:N${endDataRow})`, result: totalDelivery } : 0,
    orders.length > 0 ? { formula: `SUM(O${startDataRow}:O${endDataRow})`, result: totalGross } : 0,
  ]);
  summaryRow.height = 28;

  wsOrders.mergeCells(`A${totalRowNumber}:B${totalRowNumber}`);

  summaryRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: EXCEL_STYLES.fontFamily, size: 10, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.totalRowFill}` } };
    cell.border = {
      top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlueMedium}` } },
      bottom: { style: "double", color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } },
      left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
      right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
    };
    if (colNumber === 10) {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.numFmt = "#,##0";
    } else if (colNumber >= 13 && colNumber <= 15) {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = '"฿"#,##0.00';
    } else if (colNumber === 1 || colNumber === 9) {
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    }
  });

  const minWidthMap = {};
  columns.forEach((c, idx) => {
    minWidthMap[idx + 1] = c.minW;
  });
  autoFitColumns(wsOrders, minWidthMap, 4);

  // -------------------------------------------------------------------------
  // SHEET 2: Order Item Details (Line-by-Line Itemized Dishes Breakdown)
  // -------------------------------------------------------------------------
  const wsItems = wb.addWorksheet("Order Item Details", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 4 }],
  });
  wsItems.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.brandMid}` };

  // Row 1: Title Banner
  wsItems.mergeCells("A1:Q1");
  const itemTitle = wsItems.getCell("A1");
  itemTitle.value = `THAISEVA ITEM-BY-ITEM DISH BREAKDOWN - ${String(restaurantName || "RESTAURANT").toUpperCase()}`;
  itemTitle.font = { name: EXCEL_STYLES.fontFamily, size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  itemTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
  itemTitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsItems.getRow(1).height = 32;

  // Row 2: Subtitle
  wsItems.mergeCells("A2:Q2");
  const itemSub = wsItems.getCell("A2");
  itemSub.value = "Complete line-by-line itemized dishes, portions, discounts, and order totals";
  itemSub.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, italic: true, color: { argb: "FF1E40AF" } };
  itemSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandLight}` } };
  itemSub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsItems.getRow(2).height = 20;

  // Row 3: Spacer
  wsItems.getRow(3).height = 8;

  // Row 4: Table Headers (17 Columns)
  const itemCols = [
    { label: "Order ID", minW: 16 },
    { label: "Full Order ID", minW: 24 },
    { label: "Order Date & Time", minW: 22 },
    { label: "Restaurant", minW: 24 },
    { label: "Customer Name", minW: 22 },
    { label: "Customer Contact", minW: 18 },
    { label: "Delivery Address", minW: 32 },
    { label: "Dish / Item Name", minW: 34 },
    { label: "Category / Label", minW: 18 },
    { label: "Quantity", minW: 12 },
    { label: "Unit Price (THB)", minW: 16 },
    { label: "Discount", minW: 12 },
    { label: "Line Total (THB)", minW: 18 },
    { label: "Order Delivery Fee (THB)", minW: 20 },
    { label: "Order Total (THB)", minW: 20 },
    { label: "Payment Method", minW: 18 },
    { label: "Order Status", minW: 16 },
  ];

  const itemHeaderRow = wsItems.getRow(4);
  itemHeaderRow.values = itemCols.map((c) => c.label);
  styleHeaderRow(itemHeaderRow, { height: 28, bgColor: EXCEL_STYLES.colors.primaryNavy });
  itemHeaderRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  itemHeaderRow.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
  itemHeaderRow.getCell(10).alignment = { vertical: "middle", horizontal: "center" };
  itemHeaderRow.getCell(11).alignment = { vertical: "middle", horizontal: "right" };
  itemHeaderRow.getCell(12).alignment = { vertical: "middle", horizontal: "right" };
  itemHeaderRow.getCell(13).alignment = { vertical: "middle", horizontal: "right" };
  itemHeaderRow.getCell(14).alignment = { vertical: "middle", horizontal: "right" };
  itemHeaderRow.getCell(15).alignment = { vertical: "middle", horizontal: "right" };
  itemHeaderRow.getCell(17).alignment = { vertical: "middle", horizontal: "center" };

  let itemRowIdx = 0;
  orders.forEach((order) => {
    const orderItems = getOrderItemsList(order);
    const dateFormatted = formatOrderDateTime(order);
    const displayId = `#${formatDisplayOrderId(order.OrderID)}`;
    const fullId = String(order.OrderID || "");
    const restName = order.restaurantName || order.Restaurant?.name || "ThaiSeva Kitchen";
    const custName = order.CustomerName || order.Receiver?.name || order.customer?.name || "-";
    const custContact = String(order.CustomerContact || order.Receiver?.phoneNumber || order.Receiver?.phone || order.customer?.phoneNumber || order.customer?.phone || "-");
    const address = order.Location || order.Receiver?.address || order.customer?.address || "-";
    const payment = order.paymentMethod || "Not recorded";
    const statusStr = String(order.Status || "-").toUpperCase();
    const fin = getOrderFinancials(order);

    if (orderItems.length > 0) {
      orderItems.forEach((dish) => {
        const dishName = dish.ItemName || dish.itemName || dish.name || dish.title || dish.dishName || "Food Item";
        const category = dish.Label || dish.category || dish.categoryName || dish.section || "General";
        const qty = Number(dish.Quantity ?? dish.quantity ?? dish.qty ?? dish.count ?? 1) || 1;
        const unitPrice = Number(dish.Price ?? dish.price ?? dish.unitPrice ?? dish.cost ?? 0) || 0;
        const discount = Number(dish.discount ?? dish.Discount ?? 0) || 0;
        const lineTotal = discount > 0 ? unitPrice * (1 - discount / 100) * qty : unitPrice * qty;

        const row = wsItems.addRow([
          displayId,
          fullId,
          dateFormatted,
          restName,
          custName,
          custContact,
          address,
          dishName,
          category,
          qty,
          unitPrice,
          discount > 0 ? discount / 100 : 0,
          lineTotal,
          fin.delivery,
          fin.gross,
          payment,
          statusStr,
        ]);
        row.height = 22;
        const isZebra = itemRowIdx % 2 === 1;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, color: { argb: "FF1E293B" } };
          cell.border = {
            top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
            bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
            left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
            right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          };
          if (isZebra) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
          }
          if (colNumber === 1) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brand800}` } };
          } else if (colNumber === 3 || colNumber === 17) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else if (colNumber === 2 || colNumber === 6) {
            cell.numFmt = "@";
            cell.alignment = { vertical: "middle", horizontal: "left" };
          } else if (colNumber === 10) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.numFmt = "#,##0";
          } else if (colNumber === 11) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = '"฿"#,##0.00';
          } else if (colNumber === 12) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "0.0%";
          } else if (colNumber === 13) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = '"฿"#,##0.00';
            cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brandBlue}` } };
          } else if (colNumber === 14) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = '"฿"#,##0.00';
          } else if (colNumber === 15) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = '"฿"#,##0.00';
            cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "left" };
          }
        });

        itemRowIdx++;
      });
    } else {
      const row = wsItems.addRow([
        displayId,
        fullId,
        dateFormatted,
        restName,
        custName,
        custContact,
        address,
        "Order Items (Package)",
        "General",
        fin.itemsCount,
        fin.subtotal,
        0,
        fin.subtotal,
        fin.delivery,
        fin.gross,
        payment,
        statusStr,
      ]);
      row.height = 22;
      const isZebra = itemRowIdx % 2 === 1;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5 };
        cell.border = {
          top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        };
        if (isZebra) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
        }
        if (colNumber === 1) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brand800}` } };
        } else if (colNumber === 10) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.numFmt = "#,##0";
        } else if (colNumber >= 11 && colNumber <= 15) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = '"฿"#,##0.00';
          if (colNumber === 13 || colNumber === 15) {
            cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brandBlue}` } };
          }
        }
      });
      itemRowIdx++;
    }
  });

  // Sheet 2 Grand Total Row (Row 5 + itemRowIdx)
  const itemStartRow = 5;
  const itemEndRow = itemStartRow + itemRowIdx - 1;
  const itemTotalRowNumber = itemEndRow + 1;
  const itemSummaryRow = wsItems.addRow([
    `TOTAL ITEM DETAILS (${itemRowIdx} ENTRIES)`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    itemRowIdx > 0 ? { formula: `SUM(J${itemStartRow}:J${itemEndRow})`, result: totalDishesCount } : 0,
    "",
    "",
    itemRowIdx > 0 ? { formula: `SUM(M${itemStartRow}:M${itemEndRow})`, result: totalFoodSubtotal } : 0,
    "",
    "",
    "",
    "",
  ]);
  itemSummaryRow.height = 28;
  wsItems.mergeCells(`A${itemTotalRowNumber}:I${itemTotalRowNumber}`);

  itemSummaryRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: EXCEL_STYLES.fontFamily, size: 10, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.totalRowFill}` } };
    cell.border = {
      top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlueMedium}` } },
      bottom: { style: "double", color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } },
      left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
      right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
    };
    if (colNumber === 10) {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.numFmt = "#,##0";
    } else if (colNumber === 13) {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = '"฿"#,##0.00';
    } else if (colNumber === 1) {
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    }
  });

  const itemMinW = {};
  itemCols.forEach((c, idx) => {
    itemMinW[idx + 1] = c.minW;
  });
  autoFitColumns(wsItems, itemMinW, 4);

  // -------------------------------------------------------------------------
  // SHEET 3: Executive Financial Summary & Totals
  // -------------------------------------------------------------------------
  const wsSummary = wb.addWorksheet("Executive Revenue Summary", {
    views: [{ showGridLines: true }],
  });
  wsSummary.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.brandBlue}` };

  wsSummary.mergeCells("A1:D1");
  const sTitle = wsSummary.getCell("A1");
  sTitle.value = "EXECUTIVE ORDERS RECONCILEMENT & TOTALS";
  sTitle.font = { name: EXCEL_STYLES.fontFamily, size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  sTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
  sTitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsSummary.getRow(1).height = 32;

  const summaryHeaders = ["Financial & Operational Metric", "Value (THB) / Count", "Category / Type", "Notes"];
  const sHeaderRow = wsSummary.addRow(summaryHeaders);
  styleHeaderRow(sHeaderRow, { height: 26, bgColor: EXCEL_STYLES.colors.brand800 });

  const summaryMetrics = [
    { label: "Total Orders Processed", val: orders.length, isCurr: false, cat: "Volume", notes: "Count of all orders in period" },
    { label: "Total Dishes & Units Sold", val: totalDishesCount, isCurr: false, cat: "Volume", notes: "Sum of all food portions" },
    { label: "Total Customer Food Subtotal", val: totalFoodSubtotal, isCurr: true, cat: "Revenue", notes: "Net food items before delivery" },
    { label: "Total Delivery Fees Collected", val: totalDelivery, isCurr: true, cat: "Revenue", notes: "Delivery charges paid by customers" },
    { label: "Grand Total Gross Sales (GMV)", val: totalGross, isCurr: true, cat: "Revenue", notes: "Subtotal + delivery charges", highlight: true },
    { label: "Average Order Value (AOV)", val: avgOrderValue, isCurr: true, cat: "Economics", notes: "Gross sales / total orders" },
    { label: "Delivered Orders (Completed)", val: deliveredCount, isCurr: false, cat: "Fulfillment", notes: "Successfully delivered" },
    { label: "Preparing in Kitchen", val: preparingCount, isCurr: false, cat: "Fulfillment", notes: "Currently cooking" },
    { label: "Ready for Courier Pickup", val: readyCount, isCurr: false, cat: "Fulfillment", notes: "Cooked & packaged" },
    { label: "Out for Delivery", val: outCount, isCurr: false, cat: "Fulfillment", notes: "In courier transit" },
    { label: "New Orders Awaiting Confirmation", val: newCount, isCurr: false, cat: "Fulfillment", notes: "Pending confirm" },
    { label: "Cancelled Orders", val: cancelledCount, isCurr: false, cat: "Fulfillment", notes: "Terminated without delivery" },
  ];

  summaryMetrics.forEach((m, idx) => {
    const row = wsSummary.addRow([m.label, m.val, m.cat, m.notes]);
    row.height = 22;
    const isZebra = idx % 2 === 1;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5 };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
      };

      if (m.highlight) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandBadgeFill}` } };
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brandBlue}` } };
      } else if (isZebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
      }

      if (colNumber === 2) {
        if (m.isCurr) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = '"฿"#,##0.00';
        } else {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.numFmt = "#,##0";
        }
      } else if (colNumber === 3) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, color: { argb: `FF${EXCEL_STYLES.colors.brand800}` } };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  });

  autoFitColumns(wsSummary, { 1: 34, 2: 24, 3: 18, 4: 40 }, 4);

  return wb;
}

export async function exportOrdersToExcel({
  orders = [],
  restaurantName = "ThaiSeva",
  dateRangeLabel = "",
  filename = "",
}) {
  const wb = buildOrdersWorkbook({ orders, restaurantName, dateRangeLabel });
  const defaultFile = `${safeCsvFilenamePart(restaurantName)}-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(wb, filename || defaultFile);
  return wb;
}

/**
 * ============================================================================
 * 4. FINANCE & PAYOUTS REPORT (.xlsx)
 * ============================================================================
 */
export async function exportFinanceToExcel({
  restaurant = {},
  ownerId = "",
  mode = "week",
  range = {},
  activeOffer = false,
  parsedOffer = 0,
  defaultRate = 0,
  periodicBreakdown = [],
  delivered = [],
  orders = [],
  moneyFor = null,
  totals = {},
  generatedAt = "",
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ThaiSeva Food Portal";
  wb.created = new Date();

  const commissionSetup = activeOffer
    ? `Period Offer (${parsedOffer}%)`
    : `Standard / Recorded (${totals?.rate ?? defaultRate}%)`;

  // --- SHEET 1: Summary & Breakdown ---
  const wsSummary = wb.addWorksheet("Finance Summary", {
    views: [{ showGridLines: true }],
  });
  wsSummary.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` };

  // Report Header
  wsSummary.mergeCells("A1:J1");
  const mainTitle = wsSummary.getCell("A1");
  mainTitle.value = "THAISEVA RESTAURANT FINANCE & PAYOUTS REPORT";
  mainTitle.font = { name: EXCEL_STYLES.fontFamily, size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  mainTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
  mainTitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsSummary.getRow(1).height = 36;

  // Metadata Table (Rows 3-6)
  const metaRows = [
    ["Restaurant Name", restaurant.name || "N/A", "Period Mode", String(mode || "").toUpperCase()],
    ["Restaurant ID", restaurant.id || ownerId || "N/A", "Date Range", `${range.startDate || ""} to ${range.endDate || ""}`],
    ["Report Generated", generatedAt || new Date().toLocaleString(), "Commission Setup", commissionSetup],
  ];

  metaRows.forEach((r) => {
    const row = wsSummary.addRow(r);
    row.height = 20;
    row.getCell(1).font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brand800}` } };
    row.getCell(2).font = { name: EXCEL_STYLES.fontFamily, size: 9.5, color: { argb: "FF1E293B" } };
    row.getCell(3).font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brand800}` } };
    row.getCell(4).font = { name: EXCEL_STYLES.fontFamily, size: 9.5, color: { argb: "FF1E293B" } };
  });

  wsSummary.addRow([]); // Blank spacer

  // SECTION 1: Period Summary Breakdown
  let currentSectionRow = wsSummary.addRow(["1. PERIOD SUMMARY BREAKDOWN"]);
  currentSectionRow.getCell(1).font = { name: EXCEL_STYLES.fontFamily, size: 11, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } };
  currentSectionRow.height = 24;

  const breakdownHeaders = [
    "Period",
    "Date Range",
    "Delivered Orders",
    "Customer Total",
    "Food Subtotal",
    "Delivery Fee",
    "Commission Base",
    "Food Commission",
    "Platform Total",
    "Restaurant Payout",
  ];
  const bHeaderRow = wsSummary.addRow(breakdownHeaders);
  styleHeaderRow(bHeaderRow, { height: 26, bgColor: EXCEL_STYLES.colors.primaryNavy });
  bHeaderRow.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
  for (let c = 4; c <= 10; c++) {
    bHeaderRow.getCell(c).alignment = { vertical: "middle", horizontal: "right" };
  }

  (periodicBreakdown || []).forEach((b, idx) => {
    const row = wsSummary.addRow([
      b.label,
      b.dateRange,
      b.ordersCount,
      Number(b.gmv) || 0,
      Number(b.foodSubtotal) || 0,
      Number(b.deliveryFees) || 0,
      Number(b.commissionBase) || 0,
      Number(b.foodCommission) || 0,
      Number(b.platform) || 0,
      Number(b.payout) || 0,
    ]);
    row.height = 22;
    const isZebra = idx % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5 };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
      };
      if (isZebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
      }
      if (colNumber === 3) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (colNumber >= 4) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"฿"#,##0.00';
      }
    });
  });

  // Breakdown Total Row
  const bTotalRow = wsSummary.addRow([
    "Total Breakdown",
    `${range.startDate || ""} to ${range.endDate || ""}`,
    delivered.length,
    Number(totals.gmv) || 0,
    Number(totals.discountedFoodSubtotal) || 0,
    Number(totals.deliveryFees) || 0,
    Number(totals.commissionBase) || 0,
    Number(totals.foodCommission) || 0,
    Number(totals.platform) || 0,
    Number(totals.payout) || 0,
  ]);
  bTotalRow.height = 25;
  bTotalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.totalRowFill}` } };
    cell.border = {
      top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlueMedium}` } },
      bottom: { style: "double", color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } },
      left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
      right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
    };
    if (colNumber >= 4) {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = '"฿"#,##0.00';
    } else if (colNumber === 3) {
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
  });

  wsSummary.addRow([]); // Blank spacer

  // SECTION 2: Grand Totals Reconcilement
  const recSectionRow = wsSummary.addRow(["2. GRAND TOTAL RECONCILEMENT"]);
  recSectionRow.getCell(1).font = { name: EXCEL_STYLES.fontFamily, size: 11, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } };
  recSectionRow.height = 24;

  const recHeaderRow = wsSummary.addRow(["Financial Metric", "Value (THB) / Description"]);
  styleHeaderRow(recHeaderRow, { height: 26, bgColor: EXCEL_STYLES.colors.brand800 });
  recHeaderRow.getCell(2).alignment = { vertical: "middle", horizontal: "right" };

  const reconcilementData = [
    { label: "Total Delivered Orders", value: delivered.length, isCurrency: false },
    { label: "Total Customer Gross Sales (GMV)", value: Number(totals.gmv) || 0, isCurrency: true },
    { label: "Total Discounted Food Subtotal", value: Number(totals.discountedFoodSubtotal) || 0, isCurrency: true },
    { label: "Total Delivery Charges", value: Number(totals.deliveryFees) || 0, isCurrency: true },
    { label: "Total Original Commission Base", value: Number(totals.commissionBase) || 0, isCurrency: true },
    { label: "Effective Commission Rate Applied", value: `${totals.rate ?? defaultRate}%`, isCurrency: false },
    { label: "Total Food Commission (Revenue)", value: Number(totals.foodCommission) || 0, isCurrency: true },
    { label: "Total Platform Share", value: Number(totals.platform) || 0, isCurrency: true },
    { label: "Total Restaurant Net Payout", value: Number(totals.payout) || 0, isCurrency: true, isHighlight: true },
    { label: "Commission Pricing Plan", value: commissionSetup, isCurrency: false },
  ];

  reconcilementData.forEach((item, idx) => {
    const row = wsSummary.addRow([item.label, item.value]);
    row.height = 22;
    const isZebra = idx % 2 === 1;

    row.getCell(1).font = {
      name: EXCEL_STYLES.fontFamily,
      size: 9.5,
      bold: item.isHighlight,
      color: { argb: item.isHighlight ? `FF${EXCEL_STYLES.colors.brandBlue}` : "FF1E293B" },
    };
    row.getCell(2).font = {
      name: EXCEL_STYLES.fontFamily,
      size: 9.5,
      bold: item.isHighlight,
      color: { argb: item.isHighlight ? `FF${EXCEL_STYLES.colors.brandBlue}` : "FF1E293B" },
    };

    [row.getCell(1), row.getCell(2)].forEach((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
      };
      if (item.isHighlight) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandBadgeFill}` } };
      } else if (isZebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
      }
    });

    if (item.isCurrency) {
      row.getCell(2).alignment = { vertical: "middle", horizontal: "right" };
      row.getCell(2).numFmt = '"฿"#,##0.00';
    } else {
      row.getCell(2).alignment = { vertical: "middle", horizontal: typeof item.value === "number" ? "center" : "left" };
    }
  });

  autoFitColumns(wsSummary, { 1: 34, 2: 24, 3: 16, 4: 18, 5: 18, 6: 16, 7: 18, 8: 18, 9: 18, 10: 20 }, 4);

  // --- SHEET 2: Delivered Orders Detail ---
  const wsDetail = wb.addWorksheet("Delivered Orders", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 2 }],
  });
  wsDetail.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.brandMid}` };

  const detailCols = [
    { label: "Order ID", minW: 16 },
    { label: "Full Order ID", minW: 24 },
    { label: "Delivered Date & Time", minW: 22 },
    { label: "Customer Name", minW: 22 },
    { label: "Customer Phone", minW: 18 },
    { label: "Delivery Address", minW: 36 },
    { label: "Dishes / Items Ordered", minW: 46 },
    { label: "Items Qty", minW: 12 },
    { label: "Payment Method", minW: 18 },
    { label: "Order Status", minW: 16 },
    { label: "Customer Total (THB)", minW: 18 },
    { label: "Food Subtotal (THB)", minW: 18 },
    { label: "Commission Base (THB)", minW: 18 },
    { label: "Delivery Fee (THB)", minW: 16 },
    { label: "Rate (%)", minW: 12 },
    { label: "Food Commission (THB)", minW: 18 },
    { label: "Platform Total (THB)", minW: 18 },
    { label: "Restaurant Payout (THB)", minW: 20 },
    { label: "Accounting Record", minW: 18 },
  ];

  const detailHeaderRow = wsDetail.getRow(1);
  detailHeaderRow.values = detailCols.map((c) => c.label);
  styleHeaderRow(detailHeaderRow, { height: 28, bgColor: EXCEL_STYLES.colors.primaryNavy });
  detailHeaderRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  detailHeaderRow.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
  detailHeaderRow.getCell(8).alignment = { vertical: "middle", horizontal: "center" };
  detailHeaderRow.getCell(10).alignment = { vertical: "middle", horizontal: "center" };
  for (let c = 11; c <= 18; c++) {
    detailHeaderRow.getCell(c).alignment = { vertical: "middle", horizontal: "right" };
  }

  delivered.forEach((item, idx) => {
    const money = typeof moneyFor === "function" ? moneyFor(item) : {};
    const deliveryCharge = Number(money.deliveryCharge || 0);
    const grossTotal = Number(money.gross || 0);
    const foodSubtotal = grossTotal - deliveryCharge;
    const foodCommission = Number(money.adminShare || 0) - deliveryCharge;
    const fin = getOrderFinancials(item);
    const itemsSummary = formatOrderItemsSummary(item);
    const itemsList = getOrderItemsList(item);
    const linesCount = Math.max(1, itemsList.length);

    const row = wsDetail.addRow([
      `#${formatDisplayOrderId(item.OrderID)}`,
      String(item.OrderID || ""),
      formatOrderDateTime(item),
      item.CustomerName || "-",
      String(item.CustomerContact || item.Receiver?.phoneNumber || item.Receiver?.phone || item.customer?.phoneNumber || item.customer?.phone || "-"),
      item.Location || item.Receiver?.address || item.customer?.address || "-",
      itemsSummary,
      fin.itemsCount,
      item.paymentMethod || "Not recorded",
      String(item.Status || "Delivered").toUpperCase(),
      grossTotal,
      foodSubtotal,
      Number(money.commissionBase || 0),
      deliveryCharge,
      Number(money.rate || 0) / 100,
      foodCommission,
      Number(money.adminShare || 0),
      Number(money.partnerShare || 0),
      money.source === "locked"
        ? "Recorded"
        : money.source === "offer"
          ? "Period offer"
          : "Estimated",
    ]);

    row.height = Math.min(120, Math.max(26, 18 + linesCount * 14));
    const isZebra = idx % 2 === 1;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5 };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
      };
      if (isZebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
      }

      if (colNumber === 1) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brand800}` } };
      } else if (colNumber === 3 || colNumber === 8 || colNumber === 10) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else if (colNumber === 2) {
        cell.numFmt = "@";
        cell.alignment = { vertical: "middle", horizontal: "left" };
      } else if (colNumber === 7) {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      } else if (colNumber >= 11 && colNumber <= 18 && colNumber !== 15) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"฿"#,##0.00';
      } else if (colNumber === 15) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "0.0%";
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  });

  const detailMinW = {};
  detailCols.forEach((c, idx) => {
    detailMinW[idx + 1] = c.minW;
  });
  autoFitColumns(wsDetail, detailMinW, 4);

  // --- SHEET 3: All Orders (requested) ---
  if (Array.isArray(orders) && orders.length > 0) {
    const wsAll = wb.addWorksheet("All Orders", {
      views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    });

    const allHeaderRow = wsAll.getRow(1);
    allHeaderRow.values = detailCols.map((c) => c.label);
    styleHeaderRow(allHeaderRow, { height: 28, bgColor: EXCEL_STYLES.colors.primaryNavy });
    allHeaderRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    allHeaderRow.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
    allHeaderRow.getCell(8).alignment = { vertical: "middle", horizontal: "center" };
    allHeaderRow.getCell(10).alignment = { vertical: "middle", horizontal: "center" };
    for (let c = 11; c <= 18; c++) {
      allHeaderRow.getCell(c).alignment = { vertical: "middle", horizontal: "right" };
    }

    orders.forEach((item, idx) => {
      const money = typeof moneyFor === "function" ? moneyFor(item) : {};
      const deliveryCharge = Number(money.deliveryCharge || 0);
      const grossTotal = Number(money.gross || 0);
      const foodSubtotal = grossTotal - deliveryCharge;
      const foodCommission = Number(money.adminShare || 0) - deliveryCharge;
      const fin = getOrderFinancials(item);
      const itemsSummary = formatOrderItemsSummary(item);
      const itemsList = getOrderItemsList(item);
      const linesCount = Math.max(1, itemsList.length);

      const row = wsAll.addRow([
        `#${formatDisplayOrderId(item.OrderID)}`,
        String(item.OrderID || ""),
        formatOrderDateTime(item),
        item.CustomerName || "-",
        String(item.CustomerContact || item.Receiver?.phoneNumber || item.Receiver?.phone || item.customer?.phoneNumber || item.customer?.phone || "-"),
        item.Location || item.Receiver?.address || item.customer?.address || "-",
        itemsSummary,
        fin.itemsCount,
        item.paymentMethod || "Not recorded",
        String(item.Status || "Unknown").toUpperCase(),
        grossTotal,
        foodSubtotal,
        Number(money.commissionBase || 0),
        deliveryCharge,
        Number(money.rate || 0) / 100,
        foodCommission,
        Number(money.adminShare || 0),
        Number(money.partnerShare || 0),
        money.source === "locked"
          ? "Recorded"
          : money.source === "offer"
            ? "Period offer"
            : "Estimated",
      ]);

      row.height = Math.min(120, Math.max(26, 18 + linesCount * 14));
      const isZebra = idx % 2 === 1;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5 };
        cell.border = {
          top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        };
        if (isZebra) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
        }

        if (colNumber === 1) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brand800}` } };
        } else if (colNumber === 3 || colNumber === 8 || colNumber === 10) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colNumber === 2) {
          cell.numFmt = "@";
          cell.alignment = { vertical: "middle", horizontal: "left" };
        } else if (colNumber === 7) {
          cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        } else if (colNumber >= 11 && colNumber <= 18 && colNumber !== 15) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = '"฿"#,##0.00';
        } else if (colNumber === 15) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = "0.0%";
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }
      });
    });

    autoFitColumns(wsAll, detailMinW, 4);
  }

  const safeName = safeCsvFilenamePart(restaurant.name);
  const fileName = `${safeName}-finance-${mode}-${range.startDate}-to-${range.endDate}.xlsx`;
  await downloadWorkbook(wb, fileName);
}

/**
 * ============================================================================
 * 5. PARSE EXCEL OR CSV FOR MENU BULK IMPORT
 * ============================================================================
 */
export async function parseMenuImportFile(file) {
  const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

  if (!isExcel) {
    // Rely on PapaParse for CSV files
    const Papa = (await import("papaparse")).default;
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve({ rows: results.data || [], error: null });
        },
        error: (err) => {
          resolve({ rows: [], error: err.message });
        },
      });
    });
  }

  // Parse Excel via ExcelJS
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    // Pick first worksheet or sheet with "Template" in title
    let ws = wb.worksheets.find((s) => s.name.toLowerCase().includes("template")) || wb.getWorksheet(1);
    if (!ws) {
      return { rows: [], error: "No worksheet found in the Excel workbook." };
    }

    let headerRowIdx = -1;
    let headerKeys = {}; // colNumber -> keyName

    // Find header row by finding the row with the most matching recognized headers (at least 2)
    ws.eachRow((row, rowNumber) => {
      if (headerRowIdx !== -1) return;
      let matchCount = 0;
      const currentKeys = {};

      row.eachCell((cell, colNumber) => {
        const clean = String(cell.value || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        if (clean === "itemid" || clean === "id") {
          currentKeys[colNumber] = "itemId";
          matchCount++;
        } else if (clean === "itemname" || clean === "dishname" || clean === "name") {
          currentKeys[colNumber] = "itemName";
          matchCount++;
        } else if (clean === "price" || clean === "pricethb") {
          currentKeys[colNumber] = "price";
          matchCount++;
        } else if (clean === "discount" || clean === "discountpct") {
          currentKeys[colNumber] = "discount";
          matchCount++;
        } else if (clean === "category") {
          currentKeys[colNumber] = "category";
          matchCount++;
        } else if (clean === "itemtype" || clean === "type" || clean === "vegornonveg") {
          currentKeys[colNumber] = "itemType";
          matchCount++;
        } else if (clean === "cuisine") {
          currentKeys[colNumber] = "cuisine";
          matchCount++;
        } else if (clean === "description" || clean === "desc") {
          currentKeys[colNumber] = "description";
          matchCount++;
        }
      });

      if (matchCount >= 2 && currentKeys && Object.values(currentKeys).includes("itemName")) {
        headerRowIdx = rowNumber;
        headerKeys = currentKeys;
      }
    });

    if (headerRowIdx === -1) {
      return { rows: [], error: "Could not find a valid header row with 'itemName' or 'Dish Name'. Please use the template format." };
    }

    const rows = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIdx) return; // Skip headers & banners
      const rowObj = {};
      let hasData = false;

      Object.entries(headerKeys).forEach(([colNumberStr, key]) => {
        const colNumber = Number(colNumberStr);
        const cell = row.getCell(colNumber);
        let val = cell.value;

        if (val && typeof val === "object") {
          if (val.result !== undefined) val = val.result;
          else if (val.text !== undefined) val = val.text;
          else if (val.richText && Array.isArray(val.richText)) {
            val = val.richText.map((t) => t.text).join("");
          }
        }

        if (val != null) {
          const str = String(val).trim();
          if (str !== "") hasData = true;
        }

        // Special normalization for discount
        if (key === "discount" && typeof val === "number") {
          if (val > 0 && val <= 1) {
            val = Math.round(val * 100);
          }
        }

        rowObj[key] = val != null ? val : "";
      });

      // Filter out completely blank rows or instruction hints
      const cleanName = String(rowObj.itemName || "").trim();
      if (hasData && cleanName && !cleanName.toLowerCase().startsWith("instructions:")) {
        rows.push(rowObj);
      }
    });

    return { rows, error: null };
  } catch (err) {
    console.error("Failed to parse Excel file:", err);
    return { rows: [], error: `Failed to read Excel file: ${err.message}` };
  }
}

/**
 * ============================================================================
 * 6. PARTNER DASHBOARD STATISTICS EXPORT (.xlsx)
 * ============================================================================
 */
export function buildStatisticsWorkbook({
  restaurant = {},
  restaurantName = "Restaurant",
  restaurantId = "",
  dateRangeLabel = "All time",
  kpis = {},
  orderSummary = {},
  topItems = [],
  orders = [],
  commissionRate = 0,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ThaiSeva Food Portal";
  wb.lastModifiedBy = "ThaiSeva";
  wb.created = new Date();

  // Aggregate financial metrics from orders if available
  let totalGross = 0;
  let totalPlatformCommission = 0;
  let totalPartnerPayout = 0;

  orders.forEach((o) => {
    const fin = getOrderFinancials(o);
    totalGross += fin.gross;
    const st = String(o.Status || "").toLowerCase();
    if (st.includes("deliver")) {
      const commRate = Number(o.comission ?? commissionRate ?? 0);
      const adminShare = Math.round(((fin.subtotal * commRate) / 100 + fin.delivery) * 100) / 100;
      const partnerShare = Math.round((fin.gross - adminShare) * 100) / 100;
      totalPlatformCommission += adminShare;
      totalPartnerPayout += partnerShare;
    }
  });

  // Fallback calculations if orders array not loaded
  const effectiveRate = Number(commissionRate || restaurant.comission || 0);
  if (totalGross === 0 && topItems.length > 0) {
    totalGross = topItems.reduce((sum, item) => sum + (Number(item.earning) || 0), 0);
    totalPartnerPayout = Math.round(totalGross * (1 - effectiveRate / 100) * 100) / 100;
    totalPlatformCommission = Math.round((totalGross - totalPartnerPayout) * 100) / 100;
  }

  // --- SHEET 1: Statistics & Performance Overview ---
  const wsStats = wb.addWorksheet("Statistics & Performance", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 7 }],
  });
  wsStats.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` };

  // Title Banner
  wsStats.mergeCells("A1:H1");
  const tCell = wsStats.getCell("A1");
  tCell.value = `THAISEVA RESTAURANT STATISTICS - ${String(restaurantName || "RESTAURANT").toUpperCase()}`;
  tCell.font = { name: EXCEL_STYLES.fontFamily, size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
  tCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsStats.getRow(1).height = 36;

  // Metadata Subtitle
  wsStats.mergeCells("A2:H2");
  const mCell = wsStats.getCell("A2");
  mCell.value = `Date Range: ${dateRangeLabel || "All Records"}  |  Restaurant ID: ${restaurantId || "N/A"}  |  Generated: ${new Date().toLocaleString()}  |  Commission Rate: ${effectiveRate}%`;
  mCell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, color: { argb: "FF1E40AF" } };
  mCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandLight}` } };
  mCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsStats.getRow(2).height = 22;

  // Row 3: Spacer
  wsStats.getRow(3).height = 8;

  // Row 4: Section 1 Header - Operational & Revenue KPIs
  wsStats.mergeCells("A4:H4");
  const kpiTitle = wsStats.getCell("A4");
  kpiTitle.value = "1. OPERATIONAL & REVENUE KPI METRICS";
  kpiTitle.font = { name: EXCEL_STYLES.fontFamily, size: 11, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } };
  wsStats.getRow(4).height = 24;

  const kpiHeaders = [
    "Total Orders",
    "Orders Delivered",
    "Orders Cancelled",
    "Unique Customers",
    "Items Sold",
    "Gross Volume (GMV)",
    "Net Payout (Partner)",
    "Platform Fee",
  ];
  wsStats.getRow(5).values = kpiHeaders;
  styleHeaderRow(wsStats.getRow(5), { height: 26, bgColor: EXCEL_STYLES.colors.brand800 });
  for (let c = 1; c <= 5; c++) {
    wsStats.getRow(5).getCell(c).alignment = { vertical: "middle", horizontal: "center" };
  }
  for (let c = 6; c <= 8; c++) {
    wsStats.getRow(5).getCell(c).alignment = { vertical: "middle", horizontal: "right" };
  }

  const kpiRow = wsStats.addRow([
    Number(kpis.totalOrder ?? orderSummary.total ?? orders.length) || 0,
    Number(kpis.delivered ?? orderSummary.delivered ?? 0) || 0,
    Number(kpis.canceled ?? orderSummary.cancelled ?? 0) || 0,
    Number(kpis.countCustomer ?? 0) || 0,
    Number(kpis.completeOrder ?? 0) || 0,
    totalGross,
    totalPartnerPayout > 0 ? totalPartnerPayout : Math.max(0, Math.round(totalGross * (1 - effectiveRate / 100) * 100) / 100),
    totalPlatformCommission > 0 ? totalPlatformCommission : Math.round(totalGross * (effectiveRate / 100) * 100) / 100,
  ]);
  kpiRow.height = 26;
  kpiRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: EXCEL_STYLES.fontFamily, size: 10, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandLight}` } };
    cell.border = {
      top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlueMedium}` } },
      bottom: { style: "medium", color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } },
      left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
      right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
    };
    if (colNumber <= 5) {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.numFmt = "#,##0";
    } else {
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = '"฿"#,##0.00';
    }
  });
  // Highlight Net Payout (Col 7)
  kpiRow.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandBadgeFill}` } };

  // Row 7: Spacer
  wsStats.getRow(7).height = 10;

  // Row 8: Section 2 - Order Status Breakdown
  wsStats.mergeCells("A8:D8");
  const statusTitle = wsStats.getCell("A8");
  statusTitle.value = "2. ORDER STATUS DISTRIBUTION";
  statusTitle.font = { name: EXCEL_STYLES.fontFamily, size: 11, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } };
  wsStats.getRow(8).height = 24;

  const statusHeaders = ["Order Status Stage", "Order Count", "Share of Total (%)", "Description"];
  const statusHeaderRow = wsStats.addRow(statusHeaders);
  styleHeaderRow(statusHeaderRow, { height: 26, bgColor: EXCEL_STYLES.colors.primaryNavy });
  statusHeaderRow.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
  statusHeaderRow.getCell(3).alignment = { vertical: "middle", horizontal: "right" };

  const totalOrdersCount = Math.max(1, Number(kpis.totalOrder ?? orderSummary.total ?? orders.length) || 1);
  const statusRows = [
    { label: "Delivered (Completed)", count: Number(kpis.delivered ?? orderSummary.delivered ?? 0), desc: "Successfully delivered to customer" },
    { label: "In Process (Preparing / Ready / Out)", count: Number(orderSummary.inprocess ?? 0), desc: "Currently active in kitchen or courier transit" },
    { label: "New (Awaiting Confirmation)", count: Number(orderSummary.newOrder ?? 0), desc: "Pending admin confirmation" },
    { label: "Cancelled", count: Number(kpis.canceled ?? orderSummary.cancelled ?? 0), desc: "Cancelled without delivery" },
  ];

  statusRows.forEach((sr, idx) => {
    const pct = totalOrdersCount > 0 ? sr.count / totalOrdersCount : 0;
    const r = wsStats.addRow([sr.label, sr.count, pct, sr.desc]);
    r.height = 22;
    const isZebra = idx % 2 === 1;
    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5 };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
      };
      if (isZebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
      }
      if (colNumber === 2) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.numFmt = "#,##0";
      } else if (colNumber === 3) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "0.0%";
      }
    });
  });

  autoFitColumns(wsStats, { 1: 32, 2: 20, 3: 20, 4: 42, 5: 18, 6: 22, 7: 24, 8: 22 }, 4);

  // --- SHEET 2: Top Selling Dishes ---
  const wsTop = wb.addWorksheet("Top Selling Dishes", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 4 }],
  });
  wsTop.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.brandMid}` };

  wsTop.mergeCells("A1:E1");
  const topTitle = wsTop.getCell("A1");
  topTitle.value = `TOP SELLING MENU ITEMS - ${String(restaurantName || "RESTAURANT").toUpperCase()}`;
  topTitle.font = { name: EXCEL_STYLES.fontFamily, size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  topTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
  topTitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsTop.getRow(1).height = 32;

  wsTop.mergeCells("A2:E2");
  const topSub = wsTop.getCell("A2");
  topSub.value = `Ranked by customer order frequency  |  Period: ${dateRangeLabel || "All time"}`;
  topSub.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, italic: true, color: { argb: "FF1E40AF" } };
  topSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandLight}` } };
  topSub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsTop.getRow(2).height = 20;

  wsTop.getRow(3).height = 8;

  const topHeaders = ["Rank", "Dish / Item Name", "Item ID", "Portions / Orders Count", "Total Revenue Generated (THB)"];
  const topHeaderRow = wsTop.addRow(topHeaders);
  styleHeaderRow(topHeaderRow, { height: 26, bgColor: EXCEL_STYLES.colors.primaryNavy });
  topHeaderRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  topHeaderRow.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
  topHeaderRow.getCell(4).alignment = { vertical: "middle", horizontal: "center" };
  topHeaderRow.getCell(5).alignment = { vertical: "middle", horizontal: "right" };

  let totalTopSold = 0;
  let totalTopRevenue = 0;

  if (Array.isArray(topItems) && topItems.length > 0) {
    topItems.forEach((dish, idx) => {
      const portions = Number(dish.count || 0);
      const rev = Number(dish.earning || 0);
      totalTopSold += portions;
      totalTopRevenue += rev;

      const r = wsTop.addRow([
        idx + 1,
        dish.itemName || "Menu Item",
        dish.id || "-",
        portions,
        rev,
      ]);
      r.height = 22;
      const isZebra = idx % 2 === 1;
      r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5 };
        cell.border = {
          top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        };
        if (isZebra) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
        }
        if (colNumber === 1 || colNumber === 3) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colNumber === 4) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.numFmt = "#,##0";
        } else if (colNumber === 5) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = '"฿"#,##0.00';
          cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brandBlue}` } };
        }
      });
    });

    const topSumRow = wsTop.addRow(["TOTAL TOP DISHES", "", "", totalTopSold, totalTopRevenue]);
    topSumRow.height = 25;
    wsTop.mergeCells(`A${topSumRow.number}:C${topSumRow.number}`);
    topSumRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: EXCEL_STYLES.fontFamily, size: 10, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.totalRowFill}` } };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlueMedium}` } },
        bottom: { style: "double", color: { argb: `FF${EXCEL_STYLES.colors.primaryNavy}` } },
        left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
        right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderBlue}` } },
      };
      if (colNumber === 4) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.numFmt = "#,##0";
      } else if (colNumber === 5) {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = '"฿"#,##0.00';
      }
    });
  } else {
    const emptyR = wsTop.addRow(["-", "No top sales data recorded for this period", "-", 0, 0]);
    emptyR.height = 22;
  }

  autoFitColumns(wsTop, { 1: 12, 2: 36, 3: 18, 4: 24, 5: 30 }, 4);

  // --- SHEET 3: Orders Breakdown (if orders present) ---
  if (Array.isArray(orders) && orders.length > 0) {
    const wsOrders = wb.addWorksheet("Orders Detail", {
      views: [{ showGridLines: true, state: "frozen", ySplit: 4 }],
    });
    wsOrders.properties.tabColor = { argb: `FF${EXCEL_STYLES.colors.brandBlue}` };

    wsOrders.mergeCells("A1:K1");
    const oTitle = wsOrders.getCell("A1");
    oTitle.value = `PERIOD ORDERS LOG - ${String(restaurantName || "RESTAURANT").toUpperCase()}`;
    oTitle.font = { name: EXCEL_STYLES.fontFamily, size: 13, bold: true, color: { argb: "FFFFFFFF" } };
    oTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
    oTitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    wsOrders.getRow(1).height = 32;

    wsOrders.mergeCells("A2:K2");
    const oSub = wsOrders.getCell("A2");
    oSub.value = `Total Orders: ${orders.length}  |  Date Range: ${dateRangeLabel || "All time"}`;
    oSub.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, italic: true, color: { argb: "FF1E40AF" } };
    oSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.brandLight}` } };
    oSub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    wsOrders.getRow(2).height = 20;

    wsOrders.getRow(3).height = 8;

    const ordHeaders = [
      "Order ID",
      "Full Order ID",
      "Date & Time",
      "Customer Name",
      "Customer Phone",
      "Delivery Address",
      "Dishes / Items Summary",
      "Payment Method",
      "Status",
      "Food Subtotal (THB)",
      "Order Total (THB)",
    ];
    const ordHeaderRow = wsOrders.addRow(ordHeaders);
    styleHeaderRow(ordHeaderRow, { height: 26, bgColor: EXCEL_STYLES.colors.primaryNavy });
    ordHeaderRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
    ordHeaderRow.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
    ordHeaderRow.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
    ordHeaderRow.getCell(10).alignment = { vertical: "middle", horizontal: "right" };
    ordHeaderRow.getCell(11).alignment = { vertical: "middle", horizontal: "right" };

    orders.forEach((item, idx) => {
      const fin = getOrderFinancials(item);
      const itemsSummary = formatOrderItemsSummary(item);
      const rawId = item.OrderID || item.orderId || item.id || "";
      const displayId = formatDisplayOrderId(rawId);
      const row = wsOrders.addRow([
        displayId ? `#${displayId}` : "-",
        String(rawId || "-"),
        formatOrderDateTime(item),
        item.CustomerName || item.Receiver?.name || item.customer?.name || "-",
        String(item.CustomerContact || item.Receiver?.phoneNumber || item.Receiver?.phone || item.customer?.phoneNumber || item.customer?.phone || "-"),
        item.Location || item.Receiver?.address || item.customer?.address || "-",
        itemsSummary,
        item.paymentMethod || "Not recorded",
        String(item.Status || "-").toUpperCase(),
        fin.subtotal,
        fin.gross,
      ]);
      row.height = 22;
      const isZebra = idx % 2 === 1;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5 };
        cell.border = {
          top: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          bottom: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          left: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
          right: { style: "thin", color: { argb: `FF${EXCEL_STYLES.colors.borderColor}` } },
        };
        if (isZebra) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${EXCEL_STYLES.colors.zebraRow}` } };
        }
        if (colNumber === 1) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brand800}` } };
        } else if (colNumber === 3 || colNumber === 9) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colNumber === 10 || colNumber === 11) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = '"฿"#,##0.00';
          if (colNumber === 11) {
            cell.font = { name: EXCEL_STYLES.fontFamily, size: 9.5, bold: true, color: { argb: `FF${EXCEL_STYLES.colors.brandDark}` } };
          }
        }
      });
    });

    autoFitColumns(wsOrders, { 1: 16, 2: 24, 3: 20, 4: 22, 5: 18, 6: 32, 7: 40, 8: 18, 9: 16, 10: 18, 11: 20 }, 4);
  }

  return wb;
}

export async function exportStatisticsToExcel({
  restaurant = {},
  restaurantName = "Restaurant",
  restaurantId = "",
  dateRangeLabel = "All time",
  kpis = {},
  orderSummary = {},
  topItems = [],
  orders = [],
  commissionRate = 0,
  filename = "",
}) {
  const wb = buildStatisticsWorkbook({
    restaurant,
    restaurantName,
    restaurantId,
    dateRangeLabel,
    kpis,
    orderSummary,
    topItems,
    orders,
    commissionRate,
  });
  const defaultFile = `${safeCsvFilenamePart(restaurantName)}-statistics-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(wb, filename || defaultFile);
  return wb;
}
