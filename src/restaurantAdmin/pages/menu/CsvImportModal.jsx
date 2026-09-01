import { useState, useRef } from "react";
import Papa from "papaparse";
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
import { PLATFORM_OWNER_ID } from "../../../utils/platformRestaurant";

const CsvImportModal = ({ open, onClose, onImportComplete, allRestaurants = [] }) => {
  const { isMasterAdmin } = useAuth();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [feedback, setFeedback] = useState(null);

  const TEMPLATE_HEADERS = [
    "itemId",
    "itemName",
    "price",
    "discount",
    "category",
    "itemType",
    "cuisine",
    "description",
    ...allRestaurants.map(r => `Assign: ${r.name}`)
  ];

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + TEMPLATE_HEADERS.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "menu_import_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (importing) return; // Prevent closing while importing
    resetState();
    onClose();
  };

  const handleImport = () => {
    if (!file) {
      setFeedback({ type: "error", message: "Please select a CSV file first." });
      return;
    }
    if (!isMasterAdmin) {
      setFeedback({ type: "error", message: "Only Master Admins can bulk import." });
      return;
    }

    setParsing(true);
    setFeedback(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setParsing(false);
        const rows = results.data;

        if (!rows || rows.length === 0) {
          setFeedback({ type: "warning", message: "The CSV file is empty." });
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
            // Skip invalid rows without breaking the whole loop
            errors++;
            setProgress(((i + 1) / rows.length) * 100);
            continue;
          }

          // Parse assignments
          const assigned = [];
          Object.keys(row).forEach((key) => {
            if (key.startsWith("Assign: ")) {
              const rName = key.replace("Assign: ", "").trim();
              const val = String(row[key] || "").toLowerCase().trim();
              if (val === "yes" || val === "true" || val === "1") {
                const found = allRestaurants.find((r) => r.name === rName);
                if (found) {
                  assigned.push(found.uid);
                }
              }
            }
          });

          const payload = {
            ownerUid: PLATFORM_OWNER_ID,
            itemName: itemName,
            price: Number(row.price) || 0,
            discount: Number(row.discount) || 0,
            category: String(row.category || "Uncategorized").trim(),
            itemType: String(row.itemType || "Veg").trim(),
            cuisine: String(row.cuisine || "").trim(),
            description: String(row.description || "").trim(),
            // Ensure items are imported as inactive as per requirements
            globalActive: false,
            active: false, 
            assignedRestaurants: assigned,
            restaurantStatus: assigned.reduce((acc, uid) => {
              acc[uid] = { active: false };
              return acc;
            }, {}),
          };

          const itemId = String(row.itemId || "").trim().replace("#", "");
          if (itemId) {
            payload.itemId = itemId;
          }

          try {
            if (itemId) {
              await updateFoodItem(payload);
            } else {
              await createFoodItem(payload);
            }
            success++;
          } catch (err) {
            console.error(`Failed to import row ${i + 1}:`, err);
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
            message: `Import complete: ${success} successful, ${errors} failed. Items are imported as INACTIVE so you can upload photos later.`,
          });
          if (onImportComplete) {
             onImportComplete();
          }
        } else {
          setFeedback({
            type: "error",
            message: `Import failed: 0 successful, ${errors} failed. Check your CSV format.`,
          });
        }
      },
      error: (error) => {
        setParsing(false);
        setFeedback({ type: "error", message: `Error parsing CSV: ${error.message}` });
      }
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2 }}>
        Bulk Import Menu via CSV
      </DialogTitle>
      {!importing && (
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
            color: "gray",
          }}
        >
          <CloseIcon />
        </IconButton>
      )}

      <DialogContent dividers sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Upload a CSV file to add or update menu items in bulk. 
          New items will be imported as <strong>Inactive</strong> so you can upload photos and fill missing details later.
        </Typography>

        <Box display="flex" justifyContent="space-between" alignItems="center" p={2} border="1px dashed #ccc" borderRadius={2} bgcolor="#fafafa">
          <Typography variant="body2">
            1. Download the template
          </Typography>
          <Button variant="outlined" size="small" onClick={handleDownloadTemplate} disabled={importing}>
            Download CSV
          </Button>
        </Box>

        <Box display="flex" flexDirection="column" gap={1} p={2} border="1px dashed #ccc" borderRadius={2} bgcolor="#fafafa">
          <Typography variant="body2">
            2. Upload filled CSV
          </Typography>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={importing || parsing}
            className="mt-2 text-sm"
          />
        </Box>

        {feedback && (
          <InfoMessage type={feedback.type} message={feedback.message} />
        )}

        {(importing || progress > 0) && (
          <Box display="flex" flexDirection="column" gap={1}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                {importing ? "Importing..." : "Finished"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round(progress)}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary">
              Processed {successCount + errorCount} of {totalRows} rows 
              ({successCount} success, {errorCount} failed)
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={importing} color="inherit">
          Close
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={!file || importing || parsing}
          sx={{ bgcolor: "blue-700", color: "white", "&:hover": { bgcolor: "blue-800" } }}
        >
          {importing ? "Importing..." : "Start Import"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CsvImportModal;
