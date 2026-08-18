import {
  collection,
  getCountFromServer,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import Chip from "@mui/material/Chip";
import { useAuth } from "../../AuthContext";
import Loading from "../../components/Loading";
import { DashSection, StatusMeter } from "../../components/dashboard";
import {
  formatCount,
  formatCountFull,
  formatPercent,
} from "../../utils/format";

const FoodStats = () => {
  const { roleData, currentUser } = useAuth();
  const [totalFoods, setTotalFoods] = useState(0);
  const [availableFoods, setAvailableFoods] = useState(0);
  const [notAvailableFoods, setNotAvailableFoods] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const db = getFirestore();
      try {
        const menuRoot =
          currentUser?.uid ||
          roleData?.restaurantOwnerUid ||
          roleData?.restaurantId;
        if (!menuRoot) {
          setLoading(false);
          return;
        }
        const itemsCollectionRef = collection(
          db,
          `food_items/${menuRoot}/items`
        );
        const totalItems = await getCountFromServer(itemsCollectionRef);
        const totalCount = totalItems.data().count;
        const activequery = query(
          itemsCollectionRef,
          where("active", "==", true)
        );
        const activeItems = await getCountFromServer(activequery);
        const activeCount = activeItems.data().count;

        setTotalFoods(totalCount);
        setAvailableFoods(activeCount);
        setNotAvailableFoods(totalCount - activeCount);
      } catch (error) {
        console.error("Error fetching data: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    currentUser?.uid,
    roleData?.restaurantOwnerUid,
    roleData?.restaurantId,
  ]);

  const availablePercentage =
    totalFoods > 0 ? (availableFoods / totalFoods) * 100 : 0;
  const notAvailablePercentage =
    totalFoods > 0 ? (notAvailableFoods / totalFoods) * 100 : 0;

  return (
    <DashSection
      title="Food item status"
      subtitle="Menu availability at a glance"
      action={
        !loading ? (
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label={`${formatCount(totalFoods)} total`}
            title={`${formatCountFull(totalFoods)} total items`}
          />
        ) : null
      }
    >
      {loading ? (
        <div className="h-28 flex items-center justify-center">
          <Loading />
        </div>
      ) : totalFoods === 0 ? (
        <div className="empty-state py-10">
          <p className="text-sm">No menu items yet.</p>
        </div>
      ) : (
        <>
          <StatusMeter
            label="Active items"
            valueLabel={`${formatCount(availableFoods)} (${formatPercent(availablePercentage)})`}
            percent={availablePercentage}
            color="success"
          />
          <StatusMeter
            label="Inactive items"
            valueLabel={`${formatCount(notAvailableFoods)} (${formatPercent(notAvailablePercentage)})`}
            percent={notAvailablePercentage}
            color="error"
          />
        </>
      )}
    </DashSection>
  );
};

export default FoodStats;
