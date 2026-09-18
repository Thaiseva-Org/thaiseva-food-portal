import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { storage } from "../../../../firebaseConfig";
import { useAuth } from "../../../AuthContext";
import { createFoodItem } from "../../../api";
import { useKitchenScope } from "../../../hooks/useKitchenScope";
import { getMenuRootId } from "../../../utils/tenant";
import { partnerPath } from "../../../utils/partnerRoutes";
import { PLATFORM_OWNER_ID } from "../../../utils/platformRestaurant";
import Template from "./Template";

const AddItem = () => {
  const { resData, currentUser, roleData, isMasterAdmin } = useAuth();
  const kitchen = useKitchenScope();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const explicitOwnerUid =
    location.state?.ownerUid || searchParams.get("ownerUid");
  const [itemName, setItemName] = useState("");
  const [itemId, setItemId] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState(0);
  const [category, setCategory] = useState("");
  const [itemType, setItemType] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [cuisine, setCuisine] = useState("");
  const ownerUid =
    (isMasterAdmin && explicitOwnerUid) ||
    (isMasterAdmin ? PLATFORM_OWNER_ID :
    kitchen.ownerUid || getMenuRootId({ currentUser, roleData, resData }));

  const navigate = useNavigate();

  const generateUniqueId = () => {
    const timestamp = Date.now().toString();
    const randomPart = Math.floor(Math.random() * 1000);
    return (timestamp + randomPart).slice(-6);
  };

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

  const handleAddItem = async () => {
    setFormError(null);
    setFormSuccess(null);
    if (!validate()) {
      setFormError("Please fix the highlighted fields.");
      return;
    }
    if (!ownerUid) {
      setFormError("Restaurant account not ready. Refresh and try again.");
      return;
    }

    try {
      let imageUrl = "";
      setUploading(true);
      setUploadProgress(0);

      if (imageFile) {
        const imageRef = ref(
          storage,
          `restaurants/${ownerUid}/items/${itemId}`
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

      await createFoodItem({
        ownerUid,
        itemName: String(itemName).trim(),
        itemId: String(itemId).replace("#", ""),
        price: Number(price),
        discount: Number(discount) || 0,
        category: String(category).trim(),
        cuisine: String(cuisine).trim(),
        itemType,
        description: String(description).trim(),
        imageUrl,
      });

      setFormSuccess(
        "Item saved. It is live on the menu."
      );
      setTimeout(() => navigate(kitchen.listPath || partnerPath("foodItem")), 900);
    } catch (error) {
      console.error("Error adding item:", error);
      setFormError(error.message || "Failed to add item. Please try again.");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    setItemId(generateUniqueId());
    document.title = "Thaiseva | Add menu item";
  }, []);

  useEffect(() => {
    return () => {
      if (image && typeof image === "string" && image.startsWith("blob:")) {
        URL.revokeObjectURL(image);
      }
    };
  }, [image]);

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
      handleAddItem={handleAddItem}
      handleDragOver={handleDragOver}
      handleDrop={handleDrop}
      handleFileChange={handleFileChange}
      clearImage={clearImage}
      itemId={itemId}
      itemName={itemName}
      itemType={itemType}
      price={price}
      discount={discount}
      category={category}
      description={description}
      setItemType={setItemType}
      submitBtn="Add menu item"
      fieldErrors={fieldErrors}
      formError={formError}
      formSuccess={formSuccess}
      mode="add"
      cuisine={cuisine}
      setCuisine={setCuisine}
    />
  );
};

export default AddItem;
