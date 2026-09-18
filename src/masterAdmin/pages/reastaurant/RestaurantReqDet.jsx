import { customAlert } from "../../../utils/alertService";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { db } from "../../../../firebaseConfig";
import ViewFoodItem from "../../component/ViewItem";
import InfoMessage from "../../../components/InfoMessage";
import Loading from "../../../components/Loading";
import StatusBadge from "../../../components/StatusBadge";
import { reviewRestaurantApplication } from "../../../api";
import { useResolvedApplicationFileUrl } from "../../../utils/applicationFiles";

const CoverPhoto = ({ src, alt }) => {
  const resolved = useResolvedApplicationFileUrl(src);
  return (
    <img
      src={resolved || "https://via.placeholder.com/500x300?text=No+Image"}
      alt={alt}
      className="h-56 sm:h-64 w-full object-cover"
    />
  );
};

const DetailRow = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
      {label}
    </p>
    <p className="mt-0.5 text-sm font-medium text-ink break-words">
      {value || "—"}
    </p>
  </div>
);

const DocLink = ({ label, url, name }) => {
  const resolved = useResolvedApplicationFileUrl(url);
  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-3 py-3 min-w-0">
        <p className="text-xs font-semibold text-ink-subtle">{label}</p>
        <p className="text-sm text-ink-muted mt-1">Not provided</p>
      </div>
    );
  }
  const href = resolved || url;
  const isImage = /\.(jpe?g|png|gif|webp)(\?|$)/i.test(String(url));
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-neutral-100 bg-white p-3 hover:border-brand-200 hover:shadow-sm transition-all min-w-0"
    >
      <p className="text-xs font-semibold text-ink-subtle">{label}</p>
      <div className="mt-2 flex items-center gap-3 min-w-0">
        {isImage && resolved ? (
          <img
            src={resolved}
            alt=""
            className="h-12 w-12 rounded-lg object-cover border border-neutral-100 shrink-0"
          />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600 shrink-0">
            <i className="bi bi-file-earmark-pdf text-xl" aria-hidden="true" />
          </span>
        )}
        <span className="text-sm font-semibold text-brand-700 truncate" title={name || url}>
          {name || "Open document"}
        </span>
      </div>
    </a>
  );
};

const RestaurantReqDet = () => {
  const { id } = useParams();
  const ownerId = id;
  const navigate = useNavigate();
  const [restaurantData, setRestaurantData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [commission, setCommission] = useState(10);
  const [username, setUsername] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isApplication, setIsApplication] = useState(false);
  const [createdAccount, setCreatedAccount] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    document.title = "Thaiseva | Restaurant Request";
  }, []);

  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        const appSnap = await getDoc(doc(db, "restaurantApplications", ownerId));
        if (appSnap.exists() && appSnap.data()?.status !== "Draft") {
          const data = { applicationId: appSnap.id, ...appSnap.data() };
          setRestaurantData(data);
          setIsApplication(true);
          setUsername(data.ownerName || "");
          setLoginEmail(data.emailId || "");
          return;
        }
        const docSnap = await getDoc(doc(db, "restaurants", ownerId));
        if (docSnap.exists()) {
          setRestaurantData(docSnap.data());
          setIsApplication(false);
        }
      } catch (error) {
        console.error("Error fetching document: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurantData();
  }, [ownerId]);

  const handleAccept = async () => {
    const pct = Number(commission);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      customAlert("Enter a valid commission between 0 and 100.");
      return;
    }
    if (isApplication) {
      if (!username.trim() || !loginEmail.trim() || !password) {
        customAlert("Enter username, login email, and password to create the account.");
        return;
      }
      if (password !== confirmPassword) {
        customAlert("Passwords do not match.");
        return;
      }
    }
    if (
      !confirm(
        isApplication
          ? `Create the owner account and approve with ${pct}% commission?`
          : `Approve this restaurant with ${pct}% commission?`
      )
    ) {
      return;
    }
    try {
      setActionLoading(true);
      const result = await reviewRestaurantApplication(
        isApplication
          ? {
              applicationId: restaurantData.applicationId || ownerId,
              decision: "Verified",
              commission: pct,
              username: username.trim(),
              loginEmail: loginEmail.trim(),
              password,
            }
          : {
              ownerUid: ownerId,
              decision: "Verified",
              commission: pct,
            }
      );
      if (isApplication) {
        setCreatedAccount({
          loginEmail: result.loginEmail || loginEmail,
          username: result.username || username,
        });
      } else {
        customAlert("Request accepted and verified. Owner claims updated.");
        navigate("/foodAdmin/restaRequest");
      }
    } catch (error) {
      console.error("Error accepting request: ", error);
      customAlert(error.message || "Failed to accept request. Deploy Cloud Functions.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (confirm("Reject this restaurant request?")) {
      try {
        setActionLoading(true);
        await reviewRestaurantApplication(
          isApplication
            ? { applicationId: restaurantData.applicationId || ownerId, decision: "Rejected" }
            : { ownerUid: ownerId, decision: "Rejected" }
        );
        customAlert("Request rejected.");
        navigate("/foodAdmin/restaRequest");
      } catch (error) {
        console.error("Error rejecting request: ", error);
        customAlert(error.message || "Failed to reject request. Deploy Cloud Functions.");
      } finally {
        setActionLoading(false);
      }
    }
  };

  const fetchFoodItem = useCallback(async () => {
    try {
      let foodItemsRef = collection(db, `food_items/${ownerId || id}/items`);
      let querySnapshot = await getDocs(foodItemsRef);
      if (querySnapshot.empty && id && ownerId && id !== ownerId) {
        foodItemsRef = collection(db, `food_items/${id}/items`);
        querySnapshot = await getDocs(foodItemsRef);
      }

      if (!querySnapshot.empty) {
        const fetchedItems = querySnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setItems(fetchedItems);
      }
    } catch (error) {
      console.error("Error fetching food items:", error);
    }
  }, [id, ownerId]);

  useEffect(() => {
    fetchFoodItem();
  }, [fetchFoodItem]);

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
        <InfoMessage type="error" message="No restaurant application found." />
        <Link to="/foodAdmin/restaRequest" className="btn-outline mt-4 inline-flex">
          Back to requests
        </Link>
      </div>
    );
  }

  const docs = restaurantData.documents || {};
  const businessLicenseUrl =
    restaurantData.businessLicenseUrl || docs.businessLicense?.url;
  const businessLicenseName =
    restaurantData.businessLicenseName || docs.businessLicense?.name;
  const ownerIdDocUrl = restaurantData.ownerIdDocUrl || docs.ownerId?.url;
  const ownerIdDocName = restaurantData.ownerIdDocName || docs.ownerId?.name;
  const foodSafetyUrl =
    restaurantData.foodSafetyCertUrl || docs.foodSafetyCert?.url;
  const foodSafetyName =
    restaurantData.foodSafetyCertName || docs.foodSafetyCert?.name;

  return (
    <div className="page-shell w-full px-4 py-8 md:px-6 md:py-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
        <Link
          to="/foodAdmin/restaRequest"
          className="inline-flex items-center gap-2 text-ink-heading font-bold text-lg hover:text-brand-700"
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
          Back to requests
        </Link>
        <StatusBadge status={restaurantData.status} />
      </div>

      <section className="panel mt-6 animate-slide-up">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-w-0">
          <div className="lg:col-span-5 min-w-0">
            <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100">
              <CoverPhoto
                src={restaurantData.imageUrl || restaurantData.photo}
                alt={restaurantData.name || "Restaurant"}
              />
            </div>
            <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 px-3.5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Restaurant ID
              </p>
              <p className="text-lg font-bold text-brand-700 tabular-nums break-all">
                {restaurantData.id || "—"}
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 min-w-0 space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {restaurantData.foodType ? (
                  <span className="badge-primary">{restaurantData.foodType}</span>
                ) : null}
                {restaurantData.serviceType ? (
                  <span className="badge-neutral">{restaurantData.serviceType}</span>
                ) : null}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight break-words">
                {restaurantData.name}
              </h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailRow label="Owner name" value={restaurantData.ownerName} />
              <DetailRow
                label="Phone"
                value={
                  restaurantData.phoneNumber
                    ? `${restaurantData.phoneNumber}`
                    : null
                }
              />
              <DetailRow label="Email" value={restaurantData.emailId} />
              <DetailRow
                label="Opening hours"
                value={restaurantData.openingHours}
              />
              <DetailRow
                label="Registration #"
                value={restaurantData.businessRegistrationNumber}
              />
              <DetailRow label="Tax ID" value={restaurantData.taxId} />
            </div>

            <div>
              <h2 className="section-title text-base">Description</h2>
              <p className="mt-1.5 text-sm text-ink-muted leading-relaxed break-words whitespace-pre-wrap">
                {restaurantData.description || "—"}
              </p>
            </div>

            <div>
              <h2 className="section-title text-base">Location</h2>
              <p className="mt-1.5 text-sm text-ink-muted break-words">
                {restaurantData.location || "—"}
              </p>
              {restaurantData.landmark ? (
                <p className="mt-1 text-sm text-ink-subtle break-words">
                  Landmark: {restaurantData.landmark}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="panel mt-6">
        <h2 className="section-title mb-1">Verification documents</h2>
        <p className="page-subtext mb-4">
          Review uploaded files before approving
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
          <DocLink
            label="Business license"
            url={businessLicenseUrl}
            name={businessLicenseName}
          />
          <DocLink
            label="Owner ID"
            url={ownerIdDocUrl}
            name={ownerIdDocName}
          />
          <DocLink
            label="Food safety certificate"
            url={foodSafetyUrl}
            name={foodSafetyName}
          />
        </div>
      </section>

      <section className="panel mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="section-title">Menu items</h2>
            <p className="page-subtext mt-0.5">
              {items.length} item{items.length === 1 ? "" : "s"} on file
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMenu(true)}
            className="btn-primary"
          >
            View all menus
          </button>
        </div>
        {showMenu && (
          <ViewFoodItem
            items={items}
            ownerId={ownerId}
            onClose={() => setShowMenu(false)}
          />
        )}
      </section>

      {createdAccount && (
        <section className="panel mt-6 border-success-100 bg-success-50">
          <h2 className="section-title">Account created</h2>
          <p className="page-subtext mt-1">
            Share these credentials with the owner. They sign in at /auth.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Username</dt>
              <dd className="font-semibold">{createdAccount.username}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Login email</dt>
              <dd className="font-semibold">{createdAccount.loginEmail}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-muted">
            The password is the one you just entered. It is not stored for display.
          </p>
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={() => navigate("/foodAdmin/restaRequest")}
          >
            Back to requests
          </button>
        </section>
      )}

      {restaurantData.status === "Pending" && !createdAccount ? (
        <section className="panel mt-6">
          <h2 className="section-title mb-1">Review decision</h2>
          {isApplication && (
            <p className="page-subtext mb-4">
              Accepting creates the owner login now. Enter username and password here.
            </p>
          )}
          {isApplication && (
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Username</span>
                <input
                  className="modern-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Login email</span>
                <input
                  className="modern-input"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Password</span>
                <input
                  className="modern-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Confirm password</span>
                <input
                  className="modern-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <label
                htmlFor="commission"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Commission %
              </label>
              <input
                id="commission"
                type="number"
                min={0}
                max={100}
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className="modern-input w-28"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="btn-reject"
              >
                Reject request
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={actionLoading}
                className="btn-accept"
              >
                {actionLoading ? "Working…" : "Accept request"}
              </button>
            </div>
          </div>
        </section>
      ) : restaurantData.status === "Rejected" ? (
        <section className="panel mt-6">
          <InfoMessage
            type="error"
            message="This restaurant application has been declined."
          />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleAccept}
              disabled={actionLoading}
              className="btn-accept"
            >
              Accept request
            </button>
          </div>
        </section>
      ) : (
        <section className="panel mt-6">
          <InfoMessage
            type="success"
            message="This restaurant is already verified."
          />
        </section>
      )}
    </div>
  );
};

export default RestaurantReqDet;
