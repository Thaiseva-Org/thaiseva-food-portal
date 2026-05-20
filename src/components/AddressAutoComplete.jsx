import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import { useState } from "react";

const libraries = ["places"];

const AddressAutocomplete = ({ onSelect, location, setLocation }) => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyDwTBiBiGtJLrlbaiKzVN5BBCj8He1l5Zc",
    libraries,
  });

  const [autocomplete, setAutocomplete] = useState(null);

  const onLoad = (auto) => {
    setAutocomplete(auto);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      onSelect(place);
    }
  };

  if (!isLoaded) return <p>Loading...</p>;

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      className="w-full"
    >
      <input
        type="text"
        id="location"
        autoComplete="off"
        placeholder="your address here"
        value={location}
        onChange={(e) => {
          setLocation(e.target.value);
        }}
        className="shadow appearance-none border rounded w-[100%] py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline "
      />
    </Autocomplete>
  );
};

export default AddressAutocomplete;
