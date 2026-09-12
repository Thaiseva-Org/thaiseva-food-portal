import { useState } from "react";
import { 
  MdPerson, 
  MdOutlineContactPage, 
  MdPeople, 
  MdChildCare, 
  MdDateRange, 
  MdAccessTime, 
  MdNotes 
} from "react-icons/md";

const TableBookingForm = ({ onSave }) => {
  const [formData, setFormData] = useState({
    customerName: "",
    phoneNumber: "",
    adults: 2,
    children: 0,
    bookingDate: "",
    bookingTime: "",
    notes: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const adjustCounter = (field, delta) => {
    setFormData(prev => {
      const newValue = prev[field] + delta;
      if (newValue < 0) return prev;
      if (field === "adults" && newValue < 1) return prev; // At least 1 adult
      return { ...prev, [field]: newValue };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) {
      // Construct scheduledAt from date and time
      const scheduledAt = new Date(`${formData.bookingDate}T${formData.bookingTime}`);
      onSave({
        ...formData,
        scheduledAt: scheduledAt.toISOString()
      });
    }
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
          <h1 className="font-semibold text-lg leading-tight">Table Reservation</h1>
          <p className="text-xs text-gray-500">Book your dine-in experience</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Guest Details */}
        <section>
          <h2 className="font-bold text-gray-900 mb-3 text-lg">Guest Details</h2>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
            
            <div className="relative flex items-center">
              <input 
                type="text" 
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                placeholder="Guest name *"
                className="w-full border border-gray-200 rounded-lg p-3 pr-10 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                required
              />
              <div className="absolute right-3 text-gray-400">
                <MdPerson size={22} />
              </div>
            </div>

            <div className="relative flex items-center">
              <input 
                type="tel" 
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="Phone number *"
                className="w-full border border-gray-200 rounded-lg p-3 pr-10 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                required
              />
              <div className="absolute right-3 text-gray-400">
                <MdOutlineContactPage size={22} />
              </div>
            </div>
          </div>
        </section>

        {/* Party Size */}
        <section>
          <h2 className="font-bold text-gray-900 mb-3 text-lg">Party Size</h2>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
            
            {/* Adults Counter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 text-gray-700">
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <MdPeople size={20} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Adults</p>
                  <p className="text-xs text-gray-500">12+ years</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 bg-gray-50 rounded-lg p-1 border border-gray-100">
                <button 
                  type="button" 
                  onClick={() => adjustCounter("adults", -1)}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-100"
                >
                  -
                </button>
                <span className="font-semibold text-gray-900 w-4 text-center">{formData.adults}</span>
                <button 
                  type="button" 
                  onClick={() => adjustCounter("adults", 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>

            {/* Children Counter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 text-gray-700">
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <MdChildCare size={20} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Children</p>
                  <p className="text-xs text-gray-500">Under 12 years</p>
                </div>
              </div>
              <div className="flex items-center space-x-4 bg-gray-50 rounded-lg p-1 border border-gray-100">
                <button 
                  type="button" 
                  onClick={() => adjustCounter("children", -1)}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-100"
                >
                  -
                </button>
                <span className="font-semibold text-gray-900 w-4 text-center">{formData.children}</span>
                <button 
                  type="button" 
                  onClick={() => adjustCounter("children", 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* Date & Time */}
        <section>
          <h2 className="font-bold text-gray-900 mb-3 text-lg">Date & Time</h2>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
            
            <div className="relative flex items-center">
              <input 
                type="date" 
                name="bookingDate"
                value={formData.bookingDate}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg p-3 pl-10 text-gray-800 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                required
              />
              <div className="absolute left-3 text-gray-400">
                <MdDateRange size={22} />
              </div>
            </div>

            <div className="relative flex items-center">
              <input 
                type="time" 
                name="bookingTime"
                value={formData.bookingTime}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg p-3 pl-10 text-gray-800 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                required
              />
              <div className="absolute left-3 text-gray-400">
                <MdAccessTime size={22} />
              </div>
            </div>

          </div>
        </section>

        {/* Special Requests */}
        <section>
          <h2 className="font-bold text-gray-900 mb-3 text-lg">Special Requests</h2>
          <div className="relative flex items-start">
            <textarea 
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="e.g. Window seat, Birthday celebration..."
              rows={3}
              className="w-full bg-white border border-gray-100 rounded-xl p-4 pl-10 text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all resize-none"
            />
            <div className="absolute left-3 top-4 text-gray-400">
              <MdNotes size={22} />
            </div>
          </div>
        </section>

      </div>

      {/* Footer Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] max-w-md mx-auto">
        <button 
          onClick={handleSubmit}
          className="w-full bg-black text-white font-semibold py-3.5 rounded-xl transition-all hover:bg-gray-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
        >
          Request Reservation
        </button>
      </div>
    </div>
  );
};

export default TableBookingForm;
