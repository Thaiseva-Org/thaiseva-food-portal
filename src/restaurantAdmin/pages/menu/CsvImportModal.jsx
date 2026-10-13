import { useState, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  LinearProgress,
  Box,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { createFoodItem, updateFoodItem } from "../../../api";
import { useAuth } from "../../../AuthContext";
import InfoMessage from "../../../components/InfoMessage";
import { downloadMenuImportTemplate, parseMenuImportFile } from "../../../utils/excelExport";

const CsvImportModal = ({ open, onClose, onImportComplete, ownerUid }) => {
  const { isMasterAdmin, isRestaurantAdmin } = useAuth();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [feedback, setFeedback] = useState(null);

  const handleDownloadExcelTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      await downloadMenuImportTemplate();
    } catch (err) {
      console.error("Failed to download Excel template:", err);
      setFeedback({ type: "error", message: "Failed to download Excel template." });
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const csvContent = [
      "itemId,itemName,price,discount,category,itemType,cuisine,description",
      ',Pad Thai Goong (Shrimp),120,0,Noodles,Non Veg,Thai,"Classic stir-fried rice noodles with shrimp, tofu, and bean sprouts."',
      ',Green Curry Chicken,150,10,Main Course,Non Veg,Thai,"Creamy aromatic coconut green curry with chicken and sweet basil."',
      ',Vegetable Spring Rolls,85,0,Appetizers,Veg,Thai,"Crispy fried spring rolls served with sweet plum dipping sauce."',
      ',Mango Sticky Rice,95,0,Desserts,Veg,Thai,"Sweet ripe mango served with warm coconut sticky rice."',
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "thaiseva_menu_import_template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFeedback(null);
    }
  };

  const resetState = () => {
    setFile(null);
    setProgress(0);
    setTotalRows(0);
    setSuccessCount(0);
    setErrorCount(0);
    setFeedback(null);
    setImporting(false);
    setParsing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (importing) return;
    resetState();
    onClose();
  };

  const handleImport = async () => {
    if (!file) {
      setFeedback({ type: "error", message: "Please select an Excel (.xlsx) or CSV file first." });
      return;
    }
    if (!ownerUid || (!isMasterAdmin && !isRestaurantAdmin)) {
      setFeedback({ type: "error", message: "A restaurant menu administrator is required." });
      return;
    }

    setParsing(true);
    setFeedback(null);

    const { rows, error } = await parseMenuImportFile(file);
    setParsing(false);

    if (error) {
      setFeedback({ type: "error", message: `Error reading file: ${error}` });
      return;
    }

    if (!rows || rows.length === 0) {
      setFeedback({
        type: "warning",
        message: "No valid menu items found in the file. Please check that headers match the template.",
      });
      return;
    }

    setImporting(true);
    setTotalRows(rows.length);
    let success = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const itemName = String(row.itemName || "").trim();

      if (!itemName) {
        errors++;
        setProgress(((i + 1) / rows.length) * 100);
        continue;
      }

      const payload = {
        ownerUid,
        itemName: itemName,
        price: Number(row.price) || 0,
        discount: Number(row.discount) || 0,
        category: String(row.category || "Uncategorized").trim(),
        itemType: String(row.itemType || "Veg").trim(),
        cuisine: String(row.cuisine || "").trim(),
        description: String(row.description || "").trim(),
        active: false, // Inactive by default so photos can be uploaded
      };

      const itemId = String(row.itemId || "").trim().replace("#", "");
      if (itemId) {
        payload.itemId = itemId;
      }

      try {
        if (itemId) {
          try {
            await updateFoodItem(payload);
          } catch (updateErr) {
            if (updateErr.code !== "functions/not-found") throw updateErr;
            await createFoodItem(payload);
          }
        } else {
          await createFoodItem(payload);
        }
        success++;
      } catch (err) {
        console.error(`Failed to import row ${i + 1} (${itemName}):`, err);
        errors++;
      }

      setProgress(((i + 1) / rows.length) * 100);
    }

    setImporting(false);
    setSuccessCount(success);
    setErrorCount(errors);

    if (success > 0) {
      setFeedback({
        type: "success",
        message: `Import complete: ${success} dish${success === 1 ? "" : "es"} imported successfully${
          errors > 0 ? `, ${errors} failed` : ""
        }. Dishes are imported as INACTIVE so you can upload photos before publishing.`,
      });
      if (onImportComplete) {
        onImportComplete();
      }
    } else {
      setFeedback({
        type: "error",
        message: `Import failed: 0 successful, ${errors} failed. Please verify your file column headers and formats.`,
      });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2.5, fontWeight: 700, fontSize: "1.15rem" }}>
        Bulk Import Menu
      </DialogTitle>
      {!importing && (
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: "absolute",
            right: 12,
            top: 12,
            color: "grey.500",
          }}
        >
          <CloseIcon />
        </IconButton>
      )}

      <DialogContent dividers sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          Quickly add or update multiple dishes at once using an Excel or CSV spreadsheet.
          New dishes are imported as <strong>Inactive</strong> so you can review details and upload photos in the portal before publishing.
        </Typography>

        {/* STEP 1: Download Template */}
        <Box
          p={2.5}
          border="1px solid #E2E8F0"
          borderRadius={2.5}
          bgcolor="#F8FAFC"
          display="flex"
          flexDirection="column"
          gap={1.5}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <div>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0F172A" }}>
                1. Download Sample Template
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pre-formatted columns, sample dishes, guidelines, and even spacing
              </Typography>
            </div>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant="contained"
                size="small"
                onClick={handleDownloadExcelTemplate}
                disabled={importing || isDownloadingTemplate}
                sx={{
                  bgcolor: "#0284C7",
                  "&:hover": { bgcolor: "#0369A1" },
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 2,
                }}
              >
                <i className="bi bi-file-earmark-excel me-1.5" aria-hidden="true" />
                {isDownloadingTemplate ? "Downloading..." : "Download Excel (.xlsx)"}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleDownloadCsvTemplate}
                disabled={importing}
                sx={{
                  color: "#475569",
                  borderColor: "#CBD5E1",
                  "&:hover": { bgcolor: "#F1F5F9", borderColor: "#94A3B8" },
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 2,
                }}
              >
                <i className="bi bi-filetype-csv me-1.5" aria-hidden="true" />
                CSV (.csv)
              </Button>
            </Box>
          </Box>
        </Box>

        {/* STEP 2: Upload File */}
        <Box
          p={2.5}
          border="1px dashed #CBD5E1"
          borderRadius={2.5}
          bgcolor="#FAFAFA"
          display="flex"
          flexDirection="column"
          gap={1.5}
        >
          <div>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0F172A" }}>
              2. Upload Completed Spreadsheet
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)
            </Typography>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={importing || parsing}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
          />
          {file && (
            <Typography variant="caption" sx={{ color: "#0284C7", fontWeight: 600 }}>
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </Typography>
          )}
        </Box>

        {feedback && (
          <InfoMessage type={feedback.type} message={feedback.message} />
        )}

        {(importing || parsing || progress > 0) && (
          <Box display="flex" flexDirection="column" gap={1}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 600, color: "#475569" }}>
                {parsing ? "Parsing spreadsheet..." : importing ? "Importing dishes..." : "Completed"}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, color: "#0284C7" }}>
                {Math.round(progress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant={parsing ? "indeterminate" : "determinate"}
              value={progress}
              sx={{ borderRadius: 1, height: 6 }}
            />
            {totalRows > 0 && (
              <Typography variant="caption" color="text.secondary">
                Processed {successCount + errorCount} of {totalRows} dishes ({successCount} successful, {errorCount} skipped)
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, bgcolor: "#F8FAFC" }}>
        <Button onClick={handleClose} disabled={importing} color="inherit" sx={{ textTransform: "none", fontWeight: 600 }}>
          Close
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={!file || importing || parsing}
          sx={{
            bgcolor: "#0284C7",
            "&:hover": { bgcolor: "#0369A1" },
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 2,
            px: 3,
          }}
        >
          {parsing ? "Reading File..." : importing ? "Importing..." : "Start Import"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CsvImportModal;
