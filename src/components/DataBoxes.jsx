import KpiStatCard from "./dashboard/KpiStatCard";

const DataBoxes = ({ data, title, icon, color = "blue", selected = false }) => (
  <KpiStatCard
    title={title}
    value={data}
    tone={color}
    selected={selected}
    icon={<i className={`bi ${icon}`} aria-hidden="true" />}
  />
);

export default DataBoxes;
