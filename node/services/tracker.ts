import axios from 'axios'; // for http requests

const trackerIp = 'http://localhost:3000';

const subscribe = (udpIn: number, id: string ) => {
  axios.post(`${trackerIp}/subscribe`, {
    port: udpIn,
    nodeId: id,
  })
  .then((res: any) => {
    console.log(`Tracker responded with status code: ${res.status}`);
  })
  .catch((error: any) => {
    console.error(error)
  })
}

const getNodes = async () => {
  const res = await axios.get(`${trackerIp}/nodes`)
  return res.data
}

export default { subscribe, getNodes }
