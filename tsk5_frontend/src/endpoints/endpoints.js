//const BASE_URL = 'http://localhost:5000';
//const SMS_URL = 'https://tsk5backend-production.up.railway.app/api/sms/';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
export default BASE_URL;