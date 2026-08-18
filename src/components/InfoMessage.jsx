const alertStyles = {
  success: "bg-success-50 border-success-500 text-success-700",
  warning: "bg-warning-50 border-warning-500 text-warning-700",
  error: "bg-danger-50 border-danger-500 text-danger-700",
  info: "bg-brand-50 border-brand-500 text-brand-800",
};

const InfoMessage = ({ type = "info", message }) => {
  const isError = type === "error";
  return (
    <div
      className={`flex items-center justify-center p-3 rounded-xl border ${
        alertStyles[type] || alertStyles.info
      }`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      <p className="font-medium text-sm">{message}</p>
    </div>
  );
};

export default InfoMessage;
