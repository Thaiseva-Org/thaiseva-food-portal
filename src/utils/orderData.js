export function normalizeOrder(data = {}) {
  return {
    ...data,
    timestamp: data.timestamp ?? data.createdAt,
    Amount: data.Amount ?? data.totalAmount ?? 0,
    Location: data.Location || data.Receiver?.address || "",
    Receiver: {
      ...data.Receiver,
      phone: data.Receiver?.phone || data.Receiver?.phoneNumber || "",
    },
    Items: (Array.isArray(data.Items) ? data.Items : []).map((item) => ({
      ...item,
      Price: item.Price ?? item.price ?? 0,
      imageUrl: String(item.imageUrl || "").replace(/^\[[^\]]*\]\((.*)\)$/, "$1").replace(/\\&/g, "&"),
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
