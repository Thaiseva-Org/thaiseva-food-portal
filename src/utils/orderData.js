export function formatDisplayOrderId(id) {
  if (!id) return "";
  const str = String(id).trim();
  const shaOrderId = str.match(/^ORD-([a-f0-9]{64})$/i);
  if (shaOrderId) {
    return `ORD-${shaOrderId[1].slice(0, 8).toUpperCase()}`;
  }
  if (/^[a-f0-9]{64}$/i.test(str)) {
    return str.slice(0, 8).toUpperCase();
  }
  return str;
}

export function getDeliveryMapsUrl(receiver = {}) {
  if (receiver.googleMapUrl) return String(receiver.googleMapUrl).trim();
  const point = receiver.location || {};
  const lat = point.lat ?? point.latitude ?? point._lat;
  const lng = point.lng ?? point.longitude ?? point._long;
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    : "";
}

export function formatDeliveryAddressText(receiver = {}, fallbackAddress = "") {
  const point = receiver.location || {};
  const lat = point.lat ?? point.latitude ?? point._lat;
  const lng = point.lng ?? point.longitude ?? point._long;
  const coordinates = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    ? `${lat}, ${lng}`
    : "";
  const photos = (Array.isArray(receiver.locationPhotos) ? receiver.locationPhotos : [])
    .map((photo) => typeof photo === "string" ? photo : photo?.url)
    .filter(Boolean)
    .join(", ");
  const fields = [
    ["Recipient", receiver.name],
    ["Phone", receiver.phone || receiver.phoneNumber],
    ["Address", receiver.address || fallbackAddress],
    ["Address Tag", receiver.saveAddressAs || receiver.locationType],
    ["Street / House No.", receiver.street],
    ["Building / Floor", receiver.buildingFloor],
    ["Landmark", receiver.landmark],
    ["Delivery Instructions", receiver.deliveryInstructions],
    ["Coordinates", coordinates],
    ["Google Maps", getDeliveryMapsUrl(receiver)],
    ["Location Photos", photos],
  ];
  return fields
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`)
    .join("\n");
}

export function getRestaurantMapsUrl(restaurant = {}) {
  const explicitUrl =
    restaurant.googleMapUrl ||
    restaurant.mapsUrl ||
    restaurant.mapUrl ||
    restaurant.locationUrl;
  if (explicitUrl) return String(explicitUrl).trim();

  const point =
    restaurant.coordinates ||
    (typeof restaurant.location === "object" ? restaurant.location : {}) ||
    {};
  const lat = point.lat ?? point.latitude ?? point._lat ?? restaurant.latitude;
  const lng = point.lng ?? point.longitude ?? point._long ?? restaurant.longitude;
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }

  const address = restaurant.address || restaurant.location;
  return String(address || "").trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address).trim())}`
    : "";
}

export function formatOrderAddressesText(
  receiver = {},
  fallbackAddress = "",
  restaurant = {}
) {
  const restaurantAddress =
    typeof restaurant.location === "string"
      ? restaurant.location
      : restaurant.address || "";
  const restaurantFields = [
    ["Restaurant", restaurant.name],
    ["Restaurant Address", restaurantAddress],
    ["Restaurant Google Maps", getRestaurantMapsUrl(restaurant)],
  ]
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`)
    .join("\n");
  const deliveryFields = formatDeliveryAddressText(receiver, fallbackAddress);

  return [restaurantFields, deliveryFields]
    .filter(Boolean)
    .join("\n\n");
}

export function normalizeOrder(data = {}) {
  const rawItems = Array.isArray(data.Items) && data.Items.length > 0
    ? data.Items
    : Array.isArray(data.items) && data.items.length > 0
      ? data.items
      : Array.isArray(data.orderDetails) && data.orderDetails.length > 0
        ? data.orderDetails
        : Array.isArray(data.orderItems) && data.orderItems.length > 0
          ? data.orderItems
          : Array.isArray(data.dishes) && data.dishes.length > 0
            ? data.dishes
            : data.Items && typeof data.Items === "object" && !Array.isArray(data.Items)
              ? Object.values(data.Items).filter(Boolean)
              : data.items && typeof data.items === "object" && !Array.isArray(data.items)
                ? Object.values(data.items).filter(Boolean)
                : Array.isArray(data.Items) ? data.Items : [];

  const rawGross = data.Amount ?? data.totalAmount ?? data.amount ?? data.TotalAmount ?? 0;
  const rawDelivery = Number(data.deliveryCharge ?? data.DeliveryCharge ?? 0);
  const rawSubtotal = data.foodSubtotal ?? data.subtotal ?? (Number(rawGross) > 0 ? Math.max(0, Number(rawGross) - rawDelivery) : null);

  return {
    ...data,
    timestamp: data.timestamp ?? data.createdAt,
    Amount: rawGross,
    totalAmount: rawGross,
    amount: rawGross,
    foodSubtotal: rawSubtotal,
    subtotal: rawSubtotal,
    deliveryCharge: rawDelivery,
    Location: data.Location || data.Receiver?.address || "",
    CustomerName: data.CustomerName || data.Receiver?.name || data.Sender?.name || "",
    CustomerContact: data.CustomerContact || data.Receiver?.phone || data.Receiver?.phoneNumber || "",
    CustomerEmail: data.CustomerEmail || data.Receiver?.email || data.Sender?.email || "",
    currentStatus: data.currentStatus || data.Status || data.status || "New Order",
    Status: data.Status || data.currentStatus || data.status || "New Order",
    status: data.status || data.currentStatus || data.Status || "New Order",
    Receiver: {
      ...data.Receiver,
      name: data.Receiver?.name || data.CustomerName || data.Sender?.name || "",
      phone: data.Receiver?.phone || data.Receiver?.phoneNumber || data.CustomerContact || "",
      phoneNumber: data.Receiver?.phoneNumber || data.Receiver?.phone || data.CustomerContact || "",
      email: data.Receiver?.email || data.CustomerEmail || data.Sender?.email || "",
      buildingFloor: data.Receiver?.buildingFloor || "",
      street: data.Receiver?.street || "",
      landmark: data.Receiver?.landmark || "",
      deliveryInstructions: data.Receiver?.deliveryInstructions || "",
      locationType: data.Receiver?.locationType || "",
      saveAddressAs: data.Receiver?.saveAddressAs || "",
      googleMapUrl: data.Receiver?.googleMapUrl || "",
      locationPhotos: Array.isArray(data.Receiver?.locationPhotos) ? data.Receiver.locationPhotos : [],
      location: data.Receiver?.location || null,
    },
    Restaurant: data.Restaurant
      ? {
          ...data.Restaurant,
          name: data.Restaurant.name || data.restaurantName || "",
          imageUrl: data.Restaurant.imageUrl || data.Restaurant.photo || "",
          location: data.Restaurant.location || data.Restaurant.address || "",
        }
      : null,
    restaurantName: data.restaurantName || data.Restaurant?.name || "",
    Items: (Array.isArray(rawItems) ? rawItems : []).map((item) => ({
      ...item,
      ItemName: item.ItemName || item.itemName || item.name || item.title || item.dishName || "Item",
      Price: item.Price ?? item.price ?? item.unitPrice ?? item.cost ?? 0,
      Quantity: Number(item.Quantity ?? item.quantity ?? item.qty ?? item.count ?? 1) || 1,
      discount: Number(item.discount ?? item.Discount ?? 0) || 0,
      imageUrl: String(item.imageUrl || "")
        .replace(/^\[[^\]]*\]\((.*)\)$/, "$1")
        .replace(/\\&/g, "&"),
    })),
  };
}

export function orderTime(data) {
  const value = data.timestamp ?? data.createdAt;
  const date = value?.toDate ? value.toDate() : new Date(value ?? NaN);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

export function mergeOrderDocs(groups) {
  const unique = new Map(groups.flat().map((snap) => [snap.id, snap]));
  return [...unique.values()].sort((a, b) =>
    orderTime(b.data()) - orderTime(a.data()) || b.id.localeCompare(a.id)
  );
}
