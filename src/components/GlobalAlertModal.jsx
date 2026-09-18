import { useEffect, useState } from "react";
import { alertService } from "../utils/alertService";
import { MdInfoOutline } from "react-icons/md";

const GlobalAlertModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [alertData, setAlertData] = useState({ message: "", title: "" });

  useEffect(() => {
    const handleAlert = (data) => {
      setAlertData(data);
      setIsOpen(true);
    };

    const unsubscribe = alertService.subscribe(handleAlert);
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm transform transition-all overflow-hidden border border-gray-100"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 text-center">
          <div className="flex items-center justify-center w-14 h-14 mx-auto bg-blue-50 rounded-full mb-5 shadow-inner">
            <MdInfoOutline className="w-7 h-7 text-blue-600" />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {alertData.title}
          </h3>
          <p className="text-gray-500 text-sm mb-6 whitespace-pre-wrap">
            {alertData.message}
          </p>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full inline-flex justify-center items-center px-6 py-2.5 border border-transparent shadow-sm text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalAlertModal;
