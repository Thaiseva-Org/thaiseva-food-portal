import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import { useState } from "react";
import { getGoogleMapsApiKey } from "../utils/tenant";

const libraries = ["places"];

const AddressInput = ({ location, setLocation }) => (
  <input
    type="text"
    id="location"
    autoComplete="street-address"
    placeholder="Your address"
    value={location}
    onChange={(e) => setLocation(e.target.value)}
    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
  />
);

const GoogleAddressAutocomplete = ({
  apiKey,
  onSelect,
  location,
  setLocation,
}) => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
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

  if (!isLoaded) return <p role="status">Loading address search...</p>;

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      className="w-full"
    >
      <AddressInput location={location} setLocation={setLocation} />
    </Autocomplete>
  );
};

const AddressAutocomplete = (props) => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return <AddressInput location={props.location} setLocation={props.setLocation} />;
  }
  return <GoogleAddressAutocomplete apiKey={apiKey} {...props} />;
};

export default AddressAutocomplete;
