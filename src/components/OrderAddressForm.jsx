import React, { useState } from "react";
import { 
  MdOutlineContactPage, 
  MdHome, 
  MdBusinessCenter, 
  MdNavigation,
  MdLocationOn,
  MdCameraAlt
} from "react-icons/md";

const OrderAddressForm = ({ onSave }) => {
  const [formData, setFormData] = useState({
    useAccountDetails: false,
    receiverName: "",
    receiverNumber: "",
    locationType: "House",
    buildingFloor: "",
    street: "",
    areaLocality: "Motilal Nehru Nagar, Motilal Nehru Nagar, Begumpet, Hyderabad, Telangana, India",
    saveAddressAs: "",
    googleMapUrl: "",
    deliveryInstructions: "",
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleLocationType = (type) => {
    setFormData(prev => ({ ...prev, locationType: type }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) onSave(formData);
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen text-gray-800 font-sans pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-10">
        <button className="mr-3 p-1 rounded-full hover:bg-gray-100 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex flex-col">
          <h1 className="font-semibold text-lg leading-tight">Motilal Nehru Nagar</h1>
          <p className="text-xs text-gray-500 truncate w-64">Motilal Nehru Nagar, Begumpet, Hyderabad...</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Receiver Details */}
        <section>
          <h2 className="font-bold text-gray-900 mb-3 text-lg">Receiver Details</h2>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="checkbox" 
                name="useAccountDetails"
                checked={formData.useAccountDetails}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black"
              />
              <span className="text-gray-700 font-medium">Use my account details</span>
            </label>

            <div className="relative">
              <input 
                type="text" 
                name="receiverName"
                value={formData.receiverName}
                onChange={handleChange}
                placeholder="Receiver name *"
                className="w-full border border-gray-200 rounded-lg p-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                required
              />
            </div>

            <div className="relative flex items-center">
              <input 
                type="tel" 
                name="receiverNumber"
                value={formData.receiverNumber}
                onChange={handleChange}
                placeholder="Receiver's number *"
                className="w-full border border-gray-200 rounded-lg p-3 pr-10 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                required
              />
              <button type="button" className="absolute right-3 text-gray-400 hover:text-black transition-colors">
                <MdOutlineContactPage size={22} />
              </button>
            </div>
          </div>
        </section>

        {/* Location Details */}
        <section>
          <h2 className="font-bold text-gray-900 mb-3 text-lg">Location Details</h2>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
            
            {/* Tabs */}
            <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
              {['House', 'Office', 'Other'].map((type) => {
                const isActive = formData.locationType === type;
                const Icon = type === 'House' ? MdHome : type === 'Office' ? MdBusinessCenter : MdNavigation;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleLocationType(type)}
                    className={`flex-1 flex items-center justify-center space-x-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                      isActive ? 'bg-black text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{type}</span>
                  </button>
                );
              })}
            </div>

            <input 
              type="text" 
              name="buildingFloor"
              value={formData.buildingFloor}
              onChange={handleChange}
              placeholder="Building / Floor *"
              className="w-full border border-gray-200 rounded-lg p-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              required
            />

            <input 
              type="text" 
              name="street"
              value={formData.street}
              onChange={handleChange}
              placeholder="Street (Recommended)"
              className="w-full border border-gray-200 rounded-lg p-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
            />

            <div className="flex space-x-2">
              <div className="relative flex-1 border border-gray-200 rounded-lg p-3">
                <span className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-400">Area/Locality</span>
                <p className="text-gray-600 text-sm leading-snug h-16 overflow-hidden">
                  {formData.areaLocality}
                </p>
              </div>
              <button 
                type="button" 
                className="w-24 h-24 flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <MdLocationOn size={24} className="text-blue-600 mb-1" />
                <span className="text-blue-600 text-sm font-semibold">Change</span>
              </button>
            </div>

            <input 
              type="text" 
              name="saveAddressAs"
              value={formData.saveAddressAs}
              onChange={handleChange}
              placeholder="Save address as *"
              className="w-full border border-gray-200 rounded-lg p-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
              required
            />
          </div>
        </section>

        {/* Location Photos */}
        <section>
          <div className="flex items-center space-x-2 mb-3">
            <h2 className="font-bold text-gray-900 text-lg">Location Photos</h2>
            <span className="text-gray-500 text-sm">(Recommended)</span>
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">New</span>
          </div>
          <button 
            type="button" 
            className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <span className="text-gray-500 text-sm pr-8 text-left">
              Add photos to help delivery partners reach faster
            </span>
            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center border-2 border-dashed border-blue-400 rounded-lg text-blue-500 bg-blue-50">
              <MdCameraAlt size={20} />
            </div>
          </button>
        </section>

        {/* Delivery Instructions */}
        <section>
          <div className="flex items-center space-x-2 mb-3">
            <h2 className="font-bold text-gray-900 text-lg">Delivery Instructions</h2>
            <span className="text-gray-500 text-sm">(Recommended)</span>
          </div>
          <div className="relative">
            <input 
              type="text" 
              name="deliveryInstructions"
              value={formData.deliveryInstructions}
              onChange={handleChange}
              placeholder="Instructions to reach location"
              className="w-full bg-white border border-gray-100 rounded-xl p-4 pr-16 text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
            />
            <button 
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 font-bold text-sm hover:text-blue-800 transition-colors"
            >
              Add
            </button>
          </div>
        </section>

      </div>

      {/* Footer Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] max-w-md mx-auto">
        <button 
          onClick={handleSubmit}
          className="w-full bg-gray-200 text-gray-400 font-semibold py-3.5 rounded-xl transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
        >
          Save Address
        </button>
      </div>
    </div>
  );
};

export default OrderAddressForm;
