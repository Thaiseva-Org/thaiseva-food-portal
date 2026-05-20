const DataBoxes = ({ data, title, icon, color }) => {
  return (
    <div className="h-full bg-white rounded-lg w-50 shadow-md">
      <div className="flex items-center justify-between w-full gap-4 p-4 py-5 rounded-lg">
        <div>
          <i
            className={`p-2 px-3 text-3xl rounded-full bi ${icon} ${
              color === "green"
                ? "text-[--green-prime-color] bg-[--green-bg-color]"
                : color === "red"
                ? "text-[--red-prime-color] bg-[--red-bg-color]"
                : color === "yellow"
                ? "text-[--yellow-prime-color] bg-[--yellow-bg-color]"
                : color === "blue"
                ? "text-[--blue-prime-color] bg-[--blue-bg-color]"
                : color === "purple"
                ? "text-[--purple-prime-color] bg-[--purple-bg-color]"
                : ""
            }`}
          ></i>
        </div>
        <div className="w-full">
          <p className="text-3xl font-bold">{data}</p>
          <p className="text-[--light-text-color] text-md">{title}</p>
        </div>
      </div>
    </div>
  );
};

export default DataBoxes;
