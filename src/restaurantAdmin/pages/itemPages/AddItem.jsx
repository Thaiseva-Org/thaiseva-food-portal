import { doc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, storage } from "../../../../firebaseConfig";
import { useAuth } from "../../../AuthContext";
import { useNotifications } from "../../../context/NotificationsProvider";
import Template from "./Template";

const AddItem = () => {
  const { resData } = useAuth();
  const { CreateNewNotification } = useNotifications();
  const [itemName, setItemName] = useState("");
  const [itemId, setItemId] = useState("");
  const [price, setPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [category, setCategory] = useState("");
  const [itemType, setItemType] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const navigate = useNavigate();
  const { id } = useParams();

  const generateUniqueId = () => {
    const timestamp = Date.now().toString();
    const randomPart = Math.floor(Math.random() * 1000);
    return (timestamp + randomPart).slice(-6);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const imageUrl = URL.createObjectURL(selectedFile);
      setImage(imageUrl); // Set preview URL
      setImageFile(selectedFile); // Set actual file
      setDropdownOpen(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files[0]) {
      setImage(e.dataTransfer.files[0]);
      setDropdownOpen(false); // Close dropdown after dropping
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAddItem = async () => {
    if (
      !itemName ||
      !itemId ||
      !price ||
      !category ||
      !itemType ||
      !description
    ) {
      alert("Please fill all fields.");
      return;
    }

    try {
      let imageUrl = "";

      // Use imageFile for upload instead of image
      if (imageFile) {
        const imageRef = ref(storage, `images/${itemId}`);
        const uploadTask = uploadBytesResumable(imageRef, imageFile);

        setUploading(true);
        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log(`Upload is ${progress}% done`);
            },
            (error) => {
              console.error("Upload failed:", error);
              reject(error);
            },
            async () => {
              imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
      }
      await saveItemData(imageUrl);
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Failed to add item. Please try again.");
    }
  };

  useEffect(() => {
    setItemId(generateUniqueId());
  }, []);

  const docItemId = itemId.replace("#", "");

  const saveItemData = async (imageUrl) => {
    await setDoc(doc(db, `food_items/${resData.id}/items/${docItemId}`), {
      itemName,
      itemId,
      price: price,
      discount: discount,
      category,
      itemType,
      description,
      imageUrl,
      active: false,
    });
    alert("Item added successfully!");
    await CreateNewNotification(
      `New Item Added`,
      `${resData.name} added a new item in menu.`,
      "nitem",
      "",
      "admin",
      imageUrl
    );
    navigate(`/${id}/fooditem`);
  };

  return (
    <Template
      image={image}
      setDescription={setDescription}
      setDiscount={setDiscount}
      setDropdownOpen={setDropdownOpen}
      setItemId={setItemId}
      setItemName={setItemName}
      setCategory={setCategory}
      setPrice={setPrice}
      dropdownOpen={dropdownOpen}
      uploading={uploading}
      handleAddItem={handleAddItem}
      handleDragOver={handleDragOver}
      handleDrop={handleDrop}
      handleFileChange={handleFileChange}
      itemId={itemId}
      itemName={itemName}
      itemType={itemType}
      price={price}
      discount={discount}
      category={category}
      description={description}
      setItemType={setItemType}
    />
  );
};

export default AddItem;
