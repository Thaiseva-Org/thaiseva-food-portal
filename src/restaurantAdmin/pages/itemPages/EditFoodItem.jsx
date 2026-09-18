import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { db, storage } from "../../../../firebaseConfig";
import { useAuth } from "../../../AuthContext";
import { updateFoodItem } from "../../../api";
import { useKitchenScope } from "../../../hooks/useKitchenScope";
import { getMenuRootId } from "../../../utils/tenant";
import { partnerPath } from "../../../utils/partnerRoutes";
import { PLATFORM_OWNER_ID } from "../../../utils/platformRestaurant";
import Template from "./Template";

const EditItem = () => {
  const { roleData, currentUser, resData, isMasterAdmin } = useAuth();
  const itemidParam = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const itemid = decodeURIComponent(itemidParam["itemId"]);
  const kitchen = useKitchenScope();
  const explicitOwnerUid =
    location.state?.ownerUid || searchParams.get("ownerUid");
  const ownerUid =
    (isMasterAdmin && explicitOwnerUid) ||
    (isMasterAdmin ? PLATFORM_OWNER_ID :
    kitchen.ownerUid || getMenuRootId({ currentUser, roleData, resData }));
  const cleanItemId = String(itemid).replace("#", "");
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState(0);
  const [category, setCategory] = useState("");
  const [itemType, setItemType] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [loadingItem, setLoadingItem] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [cuisine, setCuisine] = useState("");

  useEffect(() => {
    document.title = "Thaiseva | Edit menu item";
    const fetchItemData = async () => {
      setLoadingItem(true);
      try {
        const docRef = doc(db, "food_items", ownerUid, "items", cleanItemId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setItemName(data.itemName || "");
          setPrice(data.price ?? "");
          setDiscount(data.discount ?? 0);
          setCategory(data.category || "");
          setItemType(data.itemType || "");
          setDescription(data.description || "");
          setActive(Boolean(data.active));
          setImage(data.imageUrl || null);
          setCuisine(data.cuisine || "");
        } else {
          setFormError("No such item exists.");
        }
      } catch (error) {
        console.error("Error fetching item data:", error);
        setFormError("Could not load this item.");
      } finally {
        setLoadingItem(false);
      }
    };

    if (ownerUid && cleanItemId) fetchItemData();
  }, [cleanItemId, ownerUid]);

  const applyImageFile = (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setFormError("Only image files are allowed (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Image must be under 5MB.");
      return;
    }
    setFormError(null);
    if (image && typeof image === "string" && image.startsWith("blob:")) {
      URL.revokeObjectURL(image);
    }
    setImage(URL.createObjectURL(file));
    setImageFile(file);
    setDropdownOpen(false);
  };

  const handleFileChange = (e) => {
    applyImageFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyImageFile(e.dataTransfer.files?.[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clearImage = () => {
    if (image && typeof image === "string" && image.startsWith("blob:")) {
      URL.revokeObjectURL(image);
    }
    setImage(null);
    setImageFile(null);
  };

  const validate = () => {
    const errors = {};
    if (!String(itemName || "").trim()) errors.itemName = "Enter a dish name.";
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) errors.price = "Enter a price greater than 0.";
    const d = Number(discount);
    if (!Number.isFinite(d) || d < 0 || d > 100) {
      errors.discount = "Discount must be between 0 and 100.";
    }
    if (!String(category || "").trim()) errors.category = "Choose or add a category.";
    if (!itemType) errors.itemType = "Select Veg or Non Veg.";
    if (!String(description || "").trim()) {
      errors.description = "Add a short description for customers.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditItem = async () => {
    setFormError(null);
    setFormSuccess(null);
    if (!validate()) {
      setFormError("Please fix the highlighted fields.");
      return;
    }

    try {
      let imageUrl = typeof image === "string" ? image : "";
      setUploading(true);
      setUploadProgress(0);

      if (imageFile) {
        const imageRef = ref(
          storage,
          `restaurants/${ownerUid}/items/${cleanItemId}`
        );
        const uploadTask = uploadBytesResumable(imageRef, imageFile);

        imageUrl = await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(Math.round(progress));
            },
            (error) => {
              console.error("Upload failed:", error);
              reject(error);
            },
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
        });
      }

      await updateFoodItem({
        ownerUid,
        itemId: cleanItemId,
        itemName: String(itemName).trim(),
        price: Number(price),
        discount: Number(discount) || 0,
        category: String(category).trim(),
        cuisine: String(cuisine).trim(),
        itemType,
        description: String(description).trim(),
        imageUrl,
        active,
      });

      setFormSuccess("Item updated successfully.");
      setTimeout(() => navigate(kitchen.listPath || partnerPath("foodItem")), 700);
    } catch (error) {
      console.error("Error updating item:", error);
      setFormError(error.message || "Failed to update item. Please try again.");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Template
      image={image}
      setDescription={setDescription}
      setDiscount={setDiscount}
      setDropdownOpen={setDropdownOpen}
      setItemName={setItemName}
      setCategory={setCategory}
      setPrice={setPrice}
      dropdownOpen={dropdownOpen}
      uploading={uploading}
      uploadProgress={uploadProgress}
      handleAddItem={handleEditItem}
      handleDragOver={handleDragOver}
      handleDrop={handleDrop}
      handleFileChange={handleFileChange}
      clearImage={clearImage}
      itemId={cleanItemId}
      itemName={itemName}
      itemType={itemType}
      price={price}
      discount={discount}
      category={category}
      description={description}
      setItemType={setItemType}
      submitBtn="Update menu item"
      fieldErrors={fieldErrors}
      formError={formError}
      formSuccess={formSuccess}
      mode="edit"
      loadingItem={loadingItem}
      active={active}
      setActive={setActive}
      cuisine={cuisine}
      setCuisine={setCuisine}
    />
  );
};

export default EditItem;
