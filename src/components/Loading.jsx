import Lottie from "lottie-react";
import { loadingAnimation } from "../assets";

const Loading = () => {
  return (
    <div className="h-16 w-28 mx-auto flex items-center justify-center">
      <Lottie animationData={loadingAnimation} loop={true} className="w-32" />
    </div>
  );
};

export default Loading;
