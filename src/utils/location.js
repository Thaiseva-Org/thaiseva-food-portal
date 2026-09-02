export const extractCityFromPlace = (place) => {
  if (!place || !place.address_components) return "";
  const cityComponent = place.address_components.find(
    (component) =>
      component.types.includes("locality") ||
      component.types.includes("administrative_area_level_2") ||
      component.types.includes("postal_town")
  );
  return cityComponent ? cityComponent.long_name : "";
};
