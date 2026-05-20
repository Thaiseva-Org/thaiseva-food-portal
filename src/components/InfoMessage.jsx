const InfoMessage = ({ type = "info", message }) => {
  const alertStyles = {
    success: "bg-green-100 border-green-500 text-green-700",
    warning: "bg-yellow-100 border-yellow-500 text-yellow-700",
    error: "bg-red-100 border-red-500 text-red-700",
    info: "bg-blue-100 border-blue-500 text-blue-700",
  };

  return (
    <div className={`flex items-center justify-center p-3 rounded-md ${alertStyles[type]}`}>
      <p className="font-medium text-sm">{message}</p>
    </div>
  );
};

export default InfoMessage;
