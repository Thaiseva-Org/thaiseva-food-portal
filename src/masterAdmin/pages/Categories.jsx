import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import Loading from "../../components/Loading";
import InfoMessage from "../../components/InfoMessage";
import { useAuth } from "../../AuthContext";

const Categories = () => {
  const { isMasterAdmin } = useAuth();
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const docRef = doc(db, "settings", "categories");
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const categories = snapshot.data().data;
          setCategories(categories);
        }
      } catch (e) {
        console.error("Error loading categories:", e);
        setFeedback({ type: "error", message: "Categories could not be loaded." });
      } finally {
        setLoading(false);
      }
    };
    isMasterAdmin && fetchCategories();
  }, [isMasterAdmin]);
  const addCategory = async (value) => {
    const cleanValue = value.trim();
    if (!cleanValue) {
      setFeedback({ type: "error", message: "Enter a category name." });
      return;
    }
    if (
      categories.some(
        (category) => category.toLowerCase() === cleanValue.toLowerCase()
      )
    ) {
      setFeedback({ type: "warning", message: "That category already exists." });
      return;
    }
    const updatedCategories = [...categories, cleanValue];
    setSaving(true);
    try {
      const docRef = doc(db, "settings", "categories");
      await setDoc(docRef, { data: updatedCategories });
      setCategories(updatedCategories);
      setFeedback({ type: "success", message: `Category “${cleanValue}” added.` });
      setOpenModal(false);
      setNewCategory("");
    } catch (error) {
      console.error("Error adding category:", error);
      setFeedback({ type: "error", message: "The category could not be added." });
    } finally {
      setSaving(false);
    }
  };
  const deleteCategory = async (categoryToDelete) => {
    if (
      confirm(
        `Are you sure you want to delete the category: ${categoryToDelete}?`
      )
    ) {
      const updatedCategories = categories.filter(
        (category) => category !== categoryToDelete
      );
      setSaving(true);
      try {
        const docRef = doc(db, "settings", "categories");
        await setDoc(docRef, { data: updatedCategories });
        setCategories(updatedCategories);
        setFeedback({
          type: "success",
          message: `Category “${categoryToDelete}” deleted.`,
        });
      } catch (error) {
        console.error("Error deleting category:", error);
        setFeedback({ type: "error", message: "The category could not be deleted." });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleOpenModal = () => {
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setNewCategory("");
  };
  if (loading)
    return (
      <div className="py-10">
        <Loading />
      </div>
    );
  return (
    <>
      <div className="px-4 pt-8 pb-20 md:px-6 md:pt-10">
        <div>
          <h1 className="page-header">
            Categories
          </h1>
          <p className="page-subtext mt-1">Manage the menu categories available to restaurants.</p>
        </div>

        {feedback && (
          <div className="mt-5 max-w-xl">
            <InfoMessage type={feedback.type} message={feedback.message} />
          </div>
        )}

        <div className="modern-card mt-8 p-5 md:p-8">
          <div className="flex flex-wrap gap-5">
            {categories.map((category) => (
              <div key={category} className="flex">
                <p className="rounded-l-xl border border-r-0 border-neutral-200 bg-neutral-50 py-2 pl-4 pr-3 font-medium text-ink">
                  {category}
                </p>
                <button
                  type="button"
                  className="rounded-r-xl bg-danger-500 px-3 py-2 font-medium text-white shadow-sm hover:bg-danger-600 focus-ring disabled:opacity-50"
                  onClick={() => deleteCategory(category)}
                  disabled={saving}
                  aria-label={`Delete ${category}`}
                >
                  <DeleteForeverIcon />
                </button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-ink-muted">No categories have been added.</p>
            )}
            <button
              onClick={handleOpenModal}
              className="btn-primary"
              aria-label="Add category"
            >
              <AddIcon fontSize="small" /> Add category
            </button>
          </div>
        </div>
      </div>
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        aria-labelledby="responsive-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (newCategory) {
              addCategory(newCategory);
            }
          }}
        >
          <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
            Add Category
          </DialogTitle>
          <IconButton
            aria-label="close"
            onClick={handleCloseModal}
            sx={{
              position: "absolute",
              right: 0,
              top: 0,
              color: "gray",
            }}
          >
            <CloseIcon />
          </IconButton>

          <DialogContent dividers sx={{ p: { xs: 2, md: 2 } }}>
            <Grid container spacing={2} sx={{ mb: 2, mt: 0.5 }}>
              <Grid item xs={12} sm={12}>
                <TextField
                  label="Category Name"
                  type="text"
                  placeholder="Provide a name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  fullWidth
                  autoComplete="off"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              type="submit"
              autoFocus
              sx={{
                bgcolor: "blue-700",
                color: "white",
                hover: "none",
              }}
              disabled={!newCategory.trim() || saving}
              className="cursor-pointer"
            >
              {saving ? "Adding…" : "Add"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
};

export default Categories;
