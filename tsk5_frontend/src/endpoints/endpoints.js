// When deployed on Vercel, use relative URLs so vercel.json rewrites
// (which proxy /api/* to Render backend) take effect.
// When running locally, use the env var or default to localhost.
const BASE_URL = process.env.REACT_APP_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '');
export default BASE_URL;