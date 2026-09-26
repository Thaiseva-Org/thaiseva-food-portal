import { customAlert } from "../../utils/alertService";
import { useState, useEffect } from "react";
import { RestaImg } from "../../assets";
import { Link } from "react-router";
import { db } from "../../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import Addrestaurant from "./restaurantPages/Addrestaurant";
import Loading from "../../components/Loading";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../AuthContext";
import { setRestaurantOpenState } from "../../api";
import { partnerPath } from "../../utils/partnerRoutes";
import { useResolvedApplicationFileUrl } from "../../utils/applicationFiles";
import AccountSettings from "../../components/AccountSettings";

const DocumentChip = ({ label, url }) => {
  const href = useResolvedApplicationFileUrl(url);
  if (!url) return null;
  return (
    <a
      href={href || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-ghost text-xs py-1.5 px-3"
    >
      <i className="bi bi-file-earmark-text" aria-hidden="true" />
      {label}
    </a>
  );
};

const InfoTile = ({ icon, label, value, title }) => (
  <div className="min-w-0 rounded-xl border border-neutral-100 bg-neutral-50/80 p-3.5 sm:p-4">
    <div className="flex items-start gap-3 min-w-0">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 text-lg"
        aria-hidden="true"
      >
        <i className={`bi ${icon}`} />
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {label}
        </p>
        <p
          className="mt-1 text-sm sm:text-base font-semibold text-ink break-words"
          title={title || (typeof value === "string" ? value : undefined)}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  </div>
);

const Restaurant = () => {
  const { isRestaurantAdmin, currentUser: authUser, roleData } = useAuth();
  const currentUser = authUser?.uid;
  const [toggle, setToggle] = useState(false);
  const [restaurantData, setRestaurantData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    document.title = "Thaiseva | Settings";
  }, []);

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDoc(doc(db, "restaurants", currentUser));
        const data = querySnapshot.data();
        if (data) {
          const restaurant = { ...data };
          setToggle(Boolean(restaurant?.active));
          setRestaurantData(restaurant);
        } else {
          setRestaurantData(null);
        }
      } catch (error) {
        console.error("Error fetching restaurant data:", error);
      } finally {
        setLoading(false);
      }
    };

    // Load for verified owners OR applicants (pending) so status is visible
    if (
      currentUser &&
      (isRestaurantAdmin ||
        roleData?.restaurantId ||
        roleData?.applicationStatus)
    ) {
      fetchRestaurantData();
    }
  }, [currentUser, isRestaurantAdmin, roleData]);

  const handleToggle = async () => {
    if (toggling) return;
    const previous = toggle;
    const newActiveState = !toggle;
    try {
      setToggling(true);
      setToggle(newActiveState);
      await setRestaurantOpenState({
        ownerUid: authUser?.uid || currentUser,
        active: newActiveState,
      });
    } catch (error) {
      console.error("Error updating active state:", error);
      setToggle(previous);
      customAlert(error.message || "Failed to update open/closed state.");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell w-full px-4 py-8 md:px-6 md:py-10">
        <div className="h-48 flex items-center justify-center">
          <Loading />
        </div>
      </div>
    );
  }

  if (!restaurantData) {
    return (
      <div className="page-shell w-full px-4 py-8 md:px-6 md:py-10">
        <Addrestaurant />
      </div>
    );
  }

  const isVerified = restaurantData.status === "Verified";
  const phoneDisplay = restaurantData.phoneNumber
    ? `${restaurantData.phoneNumber}`
    : "—";
  const commission = restaurantData.comission ?? restaurantData.commission ?? 0;

  return (
    <div className="page-shell w-full px-4 py-8 md:px-6 md:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="page-header">Settings</h1>
          <p className="page-subtext mt-1">
            Manage your restaurant profile, store availability, and account security.
          </p>
        </div>

        {isVerified && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <span
              className={`badge ${
                toggle ? "badge-success" : "badge-danger"
              }`}
            >
              {toggle ? "Open for orders" : "Closed"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={toggle}
              aria-label={
                toggle ? "Close restaurant for orders" : "Open restaurant for orders"
              }
              disabled={toggling}
              onClick={handleToggle}
              className={`relative inline-flex h-9 w-[4.25rem] shrink-0 items-center rounded-full border transition-colors duration-fast focus-ring disabled:opacity-60 ${
                toggle
                  ? "bg-success-500 border-success-600"
                  : "bg-danger-500 border-danger-600"
              }`}
            >
              <span className="sr-only">{toggle ? "Open" : "Closed"}</span>
              <span
                className={`absolute left-1.5 text-[10px] font-bold uppercase tracking-wide text-white transition-opacity ${
                  toggle ? "opacity-100" : "opacity-0"
                }`}
              >
                On
              </span>
              <span
                className={`absolute right-1.5 text-[10px] font-bold uppercase tracking-wide text-white transition-opacity ${
                  toggle ? "opacity-0" : "opacity-100"
                }`}
              >
                Off
              </span>
              <span
                className={`pointer-events-none absolute top-0.5 h-7 w-7 rounded-full bg-white shadow-md transition-transform duration-fast ${
                  toggle ? "translate-x-[2.15rem]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Status callout for non-verified */}
      {!isVerified && (
        <div
          className={`mt-6 rounded-xl border px-4 py-3 text-sm font-medium min-w-0 ${
            restaurantData.status === "Rejected"
              ? "border-danger-100 bg-danger-50 text-danger-700"
              : "border-warning-100 bg-warning-50 text-warning-700"
          }`}
          role="status"
        >
          {restaurantData.status === "Rejected"
            ? "Your application was rejected. Update your details or contact support."
            : "Your restaurant is pending verification. You can still review the profile below."}
        </div>
      )}

      {/* Profile card */}
      <div className="mt-8 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-ink">Restaurant Profile</h2>
        <p className="text-sm text-ink-muted">Public details and verification documents.</p>
      </div>
      <section className="panel animate-slide-up">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-w-0">
          {/* Cover image */}
          <div className="lg:col-span-5 min-w-0">
            <div className="relative overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100 shadow-sm">
              <img
                src={restaurantData.imageUrl || RestaImg}
                alt={restaurantData.name || "Restaurant"}
                className="h-56 sm:h-64 lg:h-[20rem] w-full object-cover object-center"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-950/70 via-brand-950/20 to-transparent p-4 pt-16">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={restaurantData.status} />
                  {isVerified && (
                    <span
                      className={`badge ${
                        toggle ? "badge-success" : "badge-neutral"
                      } bg-white/95`}
                    >
                      {toggle ? "Accepting orders" : "Not accepting"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-7 min-w-0 flex flex-col">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusBadge status={restaurantData.status} />
                {restaurantData.foodType ? (
                  <span className="badge-primary">{restaurantData.foodType}</span>
                ) : null}
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-ink tracking-tight break-words"
                title={restaurantData.name}
              >
                {restaurantData.name || "Unnamed restaurant"}
              </h2>
            </div>

            <div className="mt-5 min-w-0">
              <h3 className="section-title text-base">Description</h3>
              <p className="mt-1.5 text-sm sm:text-base text-ink-muted leading-relaxed break-words whitespace-pre-wrap">
                {restaurantData.description || "No description provided."}
              </p>
            </div>

            <div className="mt-5 min-w-0">
              <h3 className="section-title text-base flex items-center gap-2">
                <i className="bi bi-geo-alt text-brand-500" aria-hidden="true" />
                Location
              </h3>
              <p
                className="mt-1.5 text-sm sm:text-base text-ink-muted leading-relaxed break-words"
                title={restaurantData.location}
              >
                {restaurantData.location || "—"}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 min-w-0">
              {restaurantData.ownerName ? (
                <InfoTile
                  icon="bi-person-badge"
                  label="Owner"
                  value={restaurantData.ownerName}
                />
              ) : null}
              <InfoTile
                icon="bi-telephone"
                label="Phone"
                value={phoneDisplay}
              />
              <InfoTile
                icon="bi-envelope"
                label="Email"
                value={restaurantData.emailId}
                title={restaurantData.emailId}
              />
              {restaurantData.serviceType ? (
                <InfoTile
                  icon="bi-bicycle"
                  label="Service"
                  value={restaurantData.serviceType}
                />
              ) : null}
              {restaurantData.openingHours ? (
                <InfoTile
                  icon="bi-clock"
                  label="Hours"
                  value={restaurantData.openingHours}
                />
              ) : null}
              <InfoTile
                icon="bi-percent"
                label="Commission"
                value={`${commission}% per order`}
              />
              {restaurantData.businessRegistrationNumber ? (
                <InfoTile
                  icon="bi-building"
                  label="Registration #"
                  value={restaurantData.businessRegistrationNumber}
                />
              ) : null}
            </div>

            {(restaurantData.businessLicenseUrl ||
              restaurantData.ownerIdDocUrl ||
              restaurantData.documents) && (
              <div className="mt-6 min-w-0">
                <h3 className="section-title text-base mb-3">Documents on file</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      label: "Business license",
                      url:
                        restaurantData.businessLicenseUrl ||
                        restaurantData.documents?.businessLicense?.url,
                    },
                    {
                      label: "Owner ID",
                      url:
                        restaurantData.ownerIdDocUrl ||
                        restaurantData.documents?.ownerId?.url,
                    },
                    {
                      label: "Food safety cert",
                      url:
                        restaurantData.foodSafetyCertUrl ||
                        restaurantData.documents?.foodSafetyCert?.url,
                    },
                  ]
                    .filter((d) => d.url)
                    .map((d) => (
                      <DocumentChip key={d.label} label={d.label} url={d.url} />
                    ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-8 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <Link to={partnerPath()} className="btn-outline w-full sm:w-auto">
                <i className="bi bi-speedometer2" aria-hidden="true" />
                Dashboard
              </Link>
              <Link
                to={partnerPath("restaurant", "edit")}
                className="btn-edit w-full sm:w-auto"
              >
                <i className="bi bi-pencil" aria-hidden="true" />
                Edit restaurant info
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Account Settings Section */}
      <section className="mt-8 animate-slide-up">
        <div className="mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-ink">Account Settings</h2>
          <p className="text-sm text-ink-muted">Manage your account security.</p>
        </div>
        <AccountSettings roleLabel="Restaurant Partner" embedded />
      </section>
    </div>
  );
};

export default Restaurant;
