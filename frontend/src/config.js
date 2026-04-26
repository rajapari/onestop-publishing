// Central API configuration
// Set REACT_APP_API_URL in Railway frontend environment variables
const API_URL =
  process.env.REACT_APP_API_URL ||
  "https://web-production-a9dbe.up.railway.app";

export default API_URL;
