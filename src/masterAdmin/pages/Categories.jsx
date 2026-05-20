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
import { useAuth } from "../../AuthContext";

const Categories = () => {
  const { isMasterAdmin } = useAuth();
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [loading, setLoading] = useState(true);
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
        console.log(e);
      } finally {
        setLoading(false);
      }
    };
    isMasterAdmin && fetchCategories();
  }, [isMasterAdmin]);
  const addCategory = async (value) => {
    if (categories.includes(value.trim())) {
      alert("This category already exists!");
      return;
    }
    if (confirm(`Are you sure you want to add the category: ${value}?`)) {
      const updatedCategories = [...categories, value];
      setCategories(updatedCategories);
      try {
        const docRef = doc(db, "settings", "categories");
        await setDoc(docRef, { data: updatedCategories });
        alert(`Category "${value}" added successfully.`);
      } catch (e) {
        console.log(e);
      }
    }
    setOpenModal(false);
    setNewCategory("");
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
      setCategories(updatedCategories);

      try {
        const docRef = doc(db, "settings", "categories");
        await setDoc(docRef, { data: updatedCategories });
        alert(`Category "${categoryToDelete}" deleted successfully.`);
      } catch (error) {
        console.error("Error deleting category:", error);
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
      <div className="px-6 pt-10 pb-20">
        <div>
          <p className="lg:text-3xl md:text-2xl font-bold text-[var(--main-headings-color)]">
            Categories
          </p>
        </div>

        <div className="bg-white shadow-md p-4 py-10 mt-10 rounded-lg">
          <div className="flex flex-wrap gap-5">
            {categories.map((category, index) => (
              <div key={index} className="flex">
                <p className="bg-gray-300 rounded-l-xl shadow-sm pl-5 pr-3 font-medium py-2">
                  {category}
                </p>
                <div
                  className="bg-red-400 hover:bg-red-500 rounded-r-xl text-white cursor-pointer shadow-sm px-3 font-medium py-2"
                  onClick={() => deleteCategory(category)}
                >
                  <DeleteForeverIcon />
                </div>
              </div>
            ))}
            <button
              onClick={handleOpenModal}
              className="bg-blue-500 hover:bg-blue-700 text-white rounded-xl shadow-sm px-5 font-bold py-2"
            >
              <AddIcon fontSize="medium" />
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
                  onChange={(e) => setNewCategory(() => e.target.value)}
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
              disabled={newCategory === ""}
              className="cursor-pointer"
            >
              Add
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
};

export default Categories;
