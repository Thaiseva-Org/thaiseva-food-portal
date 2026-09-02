import { Fragment } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

// Catch unexpected Promise rejections globally to prevent silent failures
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled Promise Rejection:", event.reason);
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <Fragment>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </Fragment>
);
