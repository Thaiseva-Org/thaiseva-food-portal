const statusStyles = {
  "New Order": "badge-primary",
  "Order Confirm": "badge-warning",
  Preparing: "badge-warning",
  "Ready for pickup": "badge-primary",
  "Out for Delivery": "badge-warning",
  Delivered: "badge-success",
  Accepted: "badge-success",
  Cancelled: "badge-danger",
  Canceled: "badge-danger",
  Rejected: "badge-danger",
  Pending: "badge-warning",
  Verified: "badge-success",
  Active: "badge-success",
  Inactive: "badge-neutral",
};

const StatusBadge = ({ status }) => (
  <span className={statusStyles[status] || "badge-neutral"}>
    {status || "Unknown"}
  </span>
);

export default StatusBadge;
