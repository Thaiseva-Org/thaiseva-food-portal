/**
 * Vite/ESM interop for react-apexcharts: the default export is often a module
 * object (`{ default: Component }`) rather than the component itself, which
 * causes: "Element type is invalid ... got: object".
 */
import ApexImport from "react-apexcharts";

const ReactApexChart =
  typeof ApexImport === "function"
    ? ApexImport
    : ApexImport?.default && typeof ApexImport.default === "function"
      ? ApexImport.default
      : null;

export default function SafeApexChart(props) {
  if (!ReactApexChart) {
    return (
      <p className="flex items-center justify-center w-full h-[350px] text-sm text-slate-500">
        Chart library failed to load.
      </p>
    );
  }
  return <ReactApexChart {...props} />;
}
