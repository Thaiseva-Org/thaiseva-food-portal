import { RestaImg } from "../../../assets";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../../AuthContext";
import { Unauthorized } from "../../component";

const Addrestaurant = () => {
  const { isRestaurantAdmin } = useAuth();
  const currentUserParam = useParams();
  const currentUser = currentUserParam["id"];
  if (isRestaurantAdmin) {
    return <Unauthorized />;
  }
  return (
    <>
      <div className="px-8 pt-0 h-auto">
        <div className="bg-white py-28 rounded-lg shadow-md flex justify-center">
          <div className="text-center">
            <div className=" flex justify-center">
              <img src={RestaImg} alt="" />
            </div>
            <p className="text-slate-500 mb-6 text-lg">
              No restaurants have been added yet!
            </p>
            <Link
              to={`/${currentUser}/restaurant/addrestaurant/restaInformation`}
              className="px-4 py-2 rounded-lg
                         bg-blue-700 text-white text-lg"
            >
              Add your Restaurant
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Addrestaurant;
