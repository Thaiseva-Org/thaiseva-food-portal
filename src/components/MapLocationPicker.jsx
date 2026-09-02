import { useJsApiLoader, GoogleMap, Marker, Autocomplete } from "@react-google-maps/api";
import { useState } from "react";
import { getGoogleMapsApiKey } from "../utils/tenant";
import { MdMyLocation } from "react-icons/md";

const libraries = ["places"];
const mapContainerStyle = { width: "100%", height: "300px", borderRadius: "12px" };
const defaultCenter = { lat: 13.7563, lng: 100.5018 }; // Bangkok

const MapLocationPickerInner = ({ apiKey, location, setLocation, onPlaceSelect, onMapClick, latitude, longitude }) => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: apiKey, libraries });
  const [autocomplete, setAutocomplete] = useState(null);

  const center = latitude != null && longitude != null ? { lat: latitude, lng: longitude } : defaultCenter;

  if (!isLoaded) return <p className="text-sm text-ink-muted p-4">Loading map...</p>;

  return (
    <div className="flex flex-col gap-3">
      <Autocomplete
        onLoad={setAutocomplete}
        onPlaceChanged={() => {
          if (autocomplete !== null) {
            const place = autocomplete.getPlace();
            onPlaceSelect(place);
          }
        }}
        className="w-full"
      >
        <input
          type="text"
          placeholder="Search your restaurant location..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="modern-input"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
      </Autocomplete>
      <div className="relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={latitude != null ? 16 : 11}
          onClick={(e) => onMapClick(e.latLng.lat(), e.latLng.lng())}
          options={{ disableDefaultUI: true, zoomControl: true }}
        >
          {latitude != null && longitude != null && (
             <Marker 
               position={center} 
               draggable={true} 
               onDragEnd={(e) => onMapClick(e.latLng.lat(), e.latLng.lng())}
             />
          )}
        </GoogleMap>
        <button
          type="button"
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition((pos) => {
                onMapClick(pos.coords.latitude, pos.coords.longitude);
              });
            }
          }}
          className="absolute bottom-4 right-4 bg-white p-2 rounded-full shadow-md text-brand-600 hover:bg-brand-50"
          title="Current Location"
        >
          <MdMyLocation size={24} />
        </button>
      </div>
    </div>
  );
};

const MapLocationPicker = (props) => {
  const apiKey = getGoogleMapsApiKey();
  return <MapLocationPickerInner apiKey={apiKey} {...props} />;
};

export default MapLocationPicker;
